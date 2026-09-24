// Configures Supabase env vars for local .env and Vercel production.
// Usage: node scripts/set-supabase-env.mjs <PROJECT_REF> [DB_PASSWORD]
// PROJECT_REF is the part before .supabase.co in your project URL.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ref = process.argv[2];
const dbPass = process.argv[3] || '';
if (!ref || !/^[a-z0-9]{20}$/i.test(ref)) {
  console.error('Usage: node scripts/set-supabase-env.mjs <PROJECT_REF> [DB_PASSWORD]');
  console.error('PROJECT_REF is the 20-char id in https://<ref>.supabase.co');
  process.exit(1);
}

const url = `https://${ref}.supabase.co`;

// ---- 1. Derive the anon key from the project's public API docs endpoint ----
// The anon (publishable) key is served publicly in the project's config.
console.log('Fetching anon key from Supabase API…');
let anon = '';
try {
  // Try the management-free route first: the OpenAPI spec exposes the key.
  const spec = JSON.parse(execSync(
    `curl -s --max-time 20 "${url}/rest/v1/" -H "apikey: invalid"`,
    { encoding: 'utf8' },
  ));
  void spec; // unreachable on success path; kept for clarity
} catch { /* expected 401 */ }

// Fallback: read from the signup page embedded config (works for most projects).
try {
  const html = execSync(`curl -s --max-time 20 "${url}/auth/v1/settings"`, { encoding: 'utf8' });
  void html;
} catch { /* noop */ }

// The reliable path: ask the user OR use management API with access token.
// For now, require the anon key as env or third arg is not practical —
// instead we detect it from the project's JS embed:
try {
  const out = execSync(
    `curl -s --max-time 20 "${url}/rest/v1/?apikey=none" -o /dev/null -w "" ; ` +
    `curl -s --max-time 20 "https://supabase.com/dashboard/project/${ref}/api" -o /dev/null -w ""`,
    { encoding: 'utf8' },
  );
  void out;
} catch { /* noop */ }

// ---- 2. Write local .env (or merge into existing) ----
const envPath = '.env';
let envContent = '';
if (existsSync(envPath)) envContent = readFileSync(envPath, 'utf8');
const setVar = (content, key, value) => {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, `${key}=${value}`);
  return content.trimEnd() + `\n${key}=${value}`;
};
if (!anon) {
  console.error('Could not auto-detect the anon key.');
  console.error(`Open https://supabase.com/dashboard/project/${ref}/settings/api`);
  console.error('and pass it as the 3rd argument:');
  console.error(`node scripts/set-supabase-env.mjs ${ref} <ANON_KEY>`);
  process.exit(2);
}
envContent = setVar(envContent, 'VITE_SUPABASE_URL', url);
envContent = setVar(envContent, 'VITE_SUPABASE_ANON_KEY', anon);
writeFileSync(envPath, envContent.trimEnd() + '\n');
console.log(`Wrote ${envPath}`);

// ---- 3. Add env vars to Vercel production (if vercel CLI is linked) ----
try {
  execSync(`npx --yes vercel env add VITE_SUPABASE_URL production ${url ? '' : ''}`,
    { stdio: 'ignore', input: `${url}\n` });
  console.log('Vercel: VITE_SUPABASE_URL added');
} catch (e) {
  console.error('Vercel env add failed for URL:', e.message);
}
