import { useState } from 'react';
import { useStore, setUser, type Role } from './useStore';
import { useDismiss } from './ui';

// Simple demo role switcher — stands in for auth in the prototype.
export function RoleBanner() {
  const { user } = useStore();
  const [open, setOpen] = useState(false);
  const menuRef = useDismiss<HTMLDivElement>(open, () => setOpen(false));

  const switchTo = (role: Role) => {
    setUser(role === 'admin'
      ? { name: 'R. Sharma', role: 'admin' }
      : { name: 'P. Verma', role: 'staff' });
    setOpen(false);
  };

  return (
    <div className="role-wrap" ref={menuRef}>
      <button className="role-btn" onClick={() => setOpen((v) => !v)} title="Switch demo role" aria-expanded={open} aria-haspopup="true">
        <span className="role-avatar" aria-hidden>{user.name.charAt(0)}</span>
        <span className="role-meta">
          <span className="role-name">{user.name}</span>
          <span className={`role-tag role-tag-${user.role}`}>{user.role.toUpperCase()}</span>
        </span>
        <span className="role-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="menu menu-right">
          <div className="menu-note">Demo role — switch to preview permissions:</div>
          <button className="menu-item" disabled={user.role === 'admin'} onClick={() => switchTo('admin')}>
            R. Sharma — Admin
          </button>
          <button className="menu-item" disabled={user.role === 'staff'} onClick={() => switchTo('staff')}>
            P. Verma — Staff
          </button>
        </div>
      )}
    </div>
  );
}

export function useCanEdit(): boolean {
  return useStore().user.role === 'admin';
}

export function StaffEditNote() {
  return (
    <div className="staff-note">
      You are signed in as <strong>Staff</strong>. Inventory editing (add/edit/move parts) is limited to
      Admin. <button className="link-btn" onClick={() => setUser({ name: 'R. Sharma', role: 'admin' })}>
        Switch to Admin
      </button>
    </div>
  );
}
