import { useMemo, useState } from 'react';
import { useStore, type ActivityAction } from '../useStore';
import { Button, EmptyState, formatDateTime, usePageMeta } from '../ui';
import { historyLine } from './PartDetails';

const ACTION_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All actions' },
  { value: 'stock_in', label: 'Stock in' },
  { value: 'stock_out', label: 'Stock out' },
  { value: 'adjustment', label: 'Adjustments' },
  { value: 'location_change', label: 'Location changes' },
  { value: 'part_created', label: 'New parts' },
  { value: 'part_updated', label: 'Edits' },
  { value: 'min_stock_changed', label: 'Min stock changes' },
  { value: 'part_deleted', label: 'Deletions' },
];

const PAGE_SIZE = 25;

export function ActivityPage({ go, partId }: { go: (p: string) => void; partId?: string }) {
  usePageMeta(
    'Activity / History',
    'Complete audit trail of stock changes, location moves, edits and deletions across the warehouse.',
    '/#/activity',
  );
  const { activity, parts } = useStore();
  const [action, setAction] = useState('');
  const [user, setUser] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const users = useMemo(() => [...new Set(activity.map((a) => a.user))], [activity]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return activity.filter((a) => {
      if (partId && a.partId !== partId) return false;
      if (action && a.action !== action) return false;
      if (user && a.user !== user) return false;
      if (s && ![a.partNumber, a.partName, a.reason, a.note ?? '', a.summary ?? '']
        .join(' ').toLowerCase().includes(s)) return false;
      return true;
    });
  }, [activity, partId, action, user, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const rows = filtered.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const partLabel = partId ? parts.find((p) => p.id === partId)?.partNumber : null;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Activity / History</h1>
          <p className="page-sub">
            {partLabel
              ? <>Full audit trail for <span className="mono">{partLabel}</span></>
              : 'Every stock change, move and edit across the warehouse'}
          </p>
        </div>
        <div className="page-actions">
          {partId && <Button onClick={() => go('/activity')}>Show All Parts</Button>}
        </div>
      </header>

      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="Search part, reason, note…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
        />
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}>
          {ACTION_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={user} onChange={(e) => { setUser(e.target.value); setPage(0); }}>
          <option value="">All users</option>
          {users.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No activity" message="No recorded events match the current filters." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table table-activity">
              <thead>
                <tr>
                  <th>Date / Time</th>
                  <th>Part</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>User</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="muted nowrap">{formatDateTime(a.timestamp)}</td>
                    <td>
                      <button className="link-btn" onClick={() => go(`/part/${a.partId}`)}>
                        <span className="mono">{a.partNumber}</span>
                      </button>
                      <span className="table-sub">{a.partName}</span>
                    </td>
                    <td><span className={`action-tag action-${a.action}`}>{actionLabel(a.action)}</span></td>
                    <td className="cell-details">
                      {a.action === 'stock_in' || a.action === 'stock_out' || a.action === 'adjustment' ? (
                        <span>
                          <strong className={a.delta! > 0 ? 'op-plus' : 'op-minus'}>
                            {a.delta! > 0 ? '+' : ''}{a.delta}
                          </strong>
                          {' '}{a.prevQty} → {a.newQty} units
                        </span>
                      ) : a.action === 'location_change' ? (
                        <span className="mono-sm">{a.prevLocation} → {a.newLocation}</span>
                      ) : (
                        <span>{a.summary ?? '—'}</span>
                      )}
                      {a.note && <span className="table-sub">“{a.note}”</span>}
                    </td>
                    <td className="muted">{a.user}</td>
                    <td className="muted">{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-foot">
            <span className="muted">
              Showing {pageSafe * PAGE_SIZE + 1}–{Math.min((pageSafe + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="pager">
              <Button disabled={pageSafe === 0} onClick={() => setPage(pageSafe - 1)}>← Prev</Button>
              <span className="pager-info">Page {pageSafe + 1} of {pageCount}</span>
              <Button disabled={pageSafe >= pageCount - 1} onClick={() => setPage(pageSafe + 1)}>Next →</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function actionLabel(a: ActivityAction): string {
  switch (a) {
    case 'stock_in': return 'STOCK IN';
    case 'stock_out': return 'STOCK OUT';
    case 'adjustment': return 'ADJUSTMENT';
    case 'location_change': return 'MOVE';
    case 'part_created': return 'CREATED';
    case 'part_updated': return 'EDITED';
    case 'min_stock_changed': return 'MIN CHANGED';
    case 'part_deleted': return 'DELETED';
    default: return a;
  }
}
