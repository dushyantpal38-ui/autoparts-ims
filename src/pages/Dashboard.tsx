import { useStore, statusOf, locationString } from '../useStore';
import { Button, StatusPill, formatDateTime, formatMoney, usePageMeta } from '../ui';
import { CATEGORIES } from '../core';
import { historyLine } from './PartDetails';
import type { Activity } from '../core';

export function Dashboard({ go }: { go: (path: string) => void }) {
  usePageMeta(
    'Dashboard',
    'Live overview of automobile parts inventory — stock levels, low-stock alerts, recent activity and inventory value across all warehouses.',
  );
  const { parts, activity } = useStore();

  const totalParts = parts.length;
  const totalUnits = parts.reduce((a, p) => a + p.quantity, 0);
  const low = parts.filter((p) => statusOf(p) === 'low_stock');
  const out = parts.filter((p) => statusOf(p) === 'out_of_stock');
  const recent = [...parts].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)).slice(0, 5);
  const invValue = parts.reduce((a, p) => a + p.quantity * p.unitCost, 0);

  const catCounts = new Map<string, number>();
  for (const p of parts) catCounts.set(p.category, (catCounts.get(p.category) ?? 0) + 1);
  const topCats = [...catCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">Warehouse inventory overview · {formatDateTime(new Date().toISOString())}</p>
        </div>
        <div className="page-actions">
          <Button onClick={() => go('/inventory')}>View Inventory</Button>
          <Button onClick={() => go('/add')}>+ Add Part</Button>
          <Button variant="primary" onClick={() => go('/scan')}>Scan QR Code</Button>
        </div>
      </header>

      {/* KPI row */}
      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">Total Parts</span>
          <span className="stat-value">{totalParts}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Total Units</span>
          <span className="stat-value">{totalUnits.toLocaleString('en-IN')}</span>
        </div>
        <div className="stat stat-warn">
          <span className="stat-label">Low Stock</span>
          <span className="stat-value">{low.length}</span>
          <button className="stat-link" onClick={() => go('/low-stock')}>View →</button>
        </div>
        <div className="stat stat-danger">
          <span className="stat-label">Out of Stock</span>
          <span className="stat-value">{out.length}</span>
          <button className="stat-link" onClick={() => go('/inventory?status=out_of_stock')}>View →</button>
        </div>
        <div className="stat">
          <span className="stat-label">Inventory Value</span>
          <span className="stat-value stat-value-sm">{formatMoney(invValue)}</span>
        </div>
      </div>

      <div className="dash-grid">
        {/* Attention list */}
        <section className="card">
          <header className="card-head">
            <div>
              <h2 className="card-title">Needs Attention — Low / Out of Stock</h2>
              <p className="card-desc">Items at or below minimum level</p>
            </div>
            <Button onClick={() => go('/low-stock')}>Open Low Stock</Button>
          </header>
          {low.length + out.length === 0 ? (
            <p className="muted pad">All items are above minimum levels.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Part</th><th>Location</th><th className="num">Qty</th><th className="num">Min</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...out, ...low].slice(0, 8).map((p) => (
                  <tr key={p.id} className="row-link" onClick={() => go(`/part/${p.id}`)}>
                    <td>
                      <span className="mono">{p.partNumber}</span>
                      <span className="table-sub">{p.partName}</span>
                    </td>
                    <td className="muted">{locationString(p)}</td>
                    <td className="num strong">{p.quantity}</td>
                    <td className="num muted">{p.minimumStock}</td>
                    <td><StatusPill status={statusOf(p)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Recent activity */}
        <section className="card">
          <header className="card-head">
            <div>
              <h2 className="card-title">Recent Inventory Activity</h2>
              <p className="card-desc">Latest stock movements and edits</p>
            </div>
            <Button onClick={() => go('/activity')}>View All</Button>
          </header>
          <ul className="act-list">
            {activity.slice(0, 7).map((a) => (
              <li key={a.id}>
                <span className={`act-dot act-${a.action}`} aria-hidden />
                <div className="act-main">
                  <span className="act-line">
                    <strong>{a.partName}</strong> — {historyLine(a)}
                  </span>
                  <span className="act-meta">{a.user} · {formatDateTime(a.timestamp)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Recently added */}
        <section className="card">
          <header className="card-head">
            <div>
              <h2 className="card-title">Recently Added Parts</h2>
              <p className="card-desc">Latest SKUs onboarded</p>
            </div>
            <Button onClick={() => go('/add')}>+ Add Part</Button>
          </header>
          <table className="table">
            <thead>
              <tr><th>Part</th><th>Category</th><th>Location</th><th className="num">Qty</th><th>Added</th></tr>
            </thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.id} className="row-link" onClick={() => go(`/part/${p.id}`)}>
                  <td>
                    <span className="mono">{p.partNumber}</span>
                    <span className="table-sub">{p.partName}</span>
                  </td>
                  <td>{p.category}</td>
                  <td className="muted">{locationString(p)}</td>
                  <td className="num">{p.quantity}</td>
                  <td className="muted">{formatDateTime(p.dateAdded)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Category breakdown */}
        <section className="card">
          <header className="card-head">
            <div>
              <h2 className="card-title">Stock by Category</h2>
              <p className="card-desc">Parts count per category</p>
            </div>
          </header>
          <ul className="cat-list">
            {topCats.map(([cat, count]) => (
              <li key={cat}>
                <button onClick={() => go(`/inventory?category=${encodeURIComponent(cat)}`)}>
                  <span>{cat}</span>
                  <span className="cat-count">{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
