import { useState } from 'react';
import { useStore, createPart, nextQrCode, CATEGORIES, WAREHOUSES, type ProductFields, type InventoryFields } from '../useStore';
import { Button, Field, toast, usePageMeta } from '../ui';
import { QrImage } from '../qr';
import { useCanEdit, StaffEditNote } from '../auth';

const EMPTY_PRODUCT: ProductFields = {
  partNumber: '', partName: '', category: '', vehicleModel: '', description: '',
  supplier: '', supplierPartNumber: '', unitCost: 0, notes: '',
};
const EMPTY_INV: InventoryFields = {
  quantity: 0, minimumStock: 10, warehouse: WAREHOUSES[0], rack: '', shelf: '', bin: '', qrCode: '',
};

export function AddPartPage({ go }: { go: (p: string) => void }) {
  usePageMeta(
    'Add New Part',
    'Register a new automobile part into inventory — product details, opening stock, storage location, supplier and printable QR label.',
    '/#/add',
  );
  const canEdit = useCanEdit();
  const { parts } = useStore();
  const [product, setProduct] = useState<ProductFields>(EMPTY_PRODUCT);
  const [inv, setInv] = useState<InventoryFields>(EMPTY_INV);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [justSaved, setJustSaved] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <div className="page">
        <h1>Add New Part</h1>
        <StaffEditNote />
        <div className="empty">
          <h2>Permission required</h2>
          <p>Only Admin users can add new parts. Switch to the Admin role to continue.</p>
        </div>
      </div>
    );
  }

  const setP = (patch: Partial<ProductFields>) => setProduct((prev) => ({ ...prev, ...patch }));
  const setI = (patch: Partial<InventoryFields>) => setInv((prev) => ({ ...prev, ...patch }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!product.partName.trim()) e.partName = 'Part name is required.';
    if (!product.partNumber.trim()) e.partNumber = 'Part number is required.';
    else if (parts.some((x) => x.partNumber.toLowerCase() === product.partNumber.trim().toLowerCase())) {
      e.partNumber = 'This part number already exists.';
    }
    if (!product.category) e.category = 'Select a category.';
    if (product.unitCost < 0) e.unitCost = 'Cannot be negative.';
    if (inv.quantity < 0) e.quantity = 'Cannot be negative.';
    if (inv.minimumStock < 0) e.minimumStock = 'Cannot be negative.';
    if (!inv.rack.trim()) e.rack = 'Required';
    if (!inv.shelf.trim()) e.shelf = 'Required';
    if (!inv.bin.trim()) e.bin = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = (another: boolean) => {
    if (!validate()) {
      toast('err', 'Please fix the highlighted fields.');
      return;
    }
    const qr = inv.qrCode.trim() || nextQrCode(product.partNumber.trim());
    const created = createPart(
      { ...product, partNumber: product.partNumber.trim().toUpperCase() },
      { ...inv, rack: inv.rack.trim().toUpperCase(), shelf: inv.shelf.trim().toUpperCase(), bin: inv.bin.trim().toUpperCase(), qrCode: qr },
      'Manual entry (Add Part form)',
    );
    setJustSaved(`${created.partNumber} · ${created.id}`);
    toast('ok', `${created.partNumber} added to inventory (${created.quantity} units at ${created.warehouse} · ${created.rack} · ${created.shelf} · ${created.bin}).`);
    if (another) {
      setProduct({ ...EMPTY_PRODUCT, supplier: product.supplier, category: product.category });
      setInv({ ...EMPTY_INV, warehouse: inv.warehouse, minimumStock: inv.minimumStock });
      setErrors({});
      window.scrollTo(0, 0);
    } else {
      go(`/part/${created.id}`);
    }
  };

  const qrPreviewValue = inv.qrCode.trim() || (product.partNumber.trim() ? nextQrCode(product.partNumber) : '');

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Add New Part</h1>
          <p className="page-sub">Manually register a part into inventory. It becomes searchable and exportable immediately.</p>
        </div>
      </header>

      {justSaved && (
        <div className="banner banner-ok">
          ✓ Saved <strong className="mono">{justSaved}</strong>. The part is now in inventory —
          <button className="link-btn" onClick={() => go('/inventory')}> open Inventory</button> or continue below.
        </div>
      )}

      <form className="form-stack" onSubmit={(e) => { e.preventDefault(); save(false); }}>
        <section className="card">
          <header className="card-head">
            <div>
              <h2 className="card-title">Basic Information</h2>
              <p className="card-desc">Product identity and classification</p>
            </div>
          </header>
          <div className="card-body field-grid">
            <Field label="Part Name" required error={errors.partName}>
              <input value={product.partName} onChange={(e) => setP({ partName: e.target.value })} placeholder="Brake Pad Set — Front" />
            </Field>
            <Field label="Part Number / SKU" required error={errors.partNumber}>
              <input className="mono" value={product.partNumber} onChange={(e) => setP({ partNumber: e.target.value.toUpperCase() })} placeholder="BP-48291" />
            </Field>
            <Field label="Category" required error={errors.category}>
              <select value={product.category} onChange={(e) => setP({ category: e.target.value })}>
                <option value="">Select category…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Vehicle / Model" hint="e.g. Model X / Model Y">
              <input value={product.vehicleModel} onChange={(e) => setP({ vehicleModel: e.target.value })} placeholder="Model X / Model Y" />
            </Field>
            <Field label="Description" wide>
              <textarea rows={2} value={product.description} onChange={(e) => setP({ description: e.target.value })} placeholder="Short specification summary" />
            </Field>
          </div>
        </section>

        <section className="card">
          <header className="card-head">
            <div>
              <h2 className="card-title">Inventory</h2>
              <p className="card-desc">Opening stock and reorder level</p>
            </div>
          </header>
          <div className="card-body field-grid">
            <Field label="Initial Quantity" required error={errors.quantity}>
              <input type="number" min={0} value={inv.quantity} onChange={(e) => setI({ quantity: Number(e.target.value) })} />
            </Field>
            <Field label="Minimum Stock Level" required error={errors.minimumStock} hint="Low-stock alert triggers at or below this">
              <input type="number" min={0} value={inv.minimumStock} onChange={(e) => setI({ minimumStock: Number(e.target.value) })} />
            </Field>
          </div>
        </section>

        <section className="card">
          <header className="card-head">
            <div>
              <h2 className="card-title">Storage Location</h2>
              <p className="card-desc">Where this part lives in the warehouse</p>
            </div>
          </header>
          <div className="card-body field-grid">
            <Field label="Warehouse" required>
              <select value={inv.warehouse} onChange={(e) => setI({ warehouse: e.target.value })}>
                {WAREHOUSES.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </Field>
            <Field label="Rack" required error={errors.rack}>
              <input className="mono" value={inv.rack} onChange={(e) => setI({ rack: e.target.value.toUpperCase() })} placeholder="R-04" />
            </Field>
            <Field label="Shelf" required error={errors.shelf}>
              <input className="mono" value={inv.shelf} onChange={(e) => setI({ shelf: e.target.value.toUpperCase() })} placeholder="S-02" />
            </Field>
            <Field label="Bin" required error={errors.bin}>
              <input className="mono" value={inv.bin} onChange={(e) => setI({ bin: e.target.value.toUpperCase() })} placeholder="B-18" />
            </Field>
          </div>
        </section>

        <section className="card">
          <header className="card-head">
            <div>
              <h2 className="card-title">Supplier & Cost</h2>
              <p className="card-desc">Procurement details</p>
            </div>
          </header>
          <div className="card-body field-grid">
            <Field label="Supplier Name">
              <input value={product.supplier} onChange={(e) => setP({ supplier: e.target.value })} placeholder="ABC Auto Components" />
            </Field>
            <Field label="Supplier Part Number">
              <input className="mono" value={product.supplierPartNumber} onChange={(e) => setP({ supplierPartNumber: e.target.value })} placeholder="ABC-91042" />
            </Field>
            <Field label="Unit Cost (₹)" error={errors.unitCost}>
              <input type="number" min={0} value={product.unitCost} onChange={(e) => setP({ unitCost: Number(e.target.value) })} />
            </Field>
          </div>
        </section>

        <section className="card">
          <header className="card-head">
            <div>
              <h2 className="card-title">QR Code</h2>
              <p className="card-desc">Attach a printable label to the part or bin</p>
            </div>
          </header>
          <div className="card-body qr-gen-row">
            <div className="field-grid grow">
              <Field label="QR Code / Unique ID" hint="Leave blank to auto-generate from the part number">
                <input className="mono" value={inv.qrCode} onChange={(e) => setI({ qrCode: e.target.value.toUpperCase() })} placeholder={product.partNumber ? nextQrCode(product.partNumber) : 'QR-#####'} />
              </Field>
              <Field label="Notes" wide>
                <textarea rows={2} value={product.notes} onChange={(e) => setP({ notes: e.target.value })} placeholder="Handling, storage or ordering notes" />
              </Field>
            </div>
            {qrPreviewValue && (
              <div className="qr-preview">
                <QrImage value={qrPreviewValue} size={132} />
                <span className="mono-sm">{qrPreviewValue}</span>
                <span className="qr-hint">Preview — printable from the part page after saving</span>
              </div>
            )}
          </div>
        </section>

        <div className="form-actions">
          <Button type="button" onClick={() => go('/inventory')}>Cancel</Button>
          <Button type="button" onClick={() => save(true)}>Save & Add Another</Button>
          <Button type="submit" variant="primary">Save Part</Button>
        </div>
      </form>
    </div>
  );
}
