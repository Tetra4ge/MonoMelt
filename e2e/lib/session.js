/**
 * Shared sign-in helper for the browser scripts (ui-theme.js, ui-screenshots.js).
 * Signs in as an existing user through a Supabase magic-link token (no password, no email sent),
 * and finds the newest chatverse-ai project with a completed report (or PROJECT_ID).
 *
 * Needs E2E_USER_EMAIL. Supabase settings are read from the service .env files, or from
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY.
 */
const fs = require('node:fs');
const path = require('node:path');

function loadEnvFile(file) {
  const out = {};
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  } catch { /* optional */ }
  return out;
}

const gatewayEnv = loadEnvFile(path.join(__dirname, '../../api-gateway/.env'));
const frontendEnv = loadEnvFile(path.join(__dirname, '../../frontend/.env'));

const config = {
  SUPABASE_URL: process.env.SUPABASE_URL || gatewayEnv.SUPABASE_URL,
  SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || gatewayEnv.SUPABASE_SERVICE_ROLE_KEY,
  ANON_KEY: process.env.SUPABASE_ANON_KEY || frontendEnv.VITE_SUPABASE_ANON_KEY,
  FRONTEND: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  GATEWAY: (process.env.GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, ''),
  EMAIL: process.env.E2E_USER_EMAIL,
};

function requireConfig() {
  if (!config.SUPABASE_URL || !config.SERVICE_KEY || !config.ANON_KEY || !config.EMAIL) {
    console.error('Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY and E2E_USER_EMAIL');
    process.exit(2);
  }
}

const admin = () => ({ apikey: config.SERVICE_KEY, Authorization: `Bearer ${config.SERVICE_KEY}` });

async function json(method, url, headers, body) {
  const res = await fetch(url, { method, headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function signIn(email) {
  const link = await json('POST', `${config.SUPABASE_URL}/auth/v1/admin/generate_link`, admin(), { type: 'magiclink', email });
  const hashed = link.data?.hashed_token || link.data?.properties?.hashed_token;
  if (!hashed) throw new Error('could not create a sign-in link');
  const verified = await json('POST', `${config.SUPABASE_URL}/auth/v1/verify`, { apikey: config.ANON_KEY }, { type: 'magiclink', token_hash: hashed });
  if (!verified.data?.access_token) throw new Error('could not verify the sign-in link');
  return verified.data;
}

async function findProject(session) {
  if (process.env.PROJECT_ID) return process.env.PROJECT_ID;
  // Newest chatverse-ai project whose latest report completed; the report page of a failed run only shows an error.
  const base = `${config.SUPABASE_URL}/rest/v1`;
  const rows = await json('GET', `${base}/projects?owner_id=eq.${session.user.id}&name=like.${encodeURIComponent('chatverse-ai*')}&select=id&order=created_at.desc&limit=10`, admin());
  for (const row of rows.data || []) {
    const reports = await json('GET', `${base}/project_reports?project_id=eq.${row.id}&select=status&order=version_number.desc&limit=1`, admin());
    if (reports.data?.[0]?.status === 'completed') return row.id;
  }
  return rows.data?.[0]?.id;
}

/** Pre-load the Supabase session exactly where supabase-js keeps it. */
async function addSession(context, session) {
  const ref = new URL(config.SUPABASE_URL).hostname.split('.')[0];
  await context.addInitScript(([key, value]) => { try { localStorage.setItem(key, value); } catch { /* ignore */ } }, [
    `sb-${ref}-auth-token`,
    JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token, token_type: 'bearer', expires_in: session.expires_in, expires_at: session.expires_at, user: session.user }),
  ]);
}

module.exports = { config, requireConfig, admin, json, signIn, findProject, addSession };
