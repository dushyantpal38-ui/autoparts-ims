import { useState } from 'react';
import { useStore, statusOf, locationString } from '../useStore';
import { Button, StatusPill, EmptyState, usePageMeta } from '../ui';
import { exportParts } from '../export';

export function LowStockPage({ go }: { go: (p: string) => void }) {
  usePageMeta(
    'Low Stock',
    'Parts at or below their minimum stock level, with reorder shortfalls and estimated reorder cost.',
    '/#/low-stock',
  );
  const { parts } = useStore();
  const [includeOut, setIncludeOut] = useState(true);

  const low = parts.filter((p) => statusOf(p) === 'low_stock');
  const out = parts.filter((p) => statusOf(p) === 'out_of_stock');
  const rows = includeOut ? [...out, ...low] : low;

  // Rough reorder suggestion: top-up to 2× minimum.
  const reorderValue = rows.reduce((a, p) => a + Math.max(0, p.minimumStock * 2 - p.quantity) * p.unitCost, 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Low Stock</h1>
          <p className="page-sub">
            {low.length} part{low.length === 1 ? '' : 's'} at or below minimum · {out.length} out of stock
          </p>
        </div>
        <div className="page-actions">
          <Button onClick={() => exportParts(rows, 'low-stock-report')}>Export List</Button>
          <Button variant="primary" onClick={() => go('/inventory?status=low_stock')}>Open in Inventory</Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="No low-stock items"
          message="Every part is currently above its minimum stock level. Nothing to reorder."
        />
      ) : (
        <>
          <div className="stat-row">
            <div className="stat stat-warn">
              <span className="stat-label">Low Stock</span>
              <span className="stat-value">{low.length}</span>
            </div>
            <div className="stat stat-danger">
              <span className="stat-label">Out of Stock</span>
              <span className="stat-value">{out.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Est. Reorder Cost</span>
              <span className="stat-value stat-value-sm">₹{reorderValue.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Supplier</th>
                  <th className="num">Qty</th>
                  <th className="num">Min</th>
                  <th className="num">Shortfall</th>
                  <th>Status</th>
                  <th className="num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="row-link" onClick={() => go(`/part/${p.id}`)}>
                    <td>
                      <span className="mono strong">{p.partNumber}</span>
                      <span className="table-sub">{p.partName}</span>
                    </td>
                    <td>{p.category}</td>
                    <td className="mono-sm">{locationString(p)}</td>
                    <td className="muted">{p.supplier}</td>
                    <td className="num strong">{p.quantity}</td>
                    <td className="num muted">{p.minimumStock}</td>
                    <td className="num">{p.quantity === 0 ? '—' : `+${Math.max(0, p.minimumStock * 2 - p.quantity)}`}</td>
                    <td><StatusPill status={statusOf(p)} /></td>
                    <td className="num row-actions" onClick={(e) => e.stopPropagation()}>
                      <Button onClick={() => go(`/part/${p.id}?action=add`)}>+ Stock</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
