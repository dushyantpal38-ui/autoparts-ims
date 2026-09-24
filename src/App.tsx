import { useState } from 'react';
import { useStore, statusOf, LIVE_MODE } from './useStore';
import { RoleBanner, useCanEdit, StaffEditNote, LoginScreen } from './auth';
import { Toaster, ConfirmDialog, toast, usePageMeta } from './ui';
import { resetToSeed } from './core';
import { SEED_PARTS, SEED_ACTIVITY } from './seedData';
import { Dashboard } from './pages/Dashboard';
import { InventoryPage } from './pages/Inventory';
import { PartDetails } from './pages/PartDetails';
import { AddPartPage } from './pages/AddPart';
import { EditPartPage } from './pages/EditPart';
import { ScanPage } from './pages/Scan';
import { LowStockPage } from './pages/LowStock';
import { ActivityPage } from './pages/Activity';
import { NotFound } from './pages/NotFound';
import { usePath, parsePath } from './router';

const NAV = [
  { path: '/', label: 'Dashboard', icon: '▦' },
  { path: '/inventory', label: 'Inventory', icon: '☰' },
  { path: '/scan', label: 'Scan QR', icon: '⌗' },
  { path: '/add', label: 'Add Part', icon: '＋' },
  { path: '/low-stock', label: 'Low Stock', icon: '⚠' },
  { path: '/activity', label: 'Activity / History', icon: '⟲' },
];

export function App() {
  const [path, go] = usePath();
  const { parts } = useStore();
  const { base, id, query } = parsePath(path);
  const [confirmReset, setConfirmReset] = useState(false);
  const canEdit = useCanEdit();

  const { auth, remote } = useStore();
  const lowCount = parts.filter((p) => statusOf(p) === 'low_stock').length;

  // Live mode: gate the whole app behind Supabase auth.
  if (LIVE_MODE && auth === 'out') return <LoginScreen />;
  if (LIVE_MODE && auth === 'connecting') {
    return (
      <div className="login-shell">
        <div className="login-card card" style={{ textAlign: 'center' }}>
          <div className="scan-spinner" aria-label="Connecting" />
          <p>Connecting to inventory server…</p>
        </div>
      </div>
    );
  }

  let page: JSX.Element;
  switch (base) {
    case '/':
      page = <Dashboard go={go} />;
      break;
    case '/inventory':
      page = (
        <InventoryPage
          go={go}
          initialFilters={{
            status: query.get('status') ?? '',
            category: query.get('category') ?? '',
            q: query.get('q') ?? '',
          }}
        />
      );
      break;
    case '/part':
      page = <PartDetails go={go} id={id || (query.get('id') ?? '')} action={query.get('action')} />;
      break;
    case '/add':
      page = <AddPartPage go={go} />;
      break;
    case '/edit':
      page = <EditPartPage go={go} id={id || (query.get('id') ?? '')} />;
      break;
    case '/scan':
      page = <ScanPage go={go} prefill={query.get('qr') ?? ''} />;
      break;
    case '/low-stock':
      page = <LowStockPage go={go} />;
      break;
    case '/activity':
      page = <ActivityPage go={go} partId={query.get('part') ?? undefined} />;
      break;
    default:
      page = <NotFound go={go} />;
  }

  const navItem = (item: (typeof NAV)[number]) => {
    const active = base === item.path || (item.path === '/' && base === '/');
    return (
      <button
        key={item.path}
        className={`nav-item ${active ? 'active' : ''}`}
        onClick={() => go(item.path)}
        aria-current={active ? 'page' : undefined}
      >
        <span className="nav-icon" aria-hidden>{item.icon}</span>
        {item.label}
        {item.path === '/low-stock' && lowCount > 0 && (
          <span className="nav-badge">{lowCount}</span>
        )}
      </button>
    );
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>▦</span>
          <div className="brand-text">
            <span className="brand-name">AutoParts IMS</span>
            <span className="brand-sub">Warehouse Inventory</span>
          </div>
        </div>

        <nav className="nav" aria-label="Main navigation">
          {NAV.map(navItem)}
          {canEdit && (
            <button
              className={`nav-item nav-admin ${base === '/reports' ? 'active' : ''}`}
              onClick={() => go('/reports')}
            >
              <span className="nav-icon" aria-hidden>⇩</span>
              Reports / Export
            </button>
          )}
        </nav>

        <div className="sidebar-foot">
          {LIVE_MODE && (
            <div className="conn-indicator" title={remote === 'on' ? 'Live — synced with all devices' : 'Connection problem'}>
              <span className={`conn-dot conn-${remote}`} aria-hidden />
              {remote === 'on' ? 'Live · synced' : remote === 'error' ? 'Offline / error' : 'Connecting…'}
            </div>
          )}
          <RoleBanner />
        </div>
      </aside>

      <main className="main">
        {remote === 'error' && (
          <div className="banner banner-danger">Live connection error — showing cached data. Check your network and sign in again.</div>
        )}
        {!canEdit && <StaffEditNote />}
        {page}
      </main>

      <Toaster />
      {confirmReset && (
        <ConfirmDialog
          title="Reset demo data?"
          message="This discards all changes made in this session and restores the original sample inventory."
          confirmLabel="Reset data"
          danger
          onConfirm={() => {
            resetToSeed({ parts: SEED_PARTS, activity: SEED_ACTIVITY });
            setConfirmReset(false);
            toast('ok', 'Demo data reset to sample inventory.');
            go('/');
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
      {!LIVE_MODE && (
        <button className="reset-demo" onClick={() => setConfirmReset(true)} title="Restore sample data">
          Reset demo data
        </button>
      )}
    </div>
  );
}
