import { useState } from 'react';
import { useStore, setUser, LIVE_MODE, refreshFromServer, type Role } from './useStore';
import { signIn, signUp, signOut } from './backend';
import { useDismiss } from './ui';

// In demo mode this is the simple role switcher from the prototype.
// In live mode it is a real account menu (profile + sign out), and the
// LoginScreen below handles authentication.

export function RoleBanner() {
  const { user, remote } = useStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useDismiss<HTMLDivElement>(open, () => setOpen(false));

  const switchTo = (role: Role) => {
    setUser(role === 'admin'
      ? { name: 'R. Sharma', role: 'admin' }
      : { name: 'P. Verma', role: 'staff' });
    setOpen(false);
  };

  const doSignOut = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
    setOpen(false);
  };

  return (
    <div className="role-wrap" ref={menuRef}>
      <button className="role-btn" onClick={() => setOpen((v) => !v)} title={LIVE_MODE ? 'Account' : 'Switch demo role'} aria-expanded={open} aria-haspopup="true">
        <span className="role-avatar" aria-hidden>{user.name.charAt(0)}</span>
        <span className="role-meta">
          <span className="role-name">{user.name}</span>
          <span className={`role-tag role-tag-${user.role}`}>{user.role.toUpperCase()}</span>
        </span>
        <span className="role-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="menu menu-right">
          {LIVE_MODE ? (
            <>
              <div className="menu-note">Signed in via Supabase</div>
              <button className="menu-item" onClick={() => { void refreshFromServer(); setOpen(false); }}>
                ↻ Sync now
              </button>
              <button className="menu-item" disabled={busy} onClick={() => void doSignOut()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <div className="menu-note">Demo role — switch to preview permissions:</div>
              <button className="menu-item" disabled={user.role === 'admin'} onClick={() => switchTo('admin')}>
                R. Sharma — Admin
              </button>
              <button className="menu-item" disabled={user.role === 'staff'} onClick={() => switchTo('staff')}>
                P. Verma — Staff
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function useCanEdit(): boolean {
  const { user, remote } = useStore();
  if (LIVE_MODE && remote === 'on') return user.role === 'admin';
  return user.role === 'admin';
}

export function StaffEditNote() {
  const { remote } = useStore();
  if (LIVE_MODE && remote === 'on') {
    return (
      <div className="staff-note">
        You are signed in as <strong>Staff</strong>. Inventory editing (add/edit/move parts) is limited to
        Admin. Ask an administrator to promote your account in Supabase.
      </div>
    );
  }
  return (
    <div className="staff-note">
      You are signed in as <strong>Staff</strong>. Inventory editing (add/edit/move parts) is limited to
      Admin. <button className="link-btn" onClick={() => setUser({ name: 'R. Sharma', role: 'admin' })}>
        Switch to Admin
      </button>
    </div>
  );
}

// --------------------------------------------------------------------------- 
// Live-mode login screen. Rendered by App when auth state is 'out'.
// The first account ever created becomes Admin automatically (schema trigger).
// ---------------------------------------------------------------------------

export function LoginScreen() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    if (mode === 'up' && !name.trim()) { setError('Please enter your name.'); return; }
    setBusy(true);
    if (mode === 'in') {
      const res = await signIn(email.trim(), password);
      if (res.error) setError(res.error);
    } else {
      const res = await signUp(name.trim(), email.trim(), password);
      if (res.error) setError(res.error);
      else if (res.needsEmailConfirm) setInfo('Account created — check your email for a confirmation link, then sign in here.');
      // on successful immediate sign-in, onAuthChange flips the store
    }
    setBusy(false);
  };

  return (
    <div className="login-shell">
      <form className="card login-card" onSubmit={(e) => void submit(e)}>
        <div className="brand login-brand">
          <span className="brand-mark" aria-hidden>▦</span>
          <div className="brand-text">
            <span className="brand-name">AutoParts IMS</span>
            <span className="brand-sub">Warehouse Inventory</span>
          </div>
        </div>

        <h1>{mode === 'in' ? 'Sign in' : 'Create account'}</h1>
        <p className="login-sub">
          {mode === 'in'
            ? 'Use your work email to access live inventory.'
            : 'The first account created becomes the Admin.'}
        </p>

        {mode === 'up' && (
          <label className="field">
            <span className="field-label">Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Priya Verma" />
          </label>
        )}
        <label className="field">
          <span className="field-label">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com" />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} placeholder="••••••••" />
        </label>

        {error && <div className="banner banner-danger">{error}</div>}
        {info && <div className="banner banner-ok">{info}</div>}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="link-btn login-toggle" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(''); setInfo(''); }}>
          {mode === 'in' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
