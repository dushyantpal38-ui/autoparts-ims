import { useMemo, useState } from 'react';
import { useStore, statusOf, locationString } from '../useStore';
import { Button, StatusPill, formatDateTime, formatMoney, toast, ConfirmDialog, usePageMeta } from '../ui';
import { QrImage } from '../qr';
import { addStock, removeStock, movePart, deletePart } from '../useStore';
import { useCanEdit } from '../auth';
import { StockModal, MoveModal } from '../modals';
import type { Activity } from '../core';

export function PartDetails({ go, id, action }: { go: (p: string) => void; id: string; action?: string | null }) {
  const { parts, activity } = useStore();
  const part = parts.find((p) => p.id === id);
  const canEdit = useCanEdit();
  const [modal, setModal] = useState<null | 'add' | 'remove' | 'move' | 'delete'>(null);
  const [showQr, setShowQr] = useState(false);

  const partActivity = useMemo(() => activity.filter((a) => a.partId === id), [activity, id]);

  usePageMeta(
    part ? `${part.partName} (${part.partNumber})` : 'Part Not Found',
    part
      ? `Stock, storage location, supplier and full history for ${part.partName} — ${part.partNumber} in AutoParts IMS.`
      : 'This part does not exist in the inventory.',
    part ? `/#/part/${part.id}` : undefined,
  );

  if (!part) {
    return (
      <div className="page">
        <div className="empty">
          <h2>Part not found</h2>
          <p>The part you are looking for does not exist or was deleted.</p>
          <Button variant="primary" onClick={() => go('/inventory')}>Back to Inventory</Button>
        </div>
      </div>
    );
  }

  const status = statusOf(part);
  const lowWarn = status === 'low_stock' || status === 'out_of_stock';

  return (
    <div className="page">
      <div className="breadcrumb">
        <button onClick={() => go('/inventory')}>Inventory</button>
        <span>/</span>
        <span className="mono">{part.partNumber}</span>
      </div>

      <header className="page-head">
        <div>
          <div className="title-row">
            <h1>{part.partName}</h1>
            <StatusPill status={status} />
          </div>
          <p className="page-sub">
            <span className="mono">{part.partNumber}</span> · {part.category} · {part.vehicleModel}
          </p>
        </div>
        <div className="page-actions">
          {canEdit && (
            <>
              <Button onClick={() => setModal('move')}>Move Location</Button>
              <Button onClick={() => go(`/part/${part.id}?action=edit`)}>Edit Part</Button>
              <Button variant="danger" onClick={() => setModal('delete')}>Delete</Button>
            </>
          )}
          <Button onClick={() => setShowQr((v) => !v)}>View QR</Button>
        </div>
      </header>

      {lowWarn && (
        <div className={`banner ${status === 'out_of_stock' ? 'banner-danger' : 'banner-warn'}`}>
          {status === 'out_of_stock'
            ? 'This part is out of stock. Raise a purchase order with the supplier.'
            : `Stock is at or below the minimum level (${part.quantity} ≤ ${part.minimumStock}). Reorder soon.`}
        </div>
      )}

      <div className="detail-grid">
        {/* Summary panel */}
        <section className="card">
          <div className="qty-hero">
            <div>
              <span className="stat-label">Available</span>
              <span className="qty-hero-num">{part.quantity} <small>units</small></span>
              <span className="qty-hero-min">Minimum stock: {part.minimumStock}</span>
            </div>
            <div className="qty-hero-actions">
              <Button variant="primary" onClick={() => setModal('add')}>+ Add Stock</Button>
              <Button
                variant="danger"
                disabled={part.quantity === 0}
                title={part.quantity === 0 ? 'Nothing to remove' : undefined}
                onClick={() => setModal('remove')}
              >
                − Remove Stock
              </Button>
            </div>
          </div>
          <dl className="dl">
            <div><dt>Status</dt><dd><StatusPill status={status} /></dd></div>
            <div><dt>Storage location</dt><dd className="mono">{locationString(part)}</dd></div>
            <div><dt>Rack / Shelf / Bin</dt><dd className="mono">{part.rack} / {part.shelf} / {part.bin}</dd></div>
            <div><dt>Supplier</dt><dd>{part.supplier}</dd></div>
            <div><dt>Supplier part no.</dt><dd className="mono">{part.supplierPartNumber || '—'}</dd></div>
            <div><dt>Unit cost</dt><dd>{formatMoney(part.unitCost)}</dd></div>
            <div><dt>Stock value</dt><dd>{formatMoney(part.quantity * part.unitCost)}</dd></div>
            <div><dt>Date added</dt><dd>{formatDateTime(part.dateAdded)}</dd></div>
            <div><dt>Last updated</dt><dd>{formatDateTime(part.lastUpdated)}</dd></div>
            <div><dt>QR code</dt><dd className="mono">{part.qrCode}</dd></div>
            <div><dt>Inventory ID</dt><dd className="mono">{part.id}</dd></div>
          </dl>
          {(part.description || part.notes) && (
            <div className="notes-block">
              {part.description && <><h4>Description</h4><p>{part.description}</p></>}
              {part.notes && <><h4>Notes</h4><p>{part.notes}</p></>}
            </div>
          )}
        </section>

        {/* Side column: QR + history */}
        <div className="detail-side">
          {showQr && (
            <section className="card qr-card">
              <h2 className="card-title">Part QR Code</h2>
              <QrImage value={part.qrCode} size={180} />
              <p className="qr-meta mono">{part.qrCode}</p>
              <p className="qr-hint">Print this label and attach it to the part or bin for scanner lookup.</p>
              <div className="qr-actions">
                <Button onClick={() => window.print()}>Print Label</Button>
                <Button onClick={() => go(`/scan?qr=${encodeURIComponent(part.qrCode)}`)}>Test Scan</Button>
              </div>
            </section>
          )}

          <section className="card">
            <header className="card-head">
              <h2 className="card-title">Recent History</h2>
              <Button onClick={() => go(`/activity?part=${part.id}`)}>View All</Button>
            </header>
            {partActivity.length === 0 ? (
              <p className="muted pad">No recorded activity yet.</p>
            ) : (
              <ul className="act-list">
                {partActivity.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <span className={`act-dot act-${a.action}`} aria-hidden />
                    <div className="act-main">
                      <span className="act-line">{historyLine(a)}</span>
                      <span className="act-meta">{a.user} · {formatDateTime(a.timestamp)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Modals */}
      {modal === 'add' && (
        <StockModal
          mode="add"
          part={part}
          onClose={() => setModal(null)}
          onSubmit={(qty, reason, note) => {
            addStock(part.id, qty, reason, note);
            setModal(null);
            toast('ok', `Added ${qty} unit${qty === 1 ? '' : 's'} to ${part.partNumber}.`);
          }}
        />
      )}
      {modal === 'remove' && (
        <StockModal
          mode="remove"
          part={part}
          onClose={() => setModal(null)}
          onSubmit={(qty, reason, note) => {
            removeStock(part.id, qty, reason, note);
            setModal(null);
            toast('ok', `Removed ${qty} unit${qty === 1 ? '' : 's'} from ${part.partNumber}.`);
          }}
        />
      )}
      {modal === 'move' && (
        <MoveModal
          part={part}
          onClose={() => setModal(null)}
          onConfirm={(dest, reason, note) => {
            movePart(part.id, dest, reason, note);
            setModal(null);
            toast('ok', `${part.partNumber} moved to ${dest.warehouse} · ${dest.rack} · ${dest.shelf} · ${dest.bin}`);
          }}
        />
      )}
      {modal === 'delete' && (
        <ConfirmDialog
          title="Delete part?"
          message={
            <>
              This permanently removes <strong>{part.partName}</strong> ({part.partNumber}) and its
              {' '}{part.quantity} units from inventory. The deletion is recorded in history.
            </>
          }
          confirmLabel="Delete part"
          danger
          onConfirm={() => {
            deletePart(part.id, 'Deleted from part details page');
            setModal(null);
            toast('ok', `${part.partNumber} deleted from inventory.`);
            go('/inventory');
          }}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}

export function historyLine(a: Activity): string {
  switch (a.action) {
    case 'stock_in': return `+${a.delta} units (now ${a.newQty})`;
    case 'stock_out': return `${a.delta} units (now ${a.newQty})`;
    case 'adjustment': return `adjusted ${a.delta! > 0 ? '+' : ''}${a.delta} (now ${a.newQty})`;
    case 'location_change': return `moved ${a.prevLocation} → ${a.newLocation}`;
    case 'part_created': return a.summary ?? 'part created';
    case 'part_updated': return a.summary ?? 'details updated';
    case 'min_stock_changed': return a.summary ?? 'minimum stock changed';
    case 'part_deleted': return a.summary ?? 'part deleted';
    default: return '';
  }
}
