import { useEffect, useMemo, useState } from 'react';
import {
  useStore, statusOf, locationString, CATEGORIES, WAREHOUSES,
} from '../useStore';
import { Button, StatusPill, EmptyState, formatDateTime, usePageMeta, useDismiss } from '../ui';
import { exportParts } from '../export';

type SortKey =
  | 'partNumber' | 'partName' | 'category' | 'vehicleModel' | 'quantity'
  | 'minimumStock' | 'location' | 'supplier' | 'status' | 'lastUpdated';

interface Filters {
  q: string;
  category: string;
  location: string;
  status: string;
  supplier: string;
}

const PAGE_SIZE = 12;

export function InventoryPage({ go, initialFilters }: { go: (p: string) => void; initialFilters?: Partial<Filters> }) {
  usePageMeta(
    'Inventory',
    'Search, filter and sort the full automobile parts catalogue — quantities, storage locations, suppliers and stock status at a glance.',
    '/#/inventory',
  );
  const { parts } = useStore();
  const suppliers = useMemo(
    () => [...new Set(parts.map((p) => p.supplier))].sort(),
    [parts],
  );
  const [f, setF] = useState<Filters>({
    q: '', category: '', location: '', status: '', supplier: '',
    ...initialFilters,
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'partNumber', dir: 'asc' });
  const [page, setPage] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const exportMenuRef = useDismiss<HTMLDivElement>(showExport, () => setShowExport(false));

  useEffect(() => {
    if (initialFilters) setF((prev) => ({ ...prev, ...initialFilters }));
  }, [initialFilters]);

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    let list = parts.filter((p) => {
      if (q) {
        const hay = [
          p.partNumber, p.partName, p.qrCode, p.id, p.vehicleModel, p.supplier,
          p.warehouse, p.rack, p.shelf, p.bin, p.category, p.supplierPartNumber,
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (f.category && p.category !== f.category) return false;
      if (f.location && p.warehouse !== f.location) return false;
      if (f.supplier && p.supplier !== f.supplier) return false;
      if (f.status) {
        const st = statusOf(p);
        if (f.status === 'low_stock' && st === 'in_stock') return false;
        if (f.status === 'in_stock' && st !== 'in_stock') return false;
        if (f.status === 'out_of_stock' && st !== 'out_of_stock') return false;
      }
      return true;
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    const key = sort.key;
    list = [...list].sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (key) {
        case 'location': av = locationString(a); bv = locationString(b); break;
        case 'status': av = statusOf(a); bv = statusOf(b); break;
        default: av = a[key] as string | number; bv = b[key] as string | number;
      }
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return list;
  }, [parts, f, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const rows = filtered.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const setF2 = (patch: Partial<Filters>) => {
    setF((prev) => ({ ...prev, ...patch }));
    setPage(0);
  };

  const exportCurrent = () => exportParts(filtered, `inventory-filtered-${new Date().toISOString().slice(0, 10)}`);
  const exportAll = () => exportParts(parts, `inventory-all-${new Date().toISOString().slice(0, 10)}`);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Inventory</h1>
          <p className="page-sub">
            {filtered.length} of {parts.length} parts shown
            {(f.q || f.category || f.location || f.status || f.supplier) ? ' (filtered)' : ''}
          </p>
        </div>
        <div className="page-actions">
          <div className="export-wrap" ref={exportMenuRef}>
            <Button onClick={() => setShowExport((v) => !v)} aria-expanded={showExport} aria-haspopup="true">Export Excel ▾</Button>
            {showExport && (
              <div className="menu">
                <button className="menu-item" onClick={() => { exportAll(); setShowExport(false); }}>
                  Export All Parts
                </button>
                <button className="menu-item" onClick={() => { exportCurrent(); setShowExport(false); }}>
                  Export Current Filter ({filtered.length})
                </button>
              </div>
            )}
          </div>
          <Button variant="primary" onClick={() => go('/add')}>+ Add Part</Button>
        </div>
      </header>

      {/* Filter bar */}
      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="Search part no., name, QR, vehicle, supplier, rack, bin…"
          value={f.q}
          onChange={(e) => setF2({ q: e.target.value })}
        />
        <select value={f.category} onChange={(e) => setF2({ category: e.target.value })}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={f.location} onChange={(e) => setF2({ location: e.target.value })}>
          <option value="">All Warehouses</option>
          {WAREHOUSES.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <select value={f.status} onChange={(e) => setF2({ status: e.target.value })}>
          <option value="">All Statuses</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
        <select value={f.supplier} onChange={(e) => setF2({ supplier: e.target.value })}>
          <option value="">All Suppliers</option>
          {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(f.q || f.category || f.location || f.status || f.supplier) && (
          <button className="clear-filters" onClick={() => setF2({ q: '', category: '', location: '', status: '', supplier: '' })}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No parts found"
          message="No inventory items match the current search or filters. Adjust the filters or add a new part."
          action={<Button variant="primary" onClick={() => go('/add')}>+ Add Part</Button>}
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table table-inventory">
              <thead>
                <tr>
                  <th aria-sort={sort.key === 'partNumber' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}><button className="th-sort" onClick={() => toggleSort('partNumber')}>Part Number{arrow('partNumber')}</button></th>
                  <th aria-sort={sort.key === 'partName' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}><button className="th-sort" onClick={() => toggleSort('partName')}>Part Name{arrow('partName')}</button></th>
                  <th aria-sort={sort.key === 'category' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}><button className="th-sort" onClick={() => toggleSort('category')}>Category{arrow('category')}</button></th>
                  <th aria-sort={sort.key === 'vehicleModel' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}><button className="th-sort" onClick={() => toggleSort('vehicleModel')}>Vehicle/Model{arrow('vehicleModel')}</button></th>
                  <th aria-sort={sort.key === 'quantity' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} className="num"><button className="th-sort" onClick={() => toggleSort('quantity')}>Qty{arrow('quantity')}</button></th>
                  <th aria-sort={sort.key === 'minimumStock' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} className="num"><button className="th-sort" onClick={() => toggleSort('minimumStock')}>Min{arrow('minimumStock')}</button></th>
                  <th aria-sort={sort.key === 'location' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}><button className="th-sort" onClick={() => toggleSort('location')}>Location{arrow('location')}</button></th>
                  <th aria-sort={sort.key === 'supplier' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}><button className="th-sort" onClick={() => toggleSort('supplier')}>Supplier{arrow('supplier')}</button></th>
                  <th aria-sort={sort.key === 'status' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}><button className="th-sort" onClick={() => toggleSort('status')}>Status{arrow('status')}</button></th>
                  <th aria-sort={sort.key === 'lastUpdated' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}><button className="th-sort" onClick={() => toggleSort('lastUpdated')}>Last Updated{arrow('lastUpdated')}</button></th>
                  <th className="num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="row-link" onClick={() => go(`/part/${p.id}`)}>
                    <td className="mono strong">{p.partNumber}</td>
                    <td>
                      <span className="cell-main">{p.partName}</span>
                      <span className="table-sub mono">{p.qrCode}</span>
                    </td>
                    <td>{p.category}</td>
                    <td className="muted">{p.vehicleModel}</td>
                    <td className="num strong">{p.quantity}</td>
                    <td className="num muted">{p.minimumStock}</td>
                    <td className="mono-sm">{locationString(p)}</td>
                    <td className="muted">{p.supplier}</td>
                    <td><StatusPill status={statusOf(p)} /></td>
                    <td className="muted nowrap">{formatDateTime(p.lastUpdated)}</td>
                    <td className="num row-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="icon-btn" title="Add stock" onClick={() => go(`/part/${p.id}?action=add`)}>＋</button>
                      <button className="icon-btn" title="Remove stock" onClick={() => go(`/part/${p.id}?action=remove`)}>－</button>
                      <button className="icon-btn" title="Edit part" onClick={() => go(`/part/${p.id}?action=edit`)}>✎</button>
                    </td>
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

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }
  function arrow(key: SortKey) {
    return sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
  }
}
