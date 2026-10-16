#!/usr/bin/env node
/**
 * UI smoke test: drives the real frontend in headless Chromium against the live stack,
 * signed in as an existing user, and walks every page of the most recent e2e project
 * (created by github-flow.js). It fails on console errors, failed API requests and missing
 * content, and saves a screenshot of each page to e2e/results/ui/.
 *
 *   cd e2e && npm install && npx playwright install chromium   (once)
 *   E2E_USER_EMAIL=you@example.com node ui-smoke.js
 *
 * Config: FRONTEND_URL (default http://localhost:5173), E2E_USER_EMAIL, PROJECT_ID (optional),
 * plus the same Supabase variables as github-flow.js (read from the service .env files).
 * The Notion export button is only checked for presence; it is never clicked.
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
const gatewayEnv = loadEnvFile(path.join(__dirname, '../api-gateway/.env'));
const frontendEnv = loadEnvFile(path.join(__dirname, '../frontend/.env'));
const SUPABASE_URL = process.env.SUPABASE_URL || gatewayEnv.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || gatewayEnv.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || frontendEnv.VITE_SUPABASE_ANON_KEY;
const FRONTEND = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const EMAIL = process.env.E2E_USER_EMAIL;
if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY || !EMAIL) {
  console.error('Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY and E2E_USER_EMAIL');
  process.exit(2);
}

const { chromium } = require('playwright');
const admin = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

async function json(method, url, headers, body) {
  const res = await fetch(url, { method, headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function signIn(email) {
  const link = await json('POST', `${SUPABASE_URL}/auth/v1/admin/generate_link`, admin, { type: 'magiclink', email });
  const hashed = link.data?.hashed_token || link.data?.properties?.hashed_token;
  if (!hashed) throw new Error('could not create a sign-in link');
  const verified = await json('POST', `${SUPABASE_URL}/auth/v1/verify`, { apikey: ANON_KEY }, { type: 'magiclink', token_hash: hashed });
  if (!verified.data?.access_token) throw new Error('could not verify the sign-in link');
  return verified.data;
}

const results = [];
let page = '';
function check(name, ok, detail = '') {
  results.push({ page, name, ok: !!ok, detail: String(detail) });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  -> ${detail}` : ''}`);
  return !!ok;
}

(async () => {
  const session = await signIn(EMAIL);
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0];

  // Find the project to inspect.
  let projectId = process.env.PROJECT_ID;
  if (!projectId) {
    const rows = await json('GET', `${SUPABASE_URL}/rest/v1/projects?owner_id=eq.${session.user.id}&name=like.${encodeURIComponent('chatverse-ai (e2e*')}&select=id,name&order=created_at.desc&limit=1`, admin);
    projectId = rows.data?.[0]?.id;
  }
  if (!projectId) { console.error('No e2e project found. Run github-flow.js first (or set PROJECT_ID).'); process.exit(2); }
  console.log(`Project under test: ${projectId}`);

  const shots = path.join(__dirname, 'results', 'ui');
  fs.mkdirSync(shots, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Pre-load the Supabase session exactly where supabase-js keeps it.
  await context.addInitScript(([key, value]) => { try { localStorage.setItem(key, value); } catch { /* ignore */ } }, [
    `sb-${ref}-auth-token`,
    JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token, token_type: 'bearer', expires_in: session.expires_in, expires_at: session.expires_at, user: session.user }),
  ]);

  const p = await context.newPage();
  let consoleErrors = [];
  let failedRequests = [];
  p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 240)); });
  p.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e.message).slice(0, 240)}`));
  p.on('response', (r) => {
    const u = r.url();
    if ((u.includes(':4000/') || u.includes('supabase.co')) && r.status() >= 400) failedRequests.push(`${r.status()} ${r.request().method()} ${u.replace(/\?.*/, '').slice(0, 140)}`);
  });

  async function visit(name, url, fn) {
    page = name;
    console.log(`\n== ${name}  (${url.replace(FRONTEND, '')})`);
    consoleErrors = [];
    failedRequests = [];
    try {
      await p.goto(`${FRONTEND}${url}`, { waitUntil: 'domcontentloaded' });
      await fn();
      await p.waitForTimeout(2500); // let chart/graph animations finish before the screenshot
    } catch (err) {
      check('page interaction completed', false, err.message.split('\n')[0]);
    }
    // fullPage capture resizes the viewport, which makes Recharts replay its grow animation and the
    // shot lands on empty bars. Size the viewport to the page first, let it settle, then capture.
    const height = await p.evaluate(() => Math.min(document.documentElement.scrollHeight, 5000)).catch(() => 900);
    await p.setViewportSize({ width: 1440, height: Math.max(900, height) });
    await p.waitForTimeout(2800);
    await p.screenshot({ path: path.join(shots, `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`) }).catch(() => {});
    await p.setViewportSize({ width: 1440, height: 900 });
    // Ignore the benign dev-only React warnings; everything else is a defect.
    const real = consoleErrors.filter((e) => !/Download the React DevTools|favicon/i.test(e));
    check('no console errors', real.length === 0, real.slice(0, 3).join(' | '));
    check('no failed API requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));
  }
  const text = (re, timeout = 20000) => p.getByText(re).first().waitFor({ timeout });
  const visible = async (name, re, timeout = 20000) => { try { await text(re, timeout); check(name, true); } catch { check(name, false, `text ${re} not found`); } };

  // ------------------------------------------------------------------
  await visit('Dashboard', '/dashboard', async () => {
    await visible('workspace heading renders', /ingest_repository/);
    await visible('recent workspaces list loads', /recent_workspaces/);
    await visible('the e2e project appears as a workspace', /chatverse-ai \(e2e/);
    await visible('system status panel renders', /SYSTEM_STATUS/);
    await p.waitForTimeout(2500);
    const online = await p.getByText('ONLINE', { exact: true }).count();
    check('all five dependencies show ONLINE', online >= 5, `${online} ONLINE rows`);
    check('nothing is reported OFFLINE', (await p.getByText('OFFLINE', { exact: true }).count()) === 0);
  });

  await visit('Analysis', `/dashboard/projects/${projectId}/analysis`, async () => {
    await visible('metrics render (total files)', /TOTAL FILES/i);
    const tile = await p.locator('text=/TOTAL FILES/i').first().locator('xpath=..').innerText().catch(() => '');
    check('total files is 26', /26/.test(tile), tile.replace(/\n/g, ' '));
    check('detected languages are listed (typescript [26])', (await p.getByText('typescript', { exact: true }).count()) > 0 && (await p.getByText('[26]', { exact: true }).count()) > 0);
    check('the "No languages detected" placeholder is gone', (await p.getByText(/No languages detected/i).count()) === 0);
    for (const label of [/Import Cycles/i, /Independent Components/i, /Unresolved Imports/i]) await visible(`metric card ${label} renders`, label, 5000);
    const unresolvedCard = await p.locator('text=/Unresolved Imports/i').first().locator('xpath=..').innerText().catch(() => '');
    check('no unresolved imports reported', /\b0\b/.test(unresolvedCard), unresolvedCard.replace(/\n/g, ' '));
    await visible('AI findings panel renders', /AI Intelligence Findings/i);
    const chips = await p.locator('[title*="/"]').allInnerTexts();
    check('impacted-node chips show file names', chips.length > 0 && chips.every((t) => /[A-Za-z]/.test(t) && /\.(tsx?|jsx?|py)/.test(t)), chips.slice(0, 3).join(' | '));
    check('impacted-node chips are not all identical hashes', new Set(chips).size > 1 && !chips.some((t) => /^[0-9a-f]{8}$/.test(t)));
    await visible('decomposition section renders', /Microservice Decomposition/i);
    await visible('domain-driven strategy button is offered', /Generate Domain-Driven/i);
    check('dependency graph canvas is drawn', (await p.locator('canvas').count()) > 0);
    // open a scenario and look at the scorecard
    const tab = p.getByRole('button', { name: /^(conservative|aggressive|domain)/i }).first();
    check('scenario tabs are listed', (await tab.count()) > 0);
    await tab.click();
    await visible('scenario scorecard shows microservices', /Proposed Boundaries/i);
    await visible('proceed to planning is offered', /Proceed to Planning/i);
    check('no "1 files" pluralisation slip', (await p.getByText(/\b1 files\b/).count()) === 0);
    check('services are named by content, not Service_N', (await p.getByText(/Service_\d+/).count()) === 0);
    check('"Back to Dashboard" replaces the dead project link', (await p.getByRole('button', { name: /Back to Dashboard/i }).count()) === 1);
  });

  await visit('Planning', `/dashboard/projects/${projectId}/planning`, async () => {
    await visible('migration plan loads', /migration_planning/);
    await visible('roadmap renders', /execution_sequence/);
    await visible('cost model renders', /impact_model/);
    await visible('team ownership renders', /responsibility_map/);
    await visible('consistency matrix renders', /boundary_controls/);
    await visible('revision history lists revisions', /revision_2/);
    check('no placeholder services in the plan', (await p.getByText(/Payment-Service|Order-Service|Notification-Service|Auth-Service/).count()) === 0);
    await p.getByRole('button', { name: /Recalculate report/i }).click();
    await p.waitForTimeout(3000);
    check('recalculation completes without an error banner', (await p.getByText(/Recalculation failed/i).count()) === 0);
    await visible('recalculation adds a third revision', /revision_3/, 15000);
  });

  await visit('Export', `/dashboard/projects/${projectId}/export`, async () => {
    await visible('export page loads', /infrastructure_export/);
    await visible('generated artifacts are listed', /Generated Artifacts/i);
    await visible('workspace shows generated files', /Workspace \(\d+\)/);
    const count = Number(((await p.getByText(/Workspace \(\d+\)/).first().innerText()).match(/\((\d+)\)/) || [])[1] || 0);
    check('preview lists the generated files', count >= 10, `${count} files`);
    check('Terraform scaffold is in the preview', (await p.getByText(/terraform\/main\.tf/).count()) > 0);
    check('file contents are shown', (await p.locator('pre code').first().innerText()).length > 20);
    check('download and deploy actions are offered', (await p.getByRole('button', { name: /Download ZIP/i }).count()) === 1 && (await p.getByRole('button', { name: /1-Click Deploy/i }).count()) === 1);
    check('report is reachable from here', (await p.getByRole('button', { name: /View Report/i }).count()) === 1);
  });

  // The latest blueprint id for the deployment page.
  const bps = await json('GET', `${SUPABASE_URL}/rest/v1/blueprints?project_id=eq.${projectId}&select=id&order=created_at.desc&limit=1`, admin);
  const blueprintId = bps.data?.[0]?.id;
  await visit('Deployment', `/dashboard/projects/${projectId}/deployment?blueprintId=${blueprintId}`, async () => {
    await visible('live deployment page loads', /live_deployment/);
    await visible('the simulated pipeline completes', /Live Services Dashboard/i, 40000);
    check('service cards are the real services, not a made-up gateway', (await p.getByText('generated-api-gateway').count()) === 0 && (await p.getByText(/-service$/).count()) >= 3);
    check('services are labelled Simulated, not Healthy', (await p.getByText('Simulated').count()) >= 3 && (await p.getByText('Healthy').count()) === 0);
    check('download works from the deployed view', (await p.getByRole('button', { name: /Download ZIP/i }).count()) === 1);
  });

  await visit('Report', `/dashboard/projects/${projectId}/report`, async () => {
    await visible('report renders the executive summary', /executive_summary/);
    await visible('proposed microservices render', /proposed_microservices/);
    await visible('financial projection renders', /financial_projection/);
    await visible('risk assessment renders', /risk_assessment/);
    const body = await p.locator('body').innerText();
    check('no raw markdown markers in the report', !/\*\*/.test(body));
    await p.waitForSelector('.recharts-bar-rectangle', { timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(1800); // bar-grow animation
    const bars = await p.evaluate(() => [...document.querySelectorAll('.recharts-bar-rectangle path, .recharts-bar-rectangle rect')].map((e) => Math.round(e.getBoundingClientRect().height)));
    check('financial chart draws two non-empty bars', bars.length === 2 && bars.every((h) => h > 20), JSON.stringify(bars));
    check('summary shows total services and a risk score', (await p.getByText(/Total Services/i).count()) > 0 && (await p.getByText(/Risk Score/i).count()) > 0);
    check('Notion export action is present (not clicked)', (await p.getByRole('button', { name: /Export to Notion/i }).count()) + (await p.getByText(/Open in Notion/i).count()) > 0);
    const live = p.getByText(/Version:/i).first();
    check('report version is shown', (await live.count()) > 0);
  });

  await visit('Auth guard', '/login', async () => {
    // Signed in users hitting a protected route must not be bounced; and a bad project id must not crash the app.
    await p.goto(`${FRONTEND}/dashboard/projects/00000000-0000-0000-0000-000000000000/analysis`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2500);
    const blank = (await p.locator('body').innerText()).trim().length === 0;
    check('an unknown project shows a message instead of a blank crash', !blank);
  });

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed   (screenshots: e2e/results/ui/)`);
  for (const f of failed) console.log(`  [${f.page}] ${f.name}${f.detail ? ` -> ${f.detail}` : ''}`);
  fs.writeFileSync(path.join(__dirname, 'results', `ui-smoke-${Date.now()}.json`), JSON.stringify({ projectId, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
