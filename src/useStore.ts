import { useSyncExternalStore } from 'react';
import {
  initStore, subscribe, getState, setState, nextId, nowIso, nextQrCode, statusOf, statusLabel,
  locationString, type Part, type Activity, type ActivityAction, type Role,
  type StockStatus, type SessionUser,
  WAREHOUSES, CATEGORIES, STOCK_REASONS_IN, STOCK_REASONS_OUT,
} from './core';
import { SEED_PARTS, SEED_ACTIVITY } from './seedData';

// Initialise once at module load.
initStore({ parts: SEED_PARTS, activity: SEED_ACTIVITY });

export function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ---------------------------------------------------------------- operations

function pushActivity(a: Omit<Activity, 'id' | 'user' | 'role' | 'timestamp'>) {
  const u = getState().user;
  const entry: Activity = {
    id: `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user: u.role === 'admin' ? `${u.name} (Admin)` : `${u.name} (Staff)`,
    role: u.role,
    timestamp: nowIso(),
    ...a,
  };
  setState((s) => ({ ...s, activity: [entry, ...s.activity] }));
}

function touchPart(id: string, patch: Partial<Part>) {
  setState((s) => ({
    ...s,
    parts: s.parts.map((p) => (p.id === id ? { ...p, ...patch, lastUpdated: nowIso() } : p)),
  }));
}

export function addStock(partId: string, qty: number, reason: string, note: string) {
  const p = getState().parts.find((x) => x.id === partId);
  if (!p || qty <= 0) return;
  const newQty = p.quantity + qty;
  touchPart(partId, { quantity: newQty });
  pushActivity({
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
  pushActivity({
    partId, partNumber: p.partNumber, partName: p.partName,
    action: 'stock_out', delta: -qty, prevQty: p.quantity, newQty,
    reason, note: note || undefined,
  });
}

export function setQuantity(partId: string, newQty: number, reason: string, note: string) {
  const p = getState().parts.find((x) => x.id === partId);
  if (!p || newQty < 0 || newQty === p.quantity) return;
  touchPart(partId, { quantity: newQty });
  pushActivity({
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
  pushActivity({
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
    pushActivity({
      partId, partNumber: p.partNumber, partName: p.partName,
      action: 'location_change', prevLocation: prevLoc, newLocation: newLoc,
      reason: 'Storage location edited via part record',
    });
  }
  if (p.minimumStock !== f.minimumStock) {
    pushActivity({
      partId, partNumber: p.partNumber, partName: p.partName,
      action: 'min_stock_changed',
      summary: `Minimum stock changed ${p.minimumStock} → ${f.minimumStock}`,
      reason: 'Minimum stock edited',
    });
  }
  if (p.quantity !== f.quantity) {
    pushActivity({
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
  pushActivity({
    partId, partNumber: p.partNumber, partName: p.partName,
    action: 'location_change', prevLocation: prevLoc, newLocation: newLoc,
    reason: reason || 'Manual move', note: note || undefined,
  });
}

export function createPart(product: ProductFields, inv: InventoryFields, initialReason: string): Part {
  const id = nextId();
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
  pushActivity({
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
  pushActivity({
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

export function setUser(u: SessionUser) {
  setState((s) => ({ ...s, user: u }));
}

export {
  statusOf, statusLabel, locationString, nowIso, nextId, nextQrCode,
  WAREHOUSES, CATEGORIES, STOCK_REASONS_IN, STOCK_REASONS_OUT,
};
export type { Part, Activity, ActivityAction, Role, StockStatus, SessionUser };
