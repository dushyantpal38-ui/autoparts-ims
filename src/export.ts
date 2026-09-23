import { statusOf, statusLabel, type Part } from './useStore';
import { toast } from './ui';

// Builds a real .xlsx file with a header row formatted for finance/procurement use.
// The xlsx library is loaded on demand (~430 KB gzip) so it never slows first paint.
// Replace this module later with a server-side export if needed — the column
// contract below is the API.
export async function exportParts(parts: Part[], filenameBase: string) {
  toast('ok', `Preparing export of ${parts.length} part${parts.length === 1 ? '' : 's'}…`);

  const XLSX = await import('xlsx');

  const rows = parts.map((p) => ({
    'Part Number': p.partNumber,
    'Part Name': p.partName,
    Category: p.category,
    Vehicle: p.vehicleModel,
    Quantity: p.quantity,
    'Minimum Stock': p.minimumStock,
    Warehouse: p.warehouse,
    Rack: p.rack,
    Shelf: p.shelf,
    Bin: p.bin,
    Supplier: p.supplier,
    'Supplier Part No': p.supplierPartNumber,
    'Unit Cost (INR)': p.unitCost,
    'Stock Value (INR)': p.quantity * p.unitCost,
    Status: statusLabel(statusOf(p)),
    'Date Added': new Date(p.dateAdded).toLocaleString('en-IN'),
    'Last Updated': new Date(p.lastUpdated).toLocaleString('en-IN'),
    'QR Code': p.qrCode,
    'Inventory ID': p.id,
    Notes: p.notes,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Sensible column widths
  ws['!cols'] = [
    { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 24 }, { wch: 10 }, { wch: 10 },
    { wch: 13 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 22 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 13 }, { wch: 20 }, { wch: 20 }, { wch: 12 },
    { wch: 12 }, { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  XLSX.writeFile(wb, `${filenameBase}.xlsx`);
  toast('ok', `Exported ${parts.length} part${parts.length === 1 ? '' : 's'} to ${filenameBase}.xlsx`);
}
