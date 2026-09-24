// Backend abstraction over Supabase. When env vars are present the app talks
// to Postgres (realtime sync + real auth); otherwise every function resolves
// to null/false and the localStorage demo store keeps working unchanged.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Part, Activity, SessionUser } from './core';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';

// ------------------------------------------------------------ row mappers ---

type Row = Record<string, unknown>;

export function partToRow(p: Part): Row {
  return {
    id: p.id, qr_code: p.qrCode, part_number: p.partNumber, part_name: p.partName,
    category: p.category, vehicle_model: p.vehicleModel, description: p.description,
    quantity: p.quantity, minimum_stock: p.minimumStock,
    warehouse: p.warehouse, rack: p.rack, shelf: p.shelf, bin: p.bin,
    supplier: p.supplier, supplier_part_number: p.supplierPartNumber,
    unit_cost: p.unitCost, date_added: p.dateAdded, last_updated: p.lastUpdated,
    notes: p.notes,
  };
}

export function rowToPart(r: Row): Part {
  return {
    id: String(r.id), qrCode: String(r.qr_code ?? ''), partNumber: String(r.part_number ?? ''),
    partName: String(r.part_name ?? ''), category: String(r.category ?? ''),
    vehicleModel: String(r.vehicle_model ?? ''), description: String(r.description ?? ''),
    quantity: Number(r.quantity ?? 0), minimumStock: Number(r.minimum_stock ?? 0),
    warehouse: String(r.warehouse ?? ''), rack: String(r.rack ?? ''),
    shelf: String(r.shelf ?? ''), bin: String(r.bin ?? ''),
    supplier: String(r.supplier ?? ''), supplierPartNumber: String(r.supplier_part_number ?? ''),
    unitCost: Number(r.unit_cost ?? 0),
    dateAdded: String(r.date_added ?? ''), lastUpdated: String(r.last_updated ?? ''),
    notes: String(r.notes ?? ''),
  };
}

export function activityToRow(a: Omit<Activity, 'id'>, email: string): Row {
  return {
    part_id: a.partId, part_number: a.partNumber, part_name: a.partName,
    action: a.action, delta: a.delta ?? null, prev_qty: a.prevQty ?? null,
    new_qty: a.newQty ?? null, prev_location: a.prevLocation ?? null,
    new_location: a.newLocation ?? null, summary: a.summary ?? null,
    user_name: a.user, user_email: email, role: a.role,
    reason: a.reason, note: a.note ?? null,
    created_at: a.timestamp,
  };
}

export function rowToActivity(r: Row): Activity {
  return {
    id: String(r.id), partId: String(r.part_id ?? ''), partNumber: String(r.part_number ?? ''),
    partName: String(r.part_name ?? ''), action: r.action as Activity['action'],
    delta: r.delta == null ? undefined : Number(r.delta),
    prevQty: r.prev_qty == null ? undefined : Number(r.prev_qty),
    newQty: r.new_qty == null ? undefined : Number(r.new_qty),
    prevLocation: (r.prev_location as string) ?? undefined,
    newLocation: (r.new_location as string) ?? undefined,
    summary: (r.summary as string) ?? undefined,
    user: String(r.user_name ?? ''), role: (r.role as Activity['role']) ?? 'staff',
    reason: String(r.reason ?? ''), note: (r.note as string) ?? undefined,
    timestamp: String(r.created_at ?? ''),
  };
}

// ------------------------------------------------------------------ reads ---

export async function fetchAll(): Promise<{ parts: Part[]; activity: Activity[] } | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const [partsRes, actRes] = await Promise.all([
    sb.from('parts').select('*').order('date_added', { ascending: false }),
    sb.from('activity').select('*').order('created_at', { ascending: false }).limit(500),
  ]);
  if (partsRes.error) throw partsRes.error;
  if (actRes.error) throw actRes.error;
  return {
    parts: (partsRes.data ?? []).map(rowToPart),
    activity: (actRes.data ?? []).map(rowToActivity),
  };
}

// --------------------------------------------------------------- mutations ---

async function whoAmI(sb: SupabaseClient): Promise<{ name: string; email: string }> {
  const [{ data: { user } }, { data: profile }] = await Promise.all([
    sb.auth.getUser(),
    // getUser may not have resolved yet on first paint; profile lookup is best-effort
    sb.from('profiles').select('name, email').limit(1),
  ]);
  void profile;
  return { name: user?.email?.split('@')[0] ?? 'Unknown', email: user?.email ?? '' };
}

/** Insert an activity row on the server. Best-effort; errors are logged. */
export async function pushActivityRemote(a: Omit<Activity, 'id'>): Promise<void> {
  const sb = await getSupabase();
  if (!sb) return;
  const { name, email } = await whoAmI(sb);
  const row = activityToRow(a, email);
  row.user_name = a.user; // display name comes from the client session
  void name;
  const { error } = await sb.from('activity').insert(row);
  if (error) console.error('activity insert failed:', error.message);
}

export async function upsertPartRemote(p: Part): Promise<void> {
  const sb = await getSupabase();
  if (!sb) return;
  const { error } = await sb.from('parts').upsert(partToRow(p));
  if (error) console.error('part upsert failed:', error.message);
}

export async function patchPartRemote(id: string, patch: Partial<Part>): Promise<void> {
  const sb = await getSupabase();
  if (!sb) return;
  const row: Row = {};
  const map: Array<[keyof Part, string]> = [
    ['quantity', 'quantity'], ['minimumStock', 'minimum_stock'],
    ['warehouse', 'warehouse'], ['rack', 'rack'], ['shelf', 'shelf'], ['bin', 'bin'],
    ['qrCode', 'qr_code'], ['partNumber', 'part_number'], ['partName', 'part_name'],
    ['category', 'category'], ['vehicleModel', 'vehicle_model'],
    ['description', 'description'], ['supplier', 'supplier'],
    ['supplierPartNumber', 'supplier_part_number'], ['unitCost', 'unit_cost'], ['notes', 'notes'],
  ];
  for (const [k, col] of map) {
    if (patch[k] !== undefined) row[col] = patch[k];
  }
  row.last_updated = new Date().toISOString();
  const { error } = await sb.from('parts').update(row).eq('id', id);
  if (error) console.error('part update failed:', error.message);
}

export async function deletePartRemote(id: string): Promise<void> {
  const sb = await getSupabase();
  if (!sb) return;
  const { error } = await sb.from('parts').delete().eq('id', id);
  if (error) console.error('part delete failed:', error.message);
}

/** Atomically allocate the next INV-xxxxx id from the Postgres sequence. */
export async function allocatePartId(): Promise<string | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('next_part_id');
  if (error || !data) { console.error('id allocation failed:', error?.message); return null; }
  return String(data);
}

// ------------------------------------------------------------------- auth ---

export async function getSessionUser(): Promise<SessionUser | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from('profiles').select('name, role').eq('id', user.id).single();
  return {
    name: profile?.name || user.email?.split('@')[0] || 'User',
    role: (profile?.role as 'admin' | 'staff') ?? 'staff',
  };
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const sb = await getSupabase();
  if (!sb) return { error: 'Supabase is not configured.' };
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : {};
}

export async function signUp(name: string, email: string, password: string): Promise<{ error?: string; needsEmailConfirm?: boolean }> {
  const sb = await getSupabase();
  if (!sb) return { error: 'Supabase is not configured.' };
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
  if (error) return { error: error.message };
  return { needsEmailConfirm: !data.session };
}

export async function signOut(): Promise<void> {
  const sb = await getSupabase();
  if (sb) await sb.auth.signOut();
}

/** Subscribe to auth changes. Returns unsubscribe. No-op in demo mode. */
export function onAuthChange(cb: (user: SessionUser | null) => void): () => void {
  let unsub = () => {};
  void (async () => {
    const sb = await getSupabase();
    if (!sb) return;
    const { data } = sb.auth.onAuthStateChange(async () => cb(await getSessionUser()));
    unsub = () => data.subscription.unsubscribe();
  })();
  return () => unsub();
}

// --------------------------------------------------------------- realtime ---

/**
 * Subscribe to parts + activity changes so every signed-in device sees live
 * inventory. Returns unsubscribe. No-op in demo mode.
 */
export function subscribeRealtime(handlers: {
  onPartChange: (part: Part | null, removed: boolean) => void;
  onActivity: (a: Activity) => void;
}): () => void {
  let unsub = () => {};
  void (async () => {
    const sb = await getSupabase();
    if (!sb) return;
    const channel = sb
      .channel('inventory-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parts' }, (payload) => {
        if (payload.eventType === 'DELETE') handlers.onPartChange(null, true);
        else handlers.onPartChange(rowToPart(payload.new as Row), false);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity' }, (payload) => {
        handlers.onActivity(rowToActivity(payload.new as Row));
      })
      .subscribe();
    unsub = () => { void sb.removeChannel(channel); };
  })();
  return () => unsub();
}

export { isSupabaseConfigured };
