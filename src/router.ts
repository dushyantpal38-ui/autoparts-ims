import { useCallback, useEffect, useState } from 'react';

// Lightweight hash router — keeps the prototype deployable as static files
// (works from file:// and any static host) without server rewrites.

export function usePath(): [string, (p: string) => void] {
  const [path, setPath] = useState(() => window.location.hash.slice(1) || '/');

  useEffect(() => {
    const onHash = () => setPath(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((p: string) => {
    window.location.hash = p;
    // scroll to top on navigation, except when only the query changes
    const prev = window.location.hash.slice(1).split('?')[0];
    const next = p.split('?')[0];
    if (prev !== next) window.scrollTo(0, 0);
  }, []);

  return [path, go];
}

export function parsePath(path: string): { base: string; id: string; query: URLSearchParams } {
  const [rawPath, qs] = path.split('?');
  const query = new URLSearchParams(qs ?? '');
  const segs = rawPath.split('/').filter(Boolean); // e.g. ['part', 'INV-10001']
  let base = '/' + (segs[0] ?? '');
  let id = '';
  if (segs.length > 1) id = decodeURIComponent(segs[1]);
  // Legacy query-form links: /part?id=INV-1 → base '/part', id from query
  if (!id) id = query.get('id') ?? '';
  return { base, id, query };
}
