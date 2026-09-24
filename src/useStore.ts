import { useSyncExternalStore } from 'react';
import {
  initStore, subscribe, getState, setState, nextId, nowIso, nextQrCode, statusOf, statusLabel,
  locationString, WAREHOUSES, CATEGORIES, STOCK_REASONS_IN, STOCK_REASONS_OUT,
  type Part, type Activity, type ActivityAction, type Role,
  type StockStatus, type SessionUser, type AppState,
} from './core';
import { SEED_PARTS, SEED_ACTIVITY } from './seedData';
import {
  isSupabaseConfigured, fetchAll, pushActivityRemote, upsertPartRemote, patchPartRemote,
  deletePartRemote, allocatePartId, subscribeRealtime, getSessionUser,
} from './backend';

// Initialise the local store once at module load (demo data).
initStore({ parts: SEED_PARTS, activity: SEED_ACTIVITY });

export const LIVE_MODE = isSupabaseConfigured();

// ---------------------------------------------------------------------------
// Boot: when Supabase is configured, gate on auth, then pull server data and
// subscribe to realtime changes. Demo mode skips all of this.
// ---------------------------------------------------------------------------

async function bootRemote(): Promise<void> {
  setState((s) => ({ ...s, auth: 'connecting' }));
  const user = await getSessionUser();
  if (!user) {
    setState((s) => ({ ...s, auth: 'out', remote: 'on', parts: [], activity: [] }));
    return;
  }
  setState((s) => ({ ...s, user, auth: 'in', remote: 'on' }));
  await refreshFromServer();
  subscribeRealtime({
    onPartChange: (part, removed) => {
      setState((s) => ({
        ...s,
        parts: removed
          ? s.parts.filter((p) => p.id !== part?.id)
          : s.parts.some((p) => p.id === part!.id)
            ? s.parts.map((p) => (p.id === part!.id ? part! : p))
            : [part!, ...s.parts],
      }));
    },
    onActivity: (a) => {
      // Skip echoes of entries we already added optimistically.
      if (getState().activity.some((x) => x.timestamp === a.timestamp && x.action === a.action && x.partId === a.partId)) return;
      setState((s) => ({ ...s, activity: [a, ...s.activity] }));
    },
  });
}

/** Re-pull parts + activity from the server (used at login and after sign-in). */
export async function refreshFromServer(): Promise<void> {
  try {
    const data = await fetchAll();
    if (data) {
      setState((s) => ({
        ...s,
        parts: data.parts,
        activity: data.activity,
        seq: deriveSeq(data.parts),
      }));
    }
  } catch (e) {
    console.error('Failed to load inventory from server:', e);
    setState((s) => ({ ...s, remote: 'error' }));
  }
}

function deriveSeq(parts: Part[]): number {
  let max = 10000;
  for (const p of parts) {
    const m = p.id.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

if (LIVE_MODE) {
  void bootRemote();
  // Handle sign-in completing in another tab or after email confirmation.
  import('./backend').then(({ onAuthChange }) =>
    onAuthChange(async (user) => {
      if (user) {
        setState((s) => ({ ...s, user, auth: 'in', remote: 'on' }));
        await refreshFromServer();
      } else {
        setState((s) => ({ ...s, auth: 'out', parts: [], activity: [] }));
      }
    }),
  );
}

// ---------------------------------------------------------------- store API --

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ---------------------------------------------------------------- operations

interface ActivityInput {
  partId: string; partNumber: string; partName: string;
  action: ActivityAction;
  delta?: number; prevQty?: number; newQty?: number;
  prevLocation?: string; newLocation?: string;
  summary?: string;
  reason: string; note?: string;
}

function recordActivity(a: ActivityInput) {
  const u = getState().user;
  const entry: Activity = {
    id: `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user: u.role === 'admin' ? `${u.name} (Admin)` : `${u.name} (Staff)`,
    role: u.role,
    timestamp: nowIso(),
    ...a,
  };
  setState((s) => ({ ...s, activity: [entry, ...s.activity] }));
  if (LIVE_MODE) void pushActivityRemote({
    partId: entry.partId, partNumber: entry.partNumber, partName: entry.partName,
    action: entry.action, delta: entry.delta, prevQty: entry.prevQty, newQty: entry.newQty,
    prevLocation: entry.prevLocation, newLocation: entry.newLocation, summary: entry.summary,
    user: entry.user, role: entry.role, reason: entry.reason, note: entry.note,
    timestamp: entry.timestamp,
  });
}

function touchPart(id: string, patch: Partial<Part>) {
  setState((s) => ({
    ...s,
    parts: s.parts.map((p) => (p.id === id ? { ...p, ...patch, lastUpdated: nowIso() } : p)),
  }));
  if (LIVE_MODE) void patchPartRemote(id, { ...patch, lastUpdated: nowIso() });
}

export function addStock(partId: string, qty: number, reason: string, note: string) {
  const p = getState().parts.find((x) => x.id === partId);
  if (!p || qty <= 0) return;
  const newQty = p.quantity + qty;
  touchPart(partId, { quantity: newQty });
  recordActivity({
    partId, partNumber: p.partNumber, partName: p.partName,
    action: 'stock_in', delta: qty, prevQty: p.quantity, newQty,
    reason, note: note || undefined,
  });
}

export function removeStock(partId: string, qty: number, reason: string, note: string) {
  const p = getState().parts.find((x) => x.id === partId);
  if (!p || qty <= 0 || qty > p.quantity) return;
  const newQty = p.quantity - qty;
  touchPart(partId, { quantity: newQty });
  recordActivity({
    partId, partNumber: p.partNumber, partName: p.partName,
    action: 'stock_out', delta: -qty, prevQty: p.quantity, newQty,
    reason, note: note || undefined,
  });
}

export function setQuantity(partId: string, newQty: number, reason: string, note: string) {
  const p = getState().parts.find((x) => x.id === partId);
  if (!p || newQty < 0 || newQty === p.quantity) return;
  touchPart(partId, { quantity: newQty });
  recordActivity({
    partId, partNumber: p.partNumber, partName: p.partName,
    action: 'adjustment', delta: newQty - p.quantity, prevQty: p.quantity, newQty,
    reason, note: note || undefined,
  });
}

export interface ProductFields {
  partNumber: string; partName: string; category: string; vehicleModel: string;
  description: string; supplier: string; supplierPartNumber: string; unitCost: number;
  notes: string;
}

export interface InventoryFields {
  quantity: number; minimumStock: number;
  warehouse: string; rack: string; shelf: string; bin: string;
  qrCode: string;
}

export function updateProduct(partId: string, f: ProductFields) {
  const p = getState().parts.find((x) => x.id === partId);
  if (!p) return;
  touchPart(partId, f);
  const changes: string[] = [];
  if (p.partNumber !== f.partNumber) changes.push(`Part number ${p.partNumber} → ${f.partNumber}`);
  if (p.partName !== f.partName) changes.push('Name changed');
  if (p.category !== f.category) changes.push(`Category → ${f.category}`);
  if (p.vehicleModel !== f.vehicleModel) changes.push(`Vehicle → ${f.vehicleModel}`);
  if (p.supplier !== f.supplier) changes.push(`Supplier → ${f.supplier}`);
  if (p.unitCost !== f.unitCost) changes.push(`Unit cost ₹${p.unitCost} → ₹${f.unitCost}`);
  recordActivity({
    partId, partNumber: f.partNumber, partName: f.partName, action: 'part_updated',
    summary: changes.length ? changes.join('; ') : 'Product details saved (no changes)',
    reason: 'Part record edited',
  });
}

export function updateInventory(partId: string, f: InventoryFields) {
  const p = getState().parts.find((x) => x.id === partId);
  if (!p) return;
  const prevLoc = locationString(p);
  const next: Partial<Part> = {
    quantity: f.quantity, minimumStock: f.minimumStock,
    warehouse: f.warehouse, rack: f.rack, shelf: f.shelf, bin: f.bin, qrCode: f.qrCode,
  };
  touchPart(partId, next);
  const newLoc = locationString({ ...p, ...next } as Part);
  if (prevLoc !== newLoc) {
    recordActivity({
      partId, partNumber: p.partNumber, partName: p.partName,
      action: 'location_change', prevLocation: prevLoc, newLocation: newLoc,
      reason: 'Storage location edited via part record',
    });
  }
  if (p.minimumStock !== f.minimumStock) {
    recordActivity({
      partId, partNumber: p.partNumber, partName: p.partName,
      action: 'min_stock_changed',
      summary: `Minimum stock changed ${p.minimumStock} → ${f.minimumStock}`,
      reason: 'Minimum stock edited',
    });
  }
  if (p.quantity !== f.quantity) {
    recordActivity({
      partId, partNumber: p.partNumber, partName: p.partName,
      action: 'adjustment', delta: f.quantity - p.quantity, prevQty: p.quantity, newQty: f.quantity,
      reason: 'Quantity edited via part record',
    });
  }
}

export function movePart(partId: string, dest: { warehouse: string; rack: string; shelf: string; bin: string }, reason: string, note: string) {
  const p = getState().parts.find((x) => x.id === partId);
  if (!p) return;
  const prevLoc = locationString(p);
  touchPart(partId, dest);
  const newLoc = locationString({ ...p, ...dest } as Part);
  recordActivity({
    partId, partNumber: p.partNumber, partName: p.partName,
    action: 'location_change', prevLocation: prevLoc, newLocation: newLoc,
    reason: reason || 'Manual move', note: note || undefined,
  });
}

/**
 * Create a part locally and (in live mode) on the server. The server allocates
 * the canonical INV id from a Postgres sequence; demo mode uses the local counter.
 */
export async function createPart(product: ProductFields, inv: InventoryFields, initialReason: string): Promise<Part> {
  const id = LIVE_MODE ? (await allocatePartId()) ?? nextId() : nextId();
  const qr = inv.qrCode || `QR-${Date.now().toString().slice(-5)}`;
  const part: Part = {
    id, qrCode: qr,
    partNumber: product.partNumber, partName: product.partName,
    category: product.category, vehicleModel: product.vehicleModel,
    description: product.description,
    quantity: inv.quantity, minimumStock: inv.minimumStock,
    warehouse: inv.warehouse, rack: inv.rack, shelf: inv.shelf, bin: inv.bin,
    supplier: product.supplier, supplierPartNumber: product.supplierPartNumber,
    unitCost: product.unitCost,
    dateAdded: nowIso(), lastUpdated: nowIso(),
    notes: product.notes,
  };
  setState((s) => ({ ...s, parts: [part, ...s.parts] }));
  if (LIVE_MODE) void upsertPartRemote(part);
  recordActivity({
    partId: id, partNumber: part.partNumber, partName: part.partName,
    action: 'part_created',
    summary: `New part added — initial stock ${inv.quantity}`,
    reason: initialReason || 'New SKU onboarding',
  });
  return part;
}

export function deletePart(partId: string, reason: string) {
  const p = getState().parts.find((x) => x.id === partId);
  if (!p) return;
  setState((s) => ({ ...s, parts: s.parts.filter((x) => x.id !== partId) }));
  if (LIVE_MODE) void deletePartRemote(partId);
  recordActivity({
    partId, partNumber: p.partNumber, partName: p.partName,
    action: 'part_deleted',
    summary: `Part deleted (was ${p.quantity} units at ${locationString(p)})`,
    reason: reason || 'Removed from catalogue',
  });
}

export function findPartByQr(qr: string): Part | undefined {
  const q = qr.trim().toUpperCase();
  return getState().parts.find(
    (p) => p.qrCode.toUpperCase() === q
      || p.partNumber.toUpperCase() === q
      || p.id.toUpperCase() === q,
  );
}

/** Demo-mode only role switcher. Ignored in live mode. */
export function setUser(u: SessionUser) {
  setState((s) => ({ ...s, user: u }));
}

export {
  statusOf, statusLabel, locationString, nowIso, nextId, nextQrCode,
  WAREHOUSES, CATEGORIES, STOCK_REASONS_IN, STOCK_REASONS_OUT,
};
export type { Part, Activity, ActivityAction, Role, StockStatus, SessionUser };
