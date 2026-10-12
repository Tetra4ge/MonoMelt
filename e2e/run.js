#!/usr/bin/env node
/**
 * End-to-end test for MonoMelt. Drives the real gateway API against running
 * services (gateway, worker, AI service, Redis, Supabase, Neo4j):
 *
 *   upload -> ingest -> analysis -> intelligence -> decomposition -> plan
 *   -> blueprint -> deployment -> report -> websocket event
 *
 * plus cross-tenant and authentication checks. It creates two throwaway
 * Supabase users and deletes them (and their data) when it finishes.
 *
 * Required env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 *   GATEWAY_URL   (default http://localhost:4000)
 *   AI_URL        (default http://localhost:8000)   - for the direct-access auth check
 *   INTERNAL_API_KEY  - if the AI service requires one
 * Optional:
 *   SKIP_LLM=1    - skip the AI intelligence step (needs OpenRouter/Gemini)
 *   NO_REDIS=1    - diagnostic mode for when Redis is unavailable: seed the source
 *                   directly (what the worker would do), call the AI report endpoint
 *                   directly, and skip websocket event delivery. The default exercises
 *                   the real BullMQ worker, queued reports and websocket events, so
 *                   the gateway, worker and AI service must share one Redis.
 *
 *   node e2e/run.js
 */
const path = require('node:path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GATEWAY = (process.env.GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '');
const AI_URL = (process.env.AI_URL || 'http://localhost:8000').replace(/\/$/, '');
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || '';
// The real path (worker queue, queued reports, websocket events) is the default.
const WITH_REDIS = process.env.NO_REDIS !== '1';

for (const [name, value] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, SUPABASE_ANON_KEY: ANON_KEY })) {
  if (!value) { console.error(`Missing required env var ${name}`); process.exit(2); }
}

const AdmZip = require(path.join(__dirname, '../worker/node_modules/adm-zip'));
const { io: connectSocket } = require(path.join(__dirname, '../frontend/node_modules/socket.io-client'));

// ---------------------------------------------------------------------------
// tiny test harness
// ---------------------------------------------------------------------------
const results = [];
let currentStep = '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(name, condition, detail = '') {
  results.push({ step: currentStep, name, ok: !!condition, detail });
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${name}${!condition && detail ? `  -> ${detail}` : ''}`);
  return !!condition;
}
function skip(name, why) {
  results.push({ step: currentStep, name, ok: true, skipped: true, detail: why });
  console.log(`  SKIP  ${name}  (${why})`);
}
function step(title) {
  currentStep = title;
  console.log(`\n== ${title}`);
}

async function until(label, fn, { timeoutMs = 120000, intervalMs = 2000 } = {}) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out after ${timeoutMs / 1000}s waiting for: ${label}`);
}

async function http(method, url, { token, body, form, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (form) init.body = form;
  else if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  const res = await fetch(url, init);
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json().catch(() => null) : null;
  return { status: res.status, data, res };
}
const api = (method, route, opts) => http(method, `${GATEWAY}${route}`, opts);

// ---------------------------------------------------------------------------
// Supabase helpers (admin API for throwaway users)
// ---------------------------------------------------------------------------
async function createUser(label) {
  const email = `e2e-${label}-${Date.now()}@example.com`;
  const password = `E2e-${Math.random().toString(36).slice(2)}-Aa1!`;
  const created = await http('POST', `${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    body: { email, password, email_confirm: true },
  });
  if (created.status >= 300) throw new Error(`Could not create test user: ${created.status} ${JSON.stringify(created.data)}`);
  const login = await http('POST', `${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON_KEY },
    body: { email, password },
  });
  if (login.status !== 200) throw new Error(`Could not sign in test user: ${login.status}`);
  return { id: created.data.id, email, token: login.data.access_token };
}

async function deleteUser(user) {
  if (!user) return;
  await http('DELETE', `${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  }).catch(() => {});
}

async function removeStoragePrefix(prefix) {
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const walk = async (dir) => {
    const list = await http('POST', `${SUPABASE_URL}/storage/v1/object/list/openai`, { headers, body: { prefix: dir, limit: 1000 } });
    const paths = [];
    for (const item of list.data || []) {
      if (item.id === null) paths.push(...(await walk(`${dir}/${item.name}`)));
      else paths.push(`${dir}/${item.name}`);
    }
    return paths;
  };
  const paths = await walk(prefix);
  for (let i = 0; i < paths.length; i += 100) {
    await http('DELETE', `${SUPABASE_URL}/storage/v1/object/openai`, { headers, body: { prefixes: paths.slice(i, i + 100) } });
  }
  return paths.length;
}

const SOURCE_EXT = { '.py': 'python', '.js': 'javascript', '.java': 'java' };

/**
 * Does what the ingestion worker does (store source files, write the manifest and a
 * job row) so the analysis pipeline can be exercised without Redis/BullMQ.
 */
async function seedSource(projectId) {
  const rest = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=representation' };
  const insert = async (table, rows) => {
    const res = await http('POST', `${SUPABASE_URL}/rest/v1/${table}`, { headers: rest, body: rows });
    if (res.status >= 300) throw new Error(`insert into ${table} failed: ${res.status} ${JSON.stringify(res.data)}`);
    return res.data;
  };

  const [sourceVersion] = await insert('source_versions', { project_id: projectId, source_type: 'zip', metadata: { filename: 'shop.zip', seeded: true } });
  const manifest = [];
  for (const [file, content] of Object.entries(FIXTURE)) {
    const ext = path.extname(file);
    const language = SOURCE_EXT[ext] || 'unknown';
    const isSource = ext in SOURCE_EXT;
    if (isSource) {
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/openai/projects/${projectId}/${sourceVersion.id}/files/${file}`, {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'x-upsert': 'true', 'Content-Type': 'text/plain' },
        body: content || ' ',
      });
      if (!up.ok) throw new Error(`storage upload failed for ${file}: ${up.status} ${await up.text()}`);
    }
    manifest.push({
      source_version_id: sourceVersion.id, file_path: file, byte_size: Buffer.byteLength(content),
      content_hash: 'e2e', language, status: isSource ? 'included' : 'excluded', reason: isSource ? null : 'Unsupported',
    });
  }
  await insert('source_files', manifest);
  const [job] = await insert('analysis_jobs', { project_id: projectId, source_version_id: sourceVersion.id, status: 'ready' });
  return { sourceVersionId: sourceVersion.id, jobId: job.id };
}

// ---------------------------------------------------------------------------
// Fixture repository: two domains with one cross-domain import and one import
// cycle, a JS front end, isolated scripts, a syntax error and an unsupported language.
// ---------------------------------------------------------------------------
const FIXTURE = {
  'shop-main/README.md': '# shop\n',
  'shop-main/Main.java': 'public class Main { }\n',
  'shop-main/billing/__init__.py': '',
  'shop-main/billing/invoice.py':
    'from billing import tax\nfrom billing.pay import charge\nfrom users.accounts import get_account\n\n'
    + 'def create_invoice(user_id):\n    account = get_account(user_id)\n    return charge(tax.apply(account))\n',
  'shop-main/billing/tax.py': 'from billing.invoice import create_invoice\n\ndef apply(account):\n    return account\n',
  'shop-main/billing/pay.py': 'import json\n\ndef charge(amount):\n    return json.dumps({"charged": amount})\n',
  'shop-main/users/__init__.py': '',
  'shop-main/users/models.py':
    'class User:\n    def __init__(self, name):\n        self.name = name\n    def save(self):\n        pass\n\n'
    + 'class Admin(User):\n    def __init__(self, name):\n        super().__init__(name)\n',
  'shop-main/users/accounts.py': 'from users.models import User\n\ndef get_account(user_id):\n    return User(user_id)\n',
  'shop-main/users/auth.py': 'from users.accounts import get_account\n\ndef login(user_id):\n    return get_account(user_id)\n',
  'shop-main/scripts/seed.py': 'print("seed")\n',
  'shop-main/scripts/cleanup.py': 'print("cleanup")\n',
  'shop-main/broken/bad.py': 'def broken(:\n    pass\n',
  'shop-main/web/src/app.js':
    "import React from 'react';\nimport {\n  api,\n  other\n} from './lib/api';\nexport default function App() { return api; }\n",
  'shop-main/web/src/lib/api.js': 'export const api = {};\nexport const other = {};\n',
};
const FIXTURE_SOURCE_COUNT = 13; // python + js files the analyser should count (Main.java and README are not)

function buildZip() {
  const zip = new AdmZip();
  for (const [file, content] of Object.entries(FIXTURE)) zip.addFile(file, Buffer.from(content));
  return zip.toBuffer();
}

// ---------------------------------------------------------------------------
// The test
// ---------------------------------------------------------------------------
async function main() {
  let userA = null;
  let userB = null;
  let projectId = null;
  let socket = null;

  try {
    // ------------------------------------------------------------------
    step('0. Platform reachability and authentication');
    const health = await api('GET', '/health');
    check('gateway /health responds', health.status === 200 && health.data?.status === 'up');
    check('gateway reports ai-service up', health.data?.services?.['ai-service'] === 'up', JSON.stringify(health.data?.services));
    check('gateway reports neo4j connected', health.data?.services?.neo4j === 'connected', JSON.stringify(health.data?.services));

    check('API rejects requests without a token', (await api('GET', '/api/projects')).status === 401);
    check('API rejects an invalid token', (await api('GET', '/api/projects', { token: 'garbage' })).status === 401);

    const aiNoKey = await http('POST', `${AI_URL}/api/planning/generate`, { body: { proposed_services: [{ name: 'a' }] } });
    if (INTERNAL_KEY) {
      check('AI service rejects calls without the internal key', aiNoKey.status === 401, `status ${aiNoKey.status}`);
      const aiKey = await http('POST', `${AI_URL}/api/planning/generate`, {
        headers: { 'X-Internal-Key': INTERNAL_KEY }, body: { proposed_services: [{ name: 'a' }] },
      });
      check('AI service accepts the internal key', aiKey.status === 200, `status ${aiKey.status}`);
    } else {
      skip('AI service internal-key checks', 'INTERNAL_API_KEY not set');
    }

    userA = await createUser('a');
    userB = await createUser('b');
    check('created two throwaway users', !!userA.token && !!userB.token);

    // ------------------------------------------------------------------
    step('1. Project + source upload');
    const project = await api('POST', '/api/projects', { token: userA.token, body: { name: 'e2e-shop', source_type: 'zip' } });
    check('project created', project.status === 201 && project.data?.data?.id, JSON.stringify(project.data));
    projectId = project.data.data.id;

    const notZip = new FormData();
    notZip.append('file', new Blob([Buffer.from('not a zip at all')], { type: 'application/zip' }), 'x.zip');
    const rejected = await api('POST', `/api/projects/${projectId}/sources/zip`, { token: userA.token, form: notZip });
    check('non-ZIP upload is rejected', rejected.status === 400, `status ${rejected.status}`);

    const badRepo = await api('POST', `/api/projects/${projectId}/sources/github`, { token: userA.token, body: { repoUrl: 'http://evil.example/a/b' } });
    check('invalid GitHub URL is rejected', badRepo.status === 400, `status ${badRepo.status}`);

    const form = new FormData();
    form.append('file', new Blob([buildZip()], { type: 'application/zip' }), 'shop.zip');
    let jobId;
    let sourceVersionId;
    if (WITH_REDIS) {
      const upload = await api('POST', `/api/projects/${projectId}/sources/zip`, { token: userA.token, form });
      check('ZIP accepted for ingestion', upload.status === 202, JSON.stringify(upload.data));
      ({ jobId, sourceVersionId } = upload.data.data);
    } else {
      // No Redis: the queue is unavailable, so the upload must fail fast (not hang) and leave a failed job.
      const started = Date.now();
      const upload = await api('POST', `/api/projects/${projectId}/sources/zip`, { token: userA.token, form });
      check('upload fails fast with 503 when the job queue is down', upload.status === 503 && Date.now() - started < 15000, `status ${upload.status} after ${Date.now() - started}ms`);
      const rows = await http('GET', `${SUPABASE_URL}/rest/v1/analysis_jobs?project_id=eq.${projectId}&select=status,error_code`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      check('the job is marked failed instead of staying queued', rows.data?.[0]?.status === 'failed', JSON.stringify(rows.data));
      ({ jobId, sourceVersionId } = await seedSource(projectId));
      const trigger = await api('POST', `/api/projects/${projectId}/analysis/trigger`, { token: userA.token, body: { source_version_id: sourceVersionId } });
      check('analysis triggered through the gateway', trigger.status === 202, `status ${trigger.status} ${JSON.stringify(trigger.data)}`);
    }

    // ------------------------------------------------------------------
    step(WITH_REDIS ? '2. Ingestion (worker) and analysis (AI service)' : '2. Analysis (AI service; source seeded directly, no worker)');
    const job = await until('analysis job to finish', async () => {
      const res = await api('GET', `/api/projects/${projectId}/jobs/${jobId}`, { token: userA.token });
      const status = res.data?.data?.status;
      return ['completed', 'failed'].includes(status) ? res.data.data : null;
    }, { timeoutMs: 180000 });
    check('analysis job completed', job.status === 'completed', `${job.status}: ${job.error_code || ''}`);

    const metricsRes = await api('GET', `/api/projects/${projectId}/analysis/${sourceVersionId}/metrics`, { token: userA.token });
    const m = metricsRes.data?.data || {};
    check('metrics endpoint returns data', metricsRes.status === 200, `status ${metricsRes.status}`);
    check(`counted ${FIXTURE_SOURCE_COUNT} python/js files`, m.total_files === FIXTURE_SOURCE_COUNT, `got ${m.total_files}`);
    check('detected the billing import cycle', m.cycle_count >= 1, `cycle_count=${m.cycle_count}`);
    check('every local import resolved', m.unresolved_imports === 0, `unresolved=${m.unresolved_imports}`);
    check('found several independent components', m.graph_components >= 3, `components=${m.graph_components}`);
    check('language breakdown has python and javascript', m.language_breakdown?.python === 11 && m.language_breakdown?.javascript === 2, JSON.stringify(m.language_breakdown));

    const graphRes = await api('GET', `/api/projects/${projectId}/analysis/${sourceVersionId}/graph?limit=500`, { token: userA.token });
    const graph = graphRes.data?.data || { nodes: [], edges: [] };
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    const fileIds = new Set(graph.nodes.filter((n) => n.label === 'File').map((n) => n.id));
    const fileToFile = graph.edges.filter((e) => e.relationship === 'IMPORTS' && fileIds.has(e.source_id) && fileIds.has(e.target_id));
    check('graph has File -> File import edges', fileToFile.length >= 8, `found ${fileToFile.length}`);
    check('every edge endpoint is in the returned page', graph.edges.every((e) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id)));
    const initMethods = graph.nodes.filter((n) => n.name === '__init__' && n.label === 'Symbol');
    check('same-named methods are separate symbols', initMethods.length >= 2, `found ${initMethods.length}`);
    check('symbols carry their type', graph.nodes.some((n) => n.properties?.symbol_type === 'class'));

    const diagRes = await api('GET', `/api/projects/${projectId}/analysis/${sourceVersionId}/diagnostics`, { token: userA.token });
    const diags = diagRes.data?.data?.diagnostics || [];
    check('parser diagnostics were persisted', diags.length >= 2, `found ${diags.length}`);
    check('syntax error in bad.py reported', diags.some((d) => d.file_path.endsWith('bad.py') && /SyntaxError/.test(d.message)));
    check('unsupported language (Java) reported', diags.some((d) => d.file_path.endsWith('Main.java')));

    // ------------------------------------------------------------------
    step('3. Tenant isolation');
    const bProject = (path) => api('GET', `/api/projects/${projectId}${path}`, { token: userB.token });
    check('other user cannot open the project', (await bProject('')).status === 404);
    check('other user cannot read metrics', (await bProject(`/analysis/${sourceVersionId}/metrics`)).status === 404);
    check('other user cannot read the graph', (await bProject(`/analysis/${sourceVersionId}/graph`)).status === 404);
    check('other user cannot read plans', (await bProject('/plans')).status === 404);
    check('other user cannot read blueprints', (await bProject('/blueprints')).status === 404);
    check('other user cannot read reports', (await bProject('/reports')).status === 404);
    const bTrigger = await api('POST', `/api/projects/${projectId}/scenarios`, {
      token: userB.token, body: { source_version_id: sourceVersionId, strategy_type: 'conservative' },
    });
    check('other user cannot decompose it', bTrigger.status === 404, `status ${bTrigger.status}`);
    const bOwnProject = await api('POST', '/api/projects', { token: userB.token, body: { name: 'b-project', source_type: 'zip' } });
    const bDecomposeForeign = await api('POST', `/api/projects/${bOwnProject.data.data.id}/scenarios`, {
      token: userB.token, body: { source_version_id: sourceVersionId, strategy_type: 'conservative' },
    });
    check("cannot decompose another tenant's source version via own project", bDecomposeForeign.status === 404, `status ${bDecomposeForeign.status}`);

    // ------------------------------------------------------------------
    step('4. AI intelligence (LLM)');
    if (process.env.SKIP_LLM) {
      skip('intelligence findings', 'SKIP_LLM set');
    } else {
      const trig = await api('POST', `/api/projects/${projectId}/intelligence/trigger`, { token: userA.token, body: { source_version_id: sourceVersionId } });
      check('intelligence accepted', trig.status === 202, `status ${trig.status}`);
      const bFindings = await api('GET', `/api/projects/${projectId}/intelligence/${sourceVersionId}/findings`, { token: userB.token });
      check('other user cannot read findings', bFindings.status === 404);
      try {
        const findings = await until('LLM findings', async () => {
          const res = await api('GET', `/api/projects/${projectId}/intelligence/${sourceVersionId}/findings`, { token: userA.token });
          return res.data?.data?.length ? res.data.data : null;
        }, { timeoutMs: 120000, intervalMs: 4000 });
        check('LLM produced findings', findings.length > 0, `${findings.length} findings`);
        const review = await api('POST', `/api/projects/${projectId}/intelligence/findings/${findings[0].id}/review`, {
          token: userA.token, body: { review_status: 'approved' },
        });
        check('finding review saved', review.status === 200);
      } catch (err) {
        check('LLM produced findings', false, err.message);
      }
    }

    // ------------------------------------------------------------------
    step('5. Decomposition');
    const scenarioIds = {};
    for (const strategy of ['conservative', 'aggressive', 'domain']) {
      const res = await api('POST', `/api/projects/${projectId}/scenarios`, {
        token: userA.token, body: { source_version_id: sourceVersionId, strategy_type: strategy },
      });
      check(`${strategy} scenario created`, res.status === 202 && res.data?.data?.id, JSON.stringify(res.data));
      scenarioIds[strategy] = res.data?.data?.id;
    }
    const invalid = await api('POST', `/api/projects/${projectId}/scenarios`, {
      token: userA.token, body: { source_version_id: sourceVersionId, strategy_type: 'nonsense' },
    });
    check('unknown strategy rejected', invalid.status === 400);

    const scenarios = {};
    for (const [strategy, id] of Object.entries(scenarioIds)) {
      scenarios[strategy] = await until(`${strategy} scenario`, async () => {
        const res = await api('GET', `/api/projects/${projectId}/scenarios/${id}`, { token: userA.token });
        return ['completed', 'failed'].includes(res.data?.data?.status) ? res.data.data : null;
      }, { timeoutMs: 90000 });
      const services = scenarios[strategy].proposed_services || [];
      check(`${strategy} scenario completed`, scenarios[strategy].status === 'completed');
      const assignedFiles = services.flatMap((s) => s.assigned_nodes).filter((n) => n.split('::').length === 2);
      check(`${strategy}: every file belongs to exactly one service`,
        assignedFiles.length === FIXTURE_SOURCE_COUNT && new Set(assignedFiles).size === FIXTURE_SOURCE_COUNT,
        `${assignedFiles.length} assignments / ${new Set(assignedFiles).size} unique`);
      check(`${strategy}: service names are DNS-safe and unique`,
        services.every((s) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(s.name)) && new Set(services.map((s) => s.name)).size === services.length,
        services.map((s) => s.name).join(','));
      check(`${strategy}: not one service per file`, services.length > 0 && services.length < FIXTURE_SOURCE_COUNT, `${services.length} services`);
    }
    const domainNames = (scenarios.domain.proposed_services || []).map((s) => s.name).sort();
    check('domain strategy follows the package layout', ['billing-service', 'users-service', 'web-service'].every((n) => domainNames.includes(n)), domainNames.join(','));

    // ------------------------------------------------------------------
    step('6. Migration plan');
    const planRes = await api('POST', `/api/projects/${projectId}/scenarios/${scenarioIds.domain}/plans`, {
      token: userA.token,
      body: { title: 'e2e plan', assumptions: { cloud_provider: 'aws', pricing_region: 'us-east-1', cost_multiplier: 1, team_count: 3, risk_tolerance: 'medium', migration_window_months: 6 } },
    });
    check('plan generated', planRes.status === 201 && planRes.data?.data?.latest_revision, JSON.stringify(planRes.data).slice(0, 200));
    const plan = planRes.data.data;
    const realNames = new Set((scenarios.domain.proposed_services || []).map((s) => s.name));
    const plannedServices = (plan.latest_revision.team_mapping?.team_assignments || []).flatMap((t) => t.assigned_services);
    check('plan uses the real services (no placeholders)', plannedServices.length === realNames.size && plannedServices.every((n) => realNames.has(n)), plannedServices.join(','));
    check('plan has roadmap stages and cost model', plan.latest_revision.roadmap?.stages?.length > 0 && plan.latest_revision.cost_performance?.microservices_monthly_cost_usd > 0);

    const recalc = await api('POST', `/api/projects/${projectId}/plans/${plan.id}/assumptions`, {
      token: userA.token,
      body: { assumptions: { cloud_provider: 'gcp', pricing_region: 'europe-west1', cost_multiplier: 1.5, team_count: 5, risk_tolerance: 'low', migration_window_months: 9 } },
    });
    check('plan recalculated as a new revision', recalc.status === 200 && recalc.data?.data?.revisions?.length === 2, `status ${recalc.status}`);
    const recalcServices = (recalc.data?.data?.latest_revision?.team_mapping?.team_assignments || []).flatMap((t) => t.assigned_services);
    check('recalculation still uses the real services', recalcServices.length === realNames.size && recalcServices.every((n) => realNames.has(n)), recalcServices.join(','));
    check('revisions have ids and timestamps', recalc.data.data.revisions.every((r) => r.id && r.created_at));
    const planAsB = await api('GET', `/api/projects/${bOwnProject.data.data.id}/plans/${plan.id}`, { token: userB.token });
    check("other user cannot read the plan through their own project", planAsB.status === 404, `status ${planAsB.status}`);

    // ------------------------------------------------------------------
    step('7. Report websocket authentication');
    const foreign = connectSocket(GATEWAY, { transports: ['websocket'], auth: { token: 'garbage' }, reconnection: false });
    const foreignErr = await new Promise((resolve) => { foreign.on('connect_error', resolve); setTimeout(() => resolve(null), 5000); });
    check('socket without a valid token is rejected', foreignErr?.message === 'unauthorized');
    foreign.close();

    socket = connectSocket(GATEWAY, { transports: ['websocket'], auth: { token: userA.token }, reconnection: false });
    await new Promise((resolve, reject) => { socket.on('connect', resolve); socket.on('connect_error', reject); });
    const joined = await new Promise((resolve) => socket.emit('join_project', projectId, resolve));
    check('owner can join the project room', joined?.ok === true);
    const intruder = connectSocket(GATEWAY, { transports: ['websocket'], auth: { token: userB.token }, reconnection: false });
    await new Promise((resolve) => intruder.on('connect', resolve));
    const denied = await new Promise((resolve) => intruder.emit('join_project', projectId, resolve));
    check("another user cannot join the project's room", denied?.ok === false);
    intruder.close();
    const events = [];
    socket.on('report_completed', (payload) => events.push(payload));
    const t0 = Date.now();

    // ------------------------------------------------------------------
    step('8. Blueprint export');
    const bpStarted = Date.now();
    const bpRes = await api('POST', `/api/projects/${projectId}/blueprints`, { token: userA.token, body: { planId: plan.id } });
    check('blueprint generated', bpRes.status === 200 && bpRes.data?.data?.id, JSON.stringify(bpRes.data).slice(0, 200));
    const blueprint = bpRes.data.data;
    if (!WITH_REDIS) check('blueprint creation does not hang on the unavailable report queue', Date.now() - bpStarted < 30000, `${Date.now() - bpStarted}ms`);
    const files = blueprint.files || {};
    check('response includes file previews', Object.keys(files).length > 10, `${Object.keys(files).length} files`);
    const tf = files['blueprint/infrastructure/terraform/main.tf'] || '';
    check('terraform generated for the selected cloud', /google_artifact_registry_repository/.test(tf) && tf.includes('europe-west1') && tf.includes('billing-service'));
    check('every service has Dockerfile and k8s manifests', [...realNames].every((n) =>
      files[`blueprint/services/${n}/Dockerfile`] && files[`blueprint/services/${n}/k8s/deployment.yaml`]));
    check('all blueprint validation checks pass', Object.values(blueprint.manifest?.validation_results || {}).length > 0
      && Object.values(blueprint.manifest.validation_results).every(Boolean), JSON.stringify(blueprint.manifest?.validation_results));

    const filesRes = await api('GET', `/api/projects/${projectId}/blueprints/${blueprint.id}/files`, { token: userA.token });
    check('files endpoint matches the created blueprint', filesRes.status === 200 && Object.keys(filesRes.data.data.files).length === Object.keys(files).length);
    const dl = await api('GET', `/api/projects/${projectId}/blueprints/${blueprint.id}/download`, { token: userA.token });
    const zipBytes = Buffer.from(await dl.res.arrayBuffer());
    check('download is a valid ZIP', dl.status === 200 && zipBytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])));
    const dlAsB = await api('GET', `/api/projects/${projectId}/blueprints/${blueprint.id}/download`, { token: userB.token });
    check('other user cannot download it', dlAsB.status === 404);
    const fakeRevision = await api('POST', `/api/projects/${bOwnProject.data.data.id}/blueprints`, {
      token: userB.token, body: { scenarioRevisionId: blueprint.scenario_revision_id, planRevisionId: blueprint.plan_revision_id },
    });
    check("other user cannot build a blueprint from someone else's revisions", fakeRevision.status === 404, `status ${fakeRevision.status}`);

    // ------------------------------------------------------------------
    step('9. Deployment simulation');
    const dep = await api('POST', `/api/projects/${projectId}/deployments`, { token: userA.token, body: { blueprintId: blueprint.id } });
    check('deployment started', dep.status === 202 && dep.data?.data?.id, JSON.stringify(dep.data));
    const deployed = await until('deployment to finish', async () => {
      const res = await api('GET', `/api/projects/${projectId}/deployments/${dep.data.data.id}`, { token: userA.token });
      return res.data?.data?.status === 'deployed' ? res.data.data : null;
    }, { timeoutMs: 60000, intervalMs: 1500 });
    check('deployment reached "deployed" with logs', deployed.status === 'deployed' && deployed.logs.length === 4);
    const health2 = await api('GET', `/api/projects/${projectId}/deployments/${dep.data.data.id}/services`, { token: userA.token });
    check('service health available', health2.status === 200 && health2.data.data.length > 0);

    // ------------------------------------------------------------------
    step(WITH_REDIS ? '10. Report (worker -> AI service -> Redis -> gateway -> socket)' : '10. Report (AI service called directly; queue/socket path skipped)');
    const aiGenerate = () => http('POST', `${AI_URL}/api/reports/generate`, {
      headers: INTERNAL_KEY ? { 'X-Internal-Key': INTERNAL_KEY } : {}, body: { project_id: projectId, owner_id: userA.id },
    });
    if (!WITH_REDIS) {
      const direct = await aiGenerate();
      check('AI service accepted the report request', direct.status === 202, `status ${direct.status}`);
    }
    const report = await until('report to complete', async () => {
      const res = await api('GET', `/api/projects/${projectId}/reports`, { token: userA.token });
      return ['completed', 'failed'].includes(res.data?.data?.status) ? res.data.data : null;
    }, { timeoutMs: 120000, intervalMs: 3000 });
    check('report completed', report.status === 'completed', report.payload?.error || report.status);
    const payload = report.payload || {};
    const domainServices = scenarios.domain.proposed_services || [];
    check('report lists every proposed service', payload.decomposition_strategy?.length === domainServices.length, `${payload.decomposition_strategy?.length} vs ${domainServices.length}`);
    check('report has cost analysis', payload.cost_analysis?.projected_microservices_cost_monthly > 0 && payload.cost_analysis?.infrastructure_multiplier > 0);
    check('report has risk assessment', Array.isArray(payload.risk_assessment?.mitigation_strategies));
    check('report timeline derived from the roadmap', payload.executive_summary?.estimated_timeline_months > 0, JSON.stringify(payload.executive_summary));
    check('executive summary present', typeof payload.executive_summary?.business_impact === 'string' && payload.executive_summary.business_impact.length > 20);
    const billing = (payload.decomposition_strategy || []).find((s) => s.service_name === 'billing-service');
    check('report shows billing-service depends on users-service', billing?.dependencies?.includes('users-service'), JSON.stringify(billing));

    if (WITH_REDIS) {
      await until('websocket report_completed event', async () => events.length > 0, { timeoutMs: 15000, intervalMs: 500 })
        .then(() => check('websocket delivered report_completed for the first report', events[0].project_id === projectId && events[0].status === 'completed'))
        .catch(() => check('websocket delivered report_completed for the first report', false, 'no event received'));
    } else {
      skip('websocket event delivery', 'needs Redis');
    }

    const eventsBefore = events.length;
    const queueStarted = Date.now();
    const regen = await api('POST', `/api/projects/${projectId}/reports/generate`, { token: userA.token });
    if (WITH_REDIS) {
      check('report regeneration queued', regen.status === 202, `status ${regen.status} ${JSON.stringify(regen.data)}`);
    } else {
      check('queueing a report fails fast with 503 when the queue is down', regen.status === 503 && Date.now() - queueStarted < 15000, `status ${regen.status} after ${Date.now() - queueStarted}ms`);
      const direct = await aiGenerate();
      check('second report requested from the AI service', direct.status === 202, `status ${direct.status}`);
    }
    const second = await until('second report version', async () => {
      const res = await api('GET', `/api/projects/${projectId}/reports`, { token: userA.token });
      return res.data?.data?.version_number >= 2 && ['completed', 'failed'].includes(res.data.data.status) ? res.data.data : null;
    }, { timeoutMs: 120000, intervalMs: 3000 });
    check('second report version completed', second.status === 'completed' && second.version_number === 2);
    if (WITH_REDIS) {
      await sleep(1500);
      check('websocket delivered the second event', events.length > eventsBefore);
    }
    const regenAsB = await api('POST', `/api/projects/${projectId}/reports/generate`, { token: userB.token });
    check('other user cannot queue reports', regenAsB.status === 404);
  } catch (err) {
    check(`unexpected error: ${err.message}`, false, err.stack?.split('\n').slice(0, 3).join(' | '));
  } finally {
    // ------------------------------------------------------------------
    step('Cleanup');
    try { socket?.close(); } catch { /* ignore */ }
    if (projectId) {
      const removed = await removeStoragePrefix(`projects/${projectId}`).catch(() => -1);
      console.log(`  removed ${removed} stored objects`);
    }
    await deleteUser(userA);
    await deleteUser(userB);
    console.log(`  deleted throwaway users (their projects cascade); project id for Neo4j cleanup: ${projectId}`);
    if (projectId) console.log(`E2E_PROJECT_ID=${projectId}`);
  }

  const failed = results.filter((r) => !r.ok);
  const skipped = results.filter((r) => r.skipped);
  console.log(`\n${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  [${f.step}] ${f.name}${f.detail ? ` -> ${f.detail}` : ''}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main();
