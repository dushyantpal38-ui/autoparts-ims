// End-to-end Supabase setup automation via the Management API.
// Usage: node scripts/setup-supabase.mjs <ACCESS_TOKEN> [PROJECT_REF]
// Get a token: https://supabase.com/dashboard/account/tokens -> Generate new token
//
// Steps:
//   1. Verify token, list projects (auto-picks when only one exists)
//   2. Apply supabase/schema.sql via POST /database/query
//   3. Fetch the publishable (anon) API key
//   4. Write .env with VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const token = process.argv[2]?.trim();
let ref = process.argv[3]?.trim() || '';
if (!token) {
  console.error('Usage: node scripts/setup-supabase.mjs <ACCESS_TOKEN> [PROJECT_REF]');
  process.exit(1);
}

const API = 'https://api.supabase.com/v1';
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { headers: H, ...opts });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${res.status} ${path}: ${String(text).slice(0, 300)}`);
  return json;
}

// ---- 1. verify + find project ----------------------------------------------
console.log('[1/4] Verifying token and finding project…');
const projects = await api('/projects');
if (!Array.isArray(projects) || projects.length === 0) {
  console.error('✗ No projects visible for this token. Create a project at supabase.com first.');
  process.exit(2);
}
if (!ref) {
  if (projects.length === 1) ref = projects[0].id;
  else {
    console.error('Multiple projects found — pass the ref of yours:');
    for (const p of projects) console.error(`   ${p.id}  ${p.name}  (${p.region})`);
    process.exit(2);
  }
}
const project = projects.find((p) => p.id === ref);
if (!project) {
  console.error(`✗ Project ${ref} not found in this account. Available:`);
  for (const p of projects) console.error(`   ${p.id}  ${p.name}  (${p.region})`);
  process.exit(2);
}
console.log(`      ✓ "${project.name}" (${project.region}, status: ${project.status})`);
if (project.status !== 'ACTIVE_HEALTHY') {
  console.error('      ! Project is not healthy yet — wait for it to finish initializing, then rerun.');
}

// ---- 2. apply schema ---------------------------------------------------------
console.log('[2/4] Applying schema.sql…');
const sqlPath = 'supabase/schema.sql';
if (!existsSync(sqlPath)) { console.error(`✗ ${sqlPath} missing`); process.exit(3); }
const sql = readFileSync(sqlPath, 'utf8');
try {
  await api(`/projects/${ref}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: sql }),
  });
  console.log('      ✓ schema applied');
} catch (e) {
  const msg = String(e.message);
  // "already exists" style errors are fine because the schema is idempotent-ish;
  // surface anything else with the dashboard fallback.
  console.error(`      ! query endpoint issue: ${msg.slice(0, 200)}`);
  console.error('        Fallback: paste supabase/schema.sql into Dashboard → SQL Editor → Run,');
  console.error('        then run this script again (it will skip ahead to the key step).');
}

// ---- 3. verify tables exist ---------------------------------------------------
console.log('[3/4] Verifying tables…');
try {
  const res = await api(`/projects/${ref}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: "select table_name from information_schema.tables where table_schema='public' order by 1" }),
  });
  const rows = Array.isArray(res) ? res : (res?.rows ?? []);
  const names = rows.map((r) => r.table_name).filter(Boolean);
  console.log(`      ✓ public tables: ${names.join(', ') || '(none — apply schema first)'}`);
} catch (e) {
  console.error(`      ! could not verify: ${String(e.message).slice(0, 150)}`);
}

// ---- 4. anon key + .env -------------------------------------------------------
console.log('[4/4] Fetching anon key and writing .env…');
let anon = '';
try {
  const keys = await api(`/projects/${ref}/api-keys`);
  const k = Array.isArray(keys)
    ? keys.find((x) => x.type === 'publishable' || x.name === 'anon') ?? keys[0]
    : null;
  anon = k?.api_key ?? k?.key ?? '';
} catch (e) {
  console.error(`      ! api-keys endpoint: ${String(e.message).slice(0, 150)}`);
}

const url = `https://${ref}.supabase.co`;
let envContent = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const setVar = (content, key, value) => {
  const re = new RegExp(`^${key}=.*$`, 'm');
  return re.test(content) ? content.replace(re, `${key}=${value}`) : content.trimEnd() + `\n${key}=${value}`;
};
envContent = setVar(envContent, 'VITE_SUPABASE_URL', url);
if (anon) envContent = setVar(envContent, 'VITE_SUPABASE_ANON_KEY', anon);
writeFileSync('.env', envContent.trimEnd() + '\n');
console.log('      ✓ .env written');

if (!anon) {
  console.log('\nNEXT: copy the anon key from');
  console.log(`  https://supabase.com/dashboard/project/${ref}/settings/api`);
  console.log('then run:  node scripts/finish-env.mjs <ANON_KEY>');
} else {
  console.log('\n✓ Setup complete. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are in .env');
  console.log('NEXT: node scripts/finish-env.mjs (already done here) — see README step for Vercel.');
}
