import { useStore, statusOf } from '../useStore';
import { Button, EmptyState, formatDateTime, formatMoney, usePageMeta } from '../ui';
import { exportParts } from '../export';
import { useCanEdit, StaffEditNote } from '../auth';

export function ReportsPage({ go }: { go: (p: string) => void }) {
  usePageMeta(
    'Reports / Export',
    'Download inventory reports as Excel spreadsheets — full catalogue, low-stock list or per-warehouse extracts.',
    '/#/reports',
  );
  const canEdit = useCanEdit();
  const { parts, activity } = useStore();

  if (!canEdit) {
    return (
      <div className="page">
        <h1>Reports / Export</h1>
        <StaffEditNote />
        <div className="empty">
          <h2>Permission required</h2>
          <p>Data export is limited to Admin users.</p>
        </div>
      </div>
    );
  }

  const totalUnits = parts.reduce((a, p) => a + p.quantity, 0);
  const totalValue = parts.reduce((a, p) => a + p.quantity * p.unitCost, 0);
  const low = parts.filter((p) => statusOf(p) === 'low_stock');
  const out = parts.filter((p) => statusOf(p) === 'out_of_stock');

  const byCategory = new Map<string, { parts: number; units: number; value: number }>();
  for (const p of parts) {
    const cur = byCategory.get(p.category) ?? { parts: 0, units: 0, value: 0 };
    cur.parts += 1;
    cur.units += p.quantity;
    cur.value += p.quantity * p.unitCost;
    byCategory.set(p.category, cur);
  }

  const last7 = activity.filter((a) => Date.now() - new Date(a.timestamp).getTime() < 7 * 86400_000);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Reports / Export</h1>
          <p className="page-sub">Inventory snapshot and data export</p>
        </div>
      </header>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">Total Parts</span>
          <span className="stat-value">{parts.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Total Units</span>
          <span className="stat-value">{totalUnits.toLocaleString('en-IN')}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Stock Value</span>
          <span className="stat-value stat-value-sm">{formatMoney(totalValue)}</span>
        </div>
        <div className="stat stat-warn">
          <span className="stat-label">Low / Out of Stock</span>
          <span className="stat-value">{low.length + out.length}</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="card">
          <header className="card-head">
            <div>
              <h2 className="card-title">Exports</h2>
              <p className="card-desc">Download Excel-compatible .xlsx files</p>
            </div>
          </header>
          <div className="report-actions">
            <div className="report-row">
              <div>
                <strong>Full inventory export</strong>
                <span className="table-sub">All {parts.length} parts with cost, location, status and timestamps</span>
              </div>
              <Button variant="primary" onClick={() => exportParts(parts, `inventory-all-${new Date().toISOString().slice(0, 10)}`)}>
                Export Excel
              </Button>
            </div>
            <div className="report-row">
              <div>
                <strong>Low stock report</strong>
                <span className="table-sub">{low.length + out.length} items needing attention</span>
              </div>
              <Button onClick={() => exportParts([...out, ...low], 'low-stock-report')}>Export List</Button>
            </div>
            <div className="report-row">
              <div>
                <strong>Warehouse A</strong>
                <span className="table-sub">{parts.filter((p) => p.warehouse === 'Warehouse A').length} parts</span>
              </div>
              <Button onClick={() => exportParts(parts.filter((p) => p.warehouse === 'Warehouse A'), 'inventory-warehouse-a')}>Export</Button>
            </div>
            <div className="report-row">
              <div>
                <strong>Warehouse B</strong>
                <span className="table-sub">{parts.filter((p) => p.warehouse === 'Warehouse B').length} parts</span>
              </div>
              <Button onClick={() => exportParts(parts.filter((p) => p.warehouse === 'Warehouse B'), 'inventory-warehouse-b')}>Export</Button>
            </div>
          </div>
        </section>

        <section className="card">
          <header className="card-head">
            <div>
              <h2 className="card-title">Stock Value by Category</h2>
              <p className="card-desc">Where the capital sits</p>
            </div>
          </header>
          <table className="table">
            <thead>
              <tr><th>Category</th><th className="num">Parts</th><th className="num">Units</th><th className="num">Value</th></tr>
            </thead>
            <tbody>
              {[...byCategory.entries()].sort((a, b) => b[1].value - a[1].value).map(([cat, v]) => (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td className="num">{v.parts}</td>
                  <td className="num">{v.units}</td>
                  <td className="num">{formatMoney(v.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <header className="card-head">
            <div>
              <h2 className="card-title">Last 7 Days</h2>
              <p className="card-desc">{last7.length} recorded actions</p>
            </div>
            <Button onClick={() => go('/activity')}>Open Activity Log</Button>
          </header>
          <p className="muted pad">
            Most recent entry: {activity[0]
              ? <>{activity[0].partNumber} — {activity[0].reason} ({formatDateTime(activity[0].timestamp)})</>
              : 'no activity yet'}
          </p>
        </section>
      </div>
    </div>
  );
}
