import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useStore, statusOf, locationString, WAREHOUSES, STOCK_REASONS_IN, STOCK_REASONS_OUT,
  type Part,
} from './useStore';
import { Button, Field, Modal, StatusPill } from './ui';

// ------------------------------------------------------------- stock change

export function StockModal({ mode, part, onClose, onSubmit }: {
  mode: 'add' | 'remove';
  part: Part;
  onClose: () => void;
  onSubmit: (qty: number, reason: string, note: string) => void;
}) {
  const adding = mode === 'add';
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const q = Math.max(0, Math.floor(Number(qty) || 0));
  const resulting = adding ? part.quantity + q : part.quantity - q;
  const overRemove = !adding && q > part.quantity;

  const submit = () => {
    if (q <= 0) { setErr('Enter a quantity greater than 0.'); return; }
    if (overRemove) { setErr(`Cannot remove more than the available ${part.quantity} units.`); return; }
    if (!reason) { setErr(adding ? 'Select a source / reason.' : 'Select a reason for removal.'); return; }
    onSubmit(q, reason, note.trim());
  };

  const reasons = adding ? STOCK_REASONS_IN : STOCK_REASONS_OUT;

  return (
    <Modal
      title={adding ? `Add Stock — ${part.partNumber}` : `Remove Stock — ${part.partNumber}`}
      onClose={onClose}
    >
      <div className="stock-summary">
        <div>
          <span className="stat-label">{part.partName}</span>
          <span className="mono-sm">{locationString(part)}</span>
        </div>
        <div className="stock-math">
          <span>{part.quantity}</span>
          <span className="stock-op">{adding ? '+' : '−'}</span>
          <strong className={adding ? 'op-plus' : 'op-minus'}>{q || 0}</strong>
          <span className="stock-op">=</span>
          <strong className={overRemove ? 'op-invalid' : ''}>{resulting}</strong>
        </div>
      </div>

      <Field label={adding ? 'Quantity to add' : 'Quantity removed'} required>
        <input
          type="number" min={1} step={1} value={qty} autoFocus
          onChange={(e) => { setQty(e.target.value); setErr(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
      </Field>

      <Field label={adding ? 'Reason / source' : 'Reason'} required>
        <select value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }}>
          <option value="">Select reason…</option>
          {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>

      <Field label="Note (optional)" wide>
        <textarea
          rows={2} value={note} placeholder="e.g. PO number, job card, bin recount…"
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      {overRemove && (
        <p className="form-error">Only {part.quantity} unit{part.quantity === 1 ? '' : 's'} available — reduce the quantity.</p>
      )}
      {err && <p className="form-error">{err}</p>}

      <div className="modal-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant={adding ? 'primary' : 'danger'} onClick={submit}>
          {adding ? `Add ${q || ''} Unit${q === 1 ? '' : 's'}` : `Remove ${q || ''} Unit${q === 1 ? '' : 's'}`}
        </Button>
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------- move modal

export function MoveModal({ part, onClose, onConfirm }: {
  part: Part;
  onClose: () => void;
  onConfirm: (dest: { warehouse: string; rack: string; shelf: string; bin: string }, reason: string, note: string) => void;
}) {
  const [warehouse, setWarehouse] = useState(part.warehouse);
  const [rack, setRack] = useState(part.rack);
  const [shelf, setShelf] = useState(part.shelf);
  const [bin, setBin] = useState(part.bin);
  const [reason, setReason] = useState('Rack reorganisation');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const unchanged = warehouse === part.warehouse && rack === part.rack && shelf === part.shelf && bin === part.bin;

  return (
    <Modal title={`Move Part — ${part.partNumber}`} onClose={onClose} width={560}>
      <div className="move-current">
        <span className="stat-label">Current</span>
        <span className="mono">{locationString(part)}</span>
      </div>

      <div className="field-grid">
        <Field label="Warehouse" required>
          <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
            {WAREHOUSES.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>
        <Field label="Rack" required>
          <input value={rack} onChange={(e) => setRack(e.target.value.toUpperCase())} placeholder="R-07" />
        </Field>
        <Field label="Shelf" required>
          <input value={shelf} onChange={(e) => setShelf(e.target.value.toUpperCase())} placeholder="S-01" />
        </Field>
        <Field label="Bin" required>
          <input value={bin} onChange={(e) => setBin(e.target.value.toUpperCase())} placeholder="B-04" />
        </Field>
      </div>

      <Field label="Reason" required>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option>Rack reorganisation</option>
          <option>Bin consolidation</option>
          <option>Damage / inspection hold</option>
          <option>Space optimisation</option>
          <option>Other</option>
        </select>
      </Field>

      <Field label="Note (optional)" wide>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {err && <p className="form-error">{err}</p>}

      <div className="modal-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={unchanged}
          onClick={() => {
            if (!rack.trim() || !shelf.trim() || !bin.trim()) { setErr('Rack, shelf and bin are required.'); return; }
            onConfirm({ warehouse, rack: rack.trim(), shelf: shelf.trim(), bin: bin.trim() }, reason, note.trim());
          }}
        >
          Confirm Move
        </Button>
      </div>
    </Modal>
  );
}

// -------------------------------------------------- quick part search (scan)

export function PartSearchPicker({ onSelect }: { onSelect: (p: Part) => void }) {
  const { parts } = useStore();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return parts.slice(0, 8);
    return parts.filter((p) =>
      [p.partNumber, p.partName, p.qrCode, p.id].join(' ').toLowerCase().includes(s),
    ).slice(0, 8);
  }, [parts, q]);

  return (
    <div className="picker">
      <input
        ref={inputRef}
        className="search-input"
        placeholder="Type part number, name or QR code…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) onSelect(results[0]);
        }}
      />
      <ul className="picker-list">
        {results.map((p) => (
          <li key={p.id}>
            <button onClick={() => onSelect(p)}>
              <span className="mono">{p.partNumber}</span>
              <span className="picker-name">{p.partName}</span>
              <span className="picker-side">
                <span className="mono-sm">{p.qrCode}</span>
                <StatusPill status={statusOf(p)} />
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="picker-empty">No matching parts.</li>}
      </ul>
    </div>
  );
}
