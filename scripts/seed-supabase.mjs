// Seed the live Supabase database with the demo inventory so live mode starts
// populated. Usage: node scripts/seed-supabase.mjs <ACCESS_TOKEN> <PROJECT_REF>
// Requires seed-bundle.mjs (built with: npx esbuild src/seedData.ts --bundle --format=esm --outfile=seed-bundle.mjs)
import { readFileSync } from 'node:fs';

const [token, ref] = process.argv.slice(2);
if (!token || !ref) {
  console.error('Usage: node scripts/seed-supabase.mjs <ACCESS_TOKEN> <PROJECT_REF>');
  process.exit(1);
}

const { SEED_PARTS, SEED_ACTIVITY } = await import('../seed-bundle.mjs');

const sqlQuote = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

// ---------------------------------------------------------------- parts SQL --
const partCols = ['id','qr_code','part_number','part_name','category','vehicle_model','description',
  'quantity','minimum_stock','warehouse','rack','shelf','bin','supplier','supplier_part_number',
  'unit_cost','date_added','last_updated','notes'];
const partRows = SEED_PARTS.map((p) => `(${[
  sqlQuote(p.id), sqlQuote(p.qrCode), sqlQuote(p.partNumber), sqlQuote(p.partName),
  sqlQuote(p.category), sqlQuote(p.vehicleModel), sqlQuote(p.description),
  sqlQuote(p.quantity), sqlQuote(p.minimumStock), sqlQuote(p.warehouse), sqlQuote(p.rack),
  sqlQuote(p.shelf), sqlQuote(p.bin), sqlQuote(p.supplier), sqlQuote(p.supplierPartNumber),
  sqlQuote(p.unitCost), sqlQuote(p.dateAdded), sqlQuote(p.lastUpdated), sqlQuote(p.notes),
].join(',')})`);

// ------------------------------------------------------------- activity SQL --
const actCols = ['part_id','part_number','part_name','action','delta','prev_qty','new_qty',
  'prev_location','new_location','summary','user_name','user_email','role','reason','note','created_at'];
const actRows = SEED_ACTIVITY.map((a) => `(${[
  sqlQuote(a.partId), sqlQuote(a.partNumber), sqlQuote(a.partName), sqlQuote(a.action),
  sqlQuote(a.delta ?? null), sqlQuote(a.prevQty ?? null), sqlQuote(a.newQty ?? null),
  sqlQuote(a.prevLocation ?? null), sqlQuote(a.newLocation ?? null), sqlQuote(a.summary ?? null),
  sqlQuote(a.user), sqlQuote(''), sqlQuote(a.role), sqlQuote(a.reason),
  sqlQuote(a.note ?? null), sqlQuote(a.timestamp),
].join(',')})`);

async function runQuery(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text || '[]');
}

console.log(`Seeding ${SEED_PARTS.length} parts and ${SEED_ACTIVITY.length} activity rows…`);
await runQuery('delete from public.activity; delete from public.parts;');
await runQuery(
  `insert into public.parts (${partCols.join(',')}) values\n${partRows.join(',\n')};`,
);
await runQuery(
  `insert into public.activity (${actCols.join(',')}) values\n${actRows.join(',\n')};`,
);

const [{ count: pc }] = await runQuery('select count(*)::int as count from public.parts');
const [{ count: ac }] = await runQuery('select count(*)::int as count from public.activity');
console.log(`✓ Seeded — parts: ${pc}, activity rows: ${ac}`);
