import type { SupabaseClient } from '@supabase/supabase-js';

// Credentials come from .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
// The anon key is safe to expose to the browser — row level security and
// auth policies protect the data. When the vars are absent the app runs in
// localStorage demo mode and the SDK is never downloaded.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let clientPromise: Promise<SupabaseClient | null> | null = null;

/** True when both env vars are present at build time. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && key);
}

/**
 * Lazily import and create the client (null when unconfigured).
 * Async so the ~40 KB SDK stays out of the initial bundle.
 */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url as string, key as string),
    );
  }
  return clientPromise;
}
