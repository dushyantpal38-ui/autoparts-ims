import { useEffect, useRef, useState, type ReactNode } from 'react';
import { statusLabel, type StockStatus } from './useStore';

// ---------------------------------------------------------------- status pill

export function StatusPill({ status }: { status: StockStatus }) {
  const cls =
    status === 'out_of_stock' ? 'pill pill-out' : status === 'low_stock' ? 'pill pill-low' : 'pill pill-in';
  return <span className={cls}>{statusLabel(status)}</span>;
}

// ------------------------------------------------------------------- buttons

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  variant = 'secondary', className = '', children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...rest}>
      {children}
    </button>
  );
}

// --------------------------------------------------------------------- forms

export function Field({ label, children, hint, required, wide, error }: {
  label: string; children: ReactNode; hint?: string; required?: boolean; wide?: boolean; error?: string;
}) {
  return (
    <label className={`field ${wide ? 'field-wide' : ''}`}>
      <span className="field-label">
        {label}{required && <em>*</em>}
      </span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function SectionCard({ title, desc, children, right }: {
  title: string; desc?: string; children: ReactNode; right?: ReactNode;
}) {
  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2 className="card-title">{title}</h2>
          {desc && <p className="card-desc">{desc}</p>}
        </div>
        {right}
      </header>
      <div className="card-body">{children}</div>
    </section>
  );
}

// --------------------------------------------------------------------- modal

export function Modal({ title, onClose, children, width = 520 }: {
  title: string; onClose: () => void; children: ReactNode; width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
    </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: {
  title: string; message: ReactNode; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel} width={460}>
      <p className="confirm-msg">{message}</p>
      <div className="modal-actions">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

// -------------------------------------------------------------------- toasts

type Toast = { id: number; kind: 'ok' | 'warn' | 'err'; text: string };
let toastSeq = 1;

const toastListeners: Array<(t: Toast[]) => void> = [];
let toasts: Toast[] = [];

export function toast(kind: Toast['kind'], text: string) {
  const t = { id: toastSeq++, kind, text };
  toasts = [...toasts, t];
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l(toasts));
  }, 3400);
}

export function Toaster() {
  const [list, setList] = useState<Toast[]>(toasts);
  useEffect(() => {
    const l = (t: Toast[]) => setList([...t]);
    toastListeners.push(l);
    return () => {
      const i = toastListeners.indexOf(l);
      if (i >= 0) toastListeners.splice(i, 1);
    };
  }, []);
  return (
    <div className="toaster" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
      ))}
    </div>
  );
}

// --------------------------------------------------------------- empty state

export function EmptyState({ title, message, action }: {
  title: string; message: string; action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark" aria-hidden>▦</div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- small bits

export function formatMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yest = new Date(today.getTime() - 86400_000).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (sameDay) return `Today, ${time}`;
  if (yest) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${time}`;
}

// ------------------------------------------------------------- page meta

const SITE = 'AutoParts IMS';
const SITE_URL = 'https://autoparts-ims.vercel.app';

/** Per-view document title, meta description and Open Graph tags. */
export function usePageMeta(title: string, description?: string, canonicalPath?: string) {
  useEffect(() => {
    document.title = title.includes(SITE) ? title : `${title} — ${SITE}`;

    const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
      setMeta('name', 'twitter:description', description);
    }
    setMeta('property', 'og:title', document.title);
    setMeta('name', 'twitter:title', document.title);
    setMeta('property', 'og:url', SITE_URL + (canonicalPath ?? '/'));

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = SITE_URL + (canonicalPath ?? '/');
  }, [title, description, canonicalPath]);
}

/** Close a dropdown/popover on outside click or Escape. */
export function useDismiss<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}
