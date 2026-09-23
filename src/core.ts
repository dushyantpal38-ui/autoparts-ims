// Domain types + central store. Single source of truth for the prototype.
// Swap `loadState`/`saveState` for API calls later — components never touch
// localStorage directly.

export type Role = 'admin' | 'staff';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface Part {
  id: string;              // internal unique id (INV-xxxxx)
  qrCode: string;          // printable QR payload, e.g. QR-48291
  partNumber: string;      // SKU, e.g. BP-48291
  partName: string;
  category: string;
  vehicleModel: string;
  description: string;
  quantity: number;
  minimumStock: number;
  warehouse: string;
  rack: string;
  shelf: string;
  bin: string;
  supplier: string;
  supplierPartNumber: string;
  unitCost: number;        // INR
  dateAdded: string;       // ISO
  lastUpdated: string;     // ISO
  notes: string;
}

export type ActivityAction =
  | 'part_created'
  | 'stock_in'
  | 'stock_out'
  | 'adjustment'
  | 'location_change'
  | 'part_updated'
  | 'min_stock_changed'
  | 'part_deleted';

export interface Activity {
  id: string;
  partId: string;
  partNumber: string;
  partName: string;
  action: ActivityAction;
  // For stock actions:
  delta?: number;          // +2 / -2
  prevQty?: number;
  newQty?: number;
  // For location change:
  prevLocation?: string;   // "Warehouse A · R-04 · S-02 · B-18"
  newLocation?: string;
  // Generic summary, e.g. "Minimum stock changed 10 → 15"
  summary?: string;
  user: string;
  role: Role;
  reason: string;
  note?: string;
  timestamp: string;       // ISO
}

export interface SessionUser {
  name: string;
  role: Role;
}

export const WAREHOUSES = ['Warehouse A', 'Warehouse B'] as const;

export const CATEGORIES = [
  'Engine',
  'Brake System',
  'Suspension',
  'Electrical',
  'Body & Exterior',
  'Interior',
  'Filters',
  'Cooling',
  'Transmission',
] as const;

export const STOCK_REASONS_OUT = [
  'Sale / workshop issue',
  'Inter-warehouse transfer',
  'Damaged / scrap',
  'Return to supplier',
  'Stock count correction',
] as const;

export const STOCK_REASONS_IN = [
  'Purchase receipt',
  'Customer return',
  'Inter-warehouse transfer',
  'Stock count correction',
] as const;

export function statusOf(p: Part): StockStatus {
  if (p.quantity <= 0) return 'out_of_stock';
  if (p.quantity <= p.minimumStock) return 'low_stock';
  return 'in_stock';
}

export function statusLabel(s: StockStatus): string {
  return s === 'out_of_stock' ? 'OUT OF STOCK' : s === 'low_stock' ? 'LOW STOCK' : 'IN STOCK';
}

export function locationString(p: Pick<Part, 'warehouse' | 'rack' | 'shelf' | 'bin'>): string {
  return `${p.warehouse} · ${p.rack} · ${p.shelf} · ${p.bin}`;
}

// ---------------------------------------------------------------------------

const LS_KEY = 'autoparts-ims-v1';

export interface AppState {
  parts: Part[];
  activity: Activity[];
  user: SessionUser;
  seq: number;
}

function defaultUser(): SessionUser {
  try {
    const raw = localStorage.getItem(LS_KEY + ':user');
    if (raw) return JSON.parse(raw) as SessionUser;
  } catch { /* ignore */ }
  return { name: 'R. Sharma', role: 'admin' };
}

function loadState(seed: { parts: Part[]; activity: Activity[] }): AppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (Array.isArray(parsed.parts)) {
        // Keep the id counter ahead of any stored/seeded id (e.g. INV-10038).
        const seq = Math.max(parsed.seq ?? 0, deriveSeq(parsed.parts));
        return { ...parsed, seq, user: parsed.user ?? defaultUser() };
      }
    }
  } catch { /* corrupted -> reseed */ }
  return { parts: seed.parts, activity: seed.activity, user: defaultUser(), seq: deriveSeq(seed.parts) };
}

// Largest numeric suffix among part ids; guarantees nextId() never collides.
function deriveSeq(parts: Part[]): number {
  let max = 10000;
  for (const p of parts) {
    const m = p.id.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

let listeners: Array<() => void> = [];
let state: AppState | null = null;

export function initStore(seed: { parts: Part[]; activity: Activity[] }): AppState {
  state = loadState(seed);
  return state;
}

export function getState(): AppState {
  if (!state) throw new Error('Store not initialised');
  return state;
}

export function setState(updater: (s: AppState) => AppState) {
  if (!state) throw new Error('Store not initialised');
  state = updater(state);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    localStorage.setItem(LS_KEY + ':user', JSON.stringify(state.user));
  } catch { /* storage full / private mode: keep in-memory */ }
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function resetToSeed(seed: { parts: Part[]; activity: Activity[] }) {
  setState(() => ({ parts: seed.parts, activity: seed.activity, user: getState().user, seq: deriveSeq(seed.parts) }));
}

// ---- id helpers -----------------------------------------------------------

export function nextId(): string {
  const s = getState();
  setState((st) => ({ ...st, seq: st.seq + 1 }));
  return `INV-${getState().seq}`;
}

export function nextQrCode(partNumber: string): string {
  const m = partNumber.match(/(\d{3,})/);
  if (m) return `QR-${m[1]}`;
  // derive stable digits from part number characters
  let h = 0;
  for (let i = 0; i < partNumber.length; i++) h = (h * 31 + partNumber.charCodeAt(i)) % 100000;
  return `QR-${String(h).padStart(5, '0')}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
