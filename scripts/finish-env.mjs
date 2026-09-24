// Finish env setup: paste anon key, then push env vars to Vercel production.
// Usage: node scripts/finish-env.mjs <ANON_KEY>
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const anon = process.argv[2]?.trim();
if (!anon) {
  console.error('Usage: node scripts/finish-env.mjs <ANON_KEY>');
  process.exit(1);
}

// ---- 1. write/merge .env ----------------------------------------------------
let envContent = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const setVar = (content, key, value) => {
  const re = new RegExp(`^${key}=.*$`, 'm');
  return re.test(content)
    ? content.replace(re, `${key}=${value}`)
    : content.trimEnd() + `\n${key}=${value}`;
};
envContent = setVar(envContent, 'VITE_SUPABASE_ANON_KEY', anon);
writeFileSync('.env', envContent.trimEnd() + '\n');
console.log('✓ .env written');

// ---- 2. Vercel production env ----------------------------------------------
const ref = (readFileSync('.env', 'utf8').match(/VITE_SUPABASE_URL=https:\/\/([a-z0-9]{20})\.supabase\.co/) || [])[1];
if (!ref) {
  console.log('! No Supabase URL in .env — skipping Vercel env sync.');
  process.exit(0);
}
const url = `https://${ref}.supabase.co`;

function vercelEnvAdd(key, value) {
  try {
    execSync(`npx --yes vercel env rm ${key} production --yes 2>nul`, { stdio: 'ignore' });
  } catch { /* may not exist yet */ }
  try {
    execSync(`echo ${value} | npx --yes vercel env add ${key} production`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    console.error(`! vercel env add failed for ${key}: ${String(e.message).slice(0, 150)}`);
    return false;
  }
}

const okUrl = vercelEnvAdd('VITE_SUPABASE_URL', url);
const okKey = vercelEnvAdd('VITE_SUPABASE_ANON_KEY', anon);
console.log(okUrl && okKey ? '✓ Vercel production env vars set' : '! Some Vercel vars need manual attention');
console.log('\nNext: npm run build && npx vercel --prod --yes');
