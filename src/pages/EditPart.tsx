import { useState } from 'react';
import {
  useStore, updateProduct, updateInventory, CATEGORIES, WAREHOUSES,
  type ProductFields, type InventoryFields,
} from '../useStore';
import { Button, Field, toast, usePageMeta } from '../ui';
import { useCanEdit, StaffEditNote } from '../auth';

export function EditPartPage({ go, id }: { go: (p: string) => void; id: string }) {
  usePageMeta(
    'Edit Part',
    'Update product and inventory information for an existing part — every change is recorded in the audit history.',
  );
  const canEdit = useCanEdit();
  const { parts } = useStore();
  const part = parts.find((p) => p.id === id);

  const [product, setProduct] = useState<ProductFields | null>(null);
  const [inv, setInv] = useState<InventoryFields | null>(null);

  if (!canEdit) {
    return (
      <div className="page">
        <h1>Edit Part</h1>
        <StaffEditNote />
        <div className="empty">
          <h2>Permission required</h2>
          <p>Only Admin users can edit part records. Switch to the Admin role to continue.</p>
        </div>
      </div>
    );
  }

  if (!part) {
    return (
      <div className="page">
        <div className="empty">
          <h2>Part not found</h2>
          <p>This part does not exist or was deleted.</p>
          <Button variant="primary" onClick={() => go('/inventory')}>Back to Inventory</Button>
        </div>
      </div>
    );
  }

  // Lazy-init editable copies from the stored part.
  if (!product || !inv) {
    setProduct({
      partNumber: part.partNumber,
      partName: part.partName,
      category: part.category,
      vehicleModel: part.vehicleModel,
      description: part.description,
      supplier: part.supplier,
      supplierPartNumber: part.supplierPartNumber,
      unitCost: part.unitCost,
      notes: part.notes,
    });
    setInv({
      quantity: part.quantity,
      minimumStock: part.minimumStock,
      warehouse: part.warehouse,
      rack: part.rack,
      shelf: part.shelf,
      bin: part.bin,
      qrCode: part.qrCode,
    });
    return null;
  }

  const setP = (patch: Partial<ProductFields>) => setProduct((prev) => ({ ...prev!, ...patch }));
  const setI = (patch: Partial<InventoryFields>) => setInv((prev) => ({ ...prev!, ...patch }));

  const save = () => {
    updateProduct(part.id, { ...product, partNumber: product.partNumber.trim().toUpperCase() });
    updateInventory(part.id, {
      ...inv,
      rack: inv.rack.trim().toUpperCase(),
      shelf: inv.shelf.trim().toUpperCase(),
      bin: inv.bin.trim().toUpperCase(),
      qrCode: inv.qrCode.trim().toUpperCase() || part.qrCode,
    });
    toast('ok', `${product.partNumber} saved.`);
    go(`/part/${part.id}`);
  };

  return (
    <div className="page">
      <div className="breadcrumb">
        <button onClick={() => go('/inventory')}>Inventory</button>
        <span>/</span>
        <button onClick={() => go(`/part/${part.id}`)} className="mono">{part.partNumber}</button>
        <span>/</span>
        <span>Edit</span>
      </div>

      <header className="page-head">
        <div>
          <h1>Edit Part</h1>
          <p className="page-sub">Product information and inventory information are maintained separately.</p>
        </div>
      </header>

      <form className="form-stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <section className="card">
          <header className="card-head">
            <div>
              <h2 className="card-title">Product Information</h2>
              <p className="card-desc">Identity, classification and supplier — rarely changes</p>
            </div>
          </header>
          <div className="card-body field-grid">
            <Field label="Part Name" required>
              <input value={product.partName} onChange={(e) => setP({ partName: e.target.value })} />
            </Field>
            <Field label="Part Number / SKU" required>
              <input className="mono" value={product.partNumber} onChange={(e) => setP({ partNumber: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Category" required>
              <select value={product.category} onChange={(e) => setP({ category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Vehicle / Model">
              <input value={product.vehicleModel} onChange={(e) => setP({ vehicleModel: e.target.value })} />
            </Field>
            <Field label="Supplier">
              <input value={product.supplier} onChange={(e) => setP({ supplier: e.target.value })} />
            </Field>
            <Field label="Supplier Part Number">
              <input className="mono" value={product.supplierPartNumber} onChange={(e) => setP({ supplierPartNumber: e.target.value })} />
            </Field>
            <Field label="Unit Cost (₹)">
              <input type="number" min={0} value={product.unitCost} onChange={(e) => setP({ unitCost: Number(e.target.value) })} />
            </Field>
            <Field label="Description" wide>
              <textarea rows={2} value={product.description} onChange={(e) => setP({ description: e.target.value })} />
            </Field>
            <Field label="Notes" wide>
              <textarea rows={2} value={product.notes} onChange={(e) => setP({ notes: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="card">
          <header className="card-head">
            <div>
              <h2 className="card-title">Inventory Information</h2>
              <p className="card-desc">Stock level, storage location and QR identifier — changes are logged</p>
            </div>
          </header>
          <div className="card-body field-grid">
            <Field label="Quantity on Hand" hint="Recorded as a stock adjustment in history">
              <input type="number" min={0} value={inv.quantity} onChange={(e) => setI({ quantity: Number(e.target.value) })} />
            </Field>
            <Field label="Minimum Stock Level" hint="Low-stock alert threshold">
              <input type="number" min={0} value={inv.minimumStock} onChange={(e) => setI({ minimumStock: Number(e.target.value) })} />
            </Field>
            <Field label="Warehouse">
              <select value={inv.warehouse} onChange={(e) => setI({ warehouse: e.target.value })}>
                {WAREHOUSES.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </Field>
            <Field label="Rack">
              <input className="mono" value={inv.rack} onChange={(e) => setI({ rack: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Shelf">
              <input className="mono" value={inv.shelf} onChange={(e) => setI({ shelf: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Bin">
              <input className="mono" value={inv.bin} onChange={(e) => setI({ bin: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="QR Code / Unique ID">
              <input className="mono" value={inv.qrCode} onChange={(e) => setI({ qrCode: e.target.value.toUpperCase() })} />
            </Field>
          </div>
        </section>

        <div className="form-actions">
          <Button type="button" onClick={() => go(`/part/${part.id}`)}>Cancel</Button>
          <Button type="submit" variant="primary">Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
