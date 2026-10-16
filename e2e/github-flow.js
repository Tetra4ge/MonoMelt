#!/usr/bin/env node
/**
 * Live end-to-end run for a real public GitHub repository.
 *
 * Signs in as an existing user (or a throwaway one), imports the repository through
 * the gateway exactly as the UI does, then follows the whole pipeline to the final
 * report:
 *
 *   GitHub import -> worker ingestion -> analysis -> intelligence -> decomposition
 *   -> plan -> blueprint -> deployment -> report -> websocket event
 *
 * Every stage records its checks and timings; the full result is written to
 * e2e/results/ as JSON. The Notion export is intentionally not exercised.
 *
 * Config (env, falling back to ../api-gateway/.env and ../frontend/.env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (VITE_SUPABASE_ANON_KEY)
 *   GATEWAY_URL            default http://localhost:4000
 *   REPO_URL               default https://github.com/Rahul-8283/chatverse-ai
 *   REPO_BRANCH            default main
 *   E2E_USER_EMAIL         sign in as this existing user (admin magic link, no email sent,
 *                          password untouched). Omit to use a throwaway user that is deleted after.
 *   KEEP_PROJECT=1         keep the project after the run (always kept for E2E_USER_EMAIL)
 *   SKIP_LLM=1             skip the AI intelligence step
 *
 *   node e2e/github-flow.js
 */
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------
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
const GATEWAY = (process.env.GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '');
const REPO_URL = process.env.REPO_URL || 'https://github.com/Rahul-8283/chatverse-ai';
const REPO_BRANCH = process.env.REPO_BRANCH || 'main';
const USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const KEEP = process.env.KEEP_PROJECT === '1' || !!USER_EMAIL;

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, SUPABASE_ANON_KEY: ANON_KEY })) {
  if (!v) { console.error(`Missing ${k}`); process.exit(2); }
}

const { io: connectSocket } = require(path.join(__dirname, '../frontend/node_modules/socket.io-client'));

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------
const results = [];
const timings = {};
const data = {};
let stage = '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s`;

function check(name, ok, detail = '') {
  results.push({ stage, name, ok: !!ok, detail: String(detail) });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  -> ${detail}` : ''}`);
  return !!ok;
}
function info(msg) { console.log(`        ${msg}`); }
function begin(title) {
  stage = title;
  timings[title] = { start: Date.now() };
  console.log(`\n[${stamp()}] == ${title}`);
}
function end() { if (timings[stage]) timings[stage].seconds = Number(((Date.now() - timings[stage].start) / 1000).toFixed(1)); }

async function until(label, fn, { timeoutMs = 120000, intervalMs = 2500, onTick } = {}) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    last = await fn();
    if (onTick) onTick(last);
    if (last && last.done) return last.value;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s waiting for: ${label}`);
}

async function http(method, url, { token, body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  const res = await fetch(url, init);
  const type = res.headers.get('content-type') || '';
  const json = type.includes('json') ? await res.json().catch(() => null) : null;
  return { status: res.status, data: json, res };
}
const api = (method, route, opts) => http(method, `${GATEWAY}${route}`, opts);
const admin = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

// ---------------------------------------------------------------------------
// authentication
// ---------------------------------------------------------------------------
async function signInExisting(email) {
  const link = await http('POST', `${SUPABASE_URL}/auth/v1/admin/generate_link`, { headers: admin, body: { type: 'magiclink', email } });
  const hashed = link.data?.hashed_token || link.data?.properties?.hashed_token;
  if (!hashed) throw new Error(`Could not create a sign-in link: ${link.status} ${JSON.stringify(link.data).slice(0, 200)}`);
  const session = await http('POST', `${SUPABASE_URL}/auth/v1/verify`, { headers: { apikey: ANON_KEY }, body: { type: 'magiclink', token_hash: hashed } });
  if (!session.data?.access_token) throw new Error(`Could not verify the sign-in link: ${session.status}`);
  return { id: session.data.user.id, email, token: session.data.access_token, throwaway: false };
}
async function createThrowaway() {
  const email = `e2e-live-${Date.now()}@example.com`;
  const password = `E2e-${Math.random().toString(36).slice(2)}-Aa1!`;
  const created = await http('POST', `${SUPABASE_URL}/auth/v1/admin/users`, { headers: admin, body: { email, password, email_confirm: true } });
  if (created.status >= 300) throw new Error(`Could not create a test user: ${created.status}`);
  const login = await http('POST', `${SUPABASE_URL}/auth/v1/token?grant_type=password`, { headers: { apikey: ANON_KEY }, body: { email, password } });
  return { id: created.data.id, email, token: login.data.access_token, throwaway: true };
}

// ---------------------------------------------------------------------------
// the run
// ---------------------------------------------------------------------------
async function main() {
  let user = null;
  let projectId = null;
  let socket = null;
  const socketEvents = [];

  try {
    // ------------------------------------------------------------------
    begin('0. Platform and authentication');
    const health = await api('GET', '/health');
    check('gateway is up', health.status === 200 && health.data?.status === 'up');
    check('AI service reachable from the gateway', health.data?.services?.['ai-service'] === 'up', JSON.stringify(health.data?.services));
    check('Neo4j connected', health.data?.services?.neo4j === 'connected', JSON.stringify(health.data?.services));
    check('requests without a token are rejected', (await api('GET', '/api/projects')).status === 401);

    user = USER_EMAIL ? await signInExisting(USER_EMAIL) : await createThrowaway();
    check(`signed in (${user.throwaway ? 'throwaway user' : 'existing account'})`, !!user.token);
    const me = await api('GET', '/api/auth/me', { token: user.token });
    check('token accepted by the gateway', me.status === 200 && me.data?.data?.id === user.id, `status ${me.status}`);
    end();

    // ------------------------------------------------------------------
    begin('1. Project and GitHub import');
    const project = await api('POST', '/api/projects', {
      token: user.token,
      body: { name: `chatverse-ai (e2e ${new Date().toISOString().slice(0, 16).replace('T', ' ')})`, description: `Live E2E import of ${REPO_URL}`, source_type: 'github' },
    });
    check('project created', project.status === 201 && project.data?.data?.id, JSON.stringify(project.data).slice(0, 160));
    projectId = project.data.data.id;
    data.projectId = projectId;

    const badUrl = await api('POST', `/api/projects/${projectId}/sources/github`, { token: user.token, body: { repoUrl: 'http://evil.example/a/b' } });
    check('non-GitHub URL is rejected before queueing', badUrl.status === 400, `status ${badUrl.status}`);
    const badBranch = await api('POST', `/api/projects/${projectId}/sources/github`, { token: user.token, body: { repoUrl: REPO_URL, branch: '../x' } });
    check('unsafe branch name is rejected', badBranch.status === 400, `status ${badBranch.status}`);

    // Realtime listener first, so the report event cannot be missed later.
    socket = connectSocket(GATEWAY, { transports: ['websocket'], auth: { token: user.token }, reconnection: false });
    await new Promise((resolve, reject) => { socket.on('connect', resolve); socket.on('connect_error', reject); setTimeout(() => reject(new Error('socket connect timeout')), 8000); });
    const joined = await new Promise((resolve) => socket.emit('join_project', projectId, resolve));
    check('websocket connected and joined the project room', joined?.ok === true, JSON.stringify(joined));
    socket.on('report_completed', (payload) => { socketEvents.push({ ...payload, at: Date.now() }); info(`socket event: ${JSON.stringify(payload)}`); });

    const imp = await api('POST', `/api/projects/${projectId}/sources/github`, { token: user.token, body: { repoUrl: REPO_URL, branch: REPO_BRANCH } });
    check('GitHub import accepted (202)', imp.status === 202, JSON.stringify(imp.data).slice(0, 200));
    const { jobId, sourceVersionId } = imp.data.data;
    data.jobId = jobId; data.sourceVersionId = sourceVersionId;
    end();

    // ------------------------------------------------------------------
    begin('2. Worker ingestion and AI analysis');
    const seen = [];
    const job = await until('analysis job to finish', async () => {
      const res = await api('GET', `/api/projects/${projectId}/jobs/${jobId}`, { token: user.token });
      const j = res.data?.data;
      if (j && seen[seen.length - 1] !== j.status) { seen.push(j.status); info(`job status -> ${j.status}${j.error_code ? ` (${j.error_code})` : ''}`); }
      return { done: j && ['completed', 'failed'].includes(j.status), value: j };
    }, { timeoutMs: 300000, intervalMs: 2000 });
    check('job reached completed', job.status === 'completed', `${job.status}: ${job.error_code || ''}`);
    check('job passed through the expected stages', ['queued', 'ingesting', 'ready'].every((s) => seen.includes(s) || s === 'queued') && seen.includes('analyzing'), seen.join(' > '));
    data.jobStatuses = seen;

    const m = (await api('GET', `/api/projects/${projectId}/analysis/${sourceVersionId}/metrics`, { token: user.token })).data?.data || {};
    data.metrics = m;
    info(`metrics: ${JSON.stringify({ files: m.total_files, lines: m.total_lines, functions: m.total_functions, classes: m.total_classes, cycles: m.cycle_count, components: m.graph_components, unresolved: m.unresolved_imports, languages: m.language_breakdown })}`);
    check('metrics available', m.total_files > 0);
    check('analysed a plausible number of source files (expected about 26 ts/tsx)', m.total_files >= 20 && m.total_files <= 40, `total_files=${m.total_files}`);
    check('lines of code counted', m.total_lines > 500, `total_lines=${m.total_lines}`);
    check('functions and classes found', m.total_functions > 10, `functions=${m.total_functions} classes=${m.total_classes}`);
    check('TypeScript detected', (m.language_breakdown?.typescript || 0) > 0, JSON.stringify(m.language_breakdown));

    const graph = (await api('GET', `/api/projects/${projectId}/analysis/${sourceVersionId}/graph?limit=500`, { token: user.token })).data?.data || { nodes: [], edges: [] };
    data.graphSummary = { nodes: graph.nodes.length, edges: graph.edges.length, total_nodes: graph.total_nodes, total_edges: graph.total_edges };
    info(`graph: ${JSON.stringify(data.graphSummary)}`);
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    const fileNodes = graph.nodes.filter((n) => n.label === 'File');
    const fileIds = new Set(fileNodes.map((n) => n.id));
    const fileEdges = graph.edges.filter((e) => e.relationship === 'IMPORTS' && fileIds.has(e.source_id) && fileIds.has(e.target_id));
    check('graph has File nodes', fileNodes.length === m.total_files, `${fileNodes.length} vs ${m.total_files}`);
    check('graph has File -> File import edges (resolved imports)', fileEdges.length > 10, `${fileEdges.length} internal edges`);
    check('no edge points outside the returned page', graph.edges.every((e) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id)));
    check('symbols carry a type', graph.nodes.some((n) => n.label === 'Symbol' && n.properties?.symbol_type));
    check('external packages are separate nodes', graph.nodes.some((n) => n.label === 'ExternalDependency'));
    check('no unresolved local imports', m.unresolved_imports === 0, `unresolved=${m.unresolved_imports}`);
    data.internalEdges = fileEdges.length;

    const diag = (await api('GET', `/api/projects/${projectId}/analysis/${sourceVersionId}/diagnostics`, { token: user.token })).data?.data;
    data.diagnostics = diag?.diagnostics || [];
    check('diagnostics endpoint works', diag && Array.isArray(diag.diagnostics), `total=${diag?.total}`);
    info(`diagnostics: ${diag?.total} (${[...new Set(data.diagnostics.map((d) => d.severity))].join(', ') || 'none'})`);
    end();

    // ------------------------------------------------------------------
    begin('3. AI intelligence (LLM findings)');
    if (process.env.SKIP_LLM) {
      info('skipped (SKIP_LLM=1)');
    } else {
      const trig = await api('POST', `/api/projects/${projectId}/intelligence/trigger`, { token: user.token, body: { source_version_id: sourceVersionId } });
      check('intelligence accepted', trig.status === 202, `status ${trig.status}`);
      try {
        const findings = await until('LLM findings', async () => {
          const res = await api('GET', `/api/projects/${projectId}/intelligence/${sourceVersionId}/findings`, { token: user.token });
          const rows = res.data?.data || [];
          return { done: rows.length > 0, value: rows };
        }, { timeoutMs: 180000, intervalMs: 4000 });
        data.findings = findings;
        check('LLM returned findings', findings.length > 0, `${findings.length} findings`);
        check('findings have type, explanation and confidence in [0,1]', findings.every((f) => f.finding_type && f.explanation && f.confidence >= 0 && f.confidence <= 1));
        check('findings start unreviewed', findings.every((f) => f.review_status === 'pending'));
        const rev = await api('POST', `/api/projects/${projectId}/intelligence/findings/${findings[0].id}/review`, { token: user.token, body: { review_status: 'approved' } });
        check('a finding can be approved', rev.status === 200);
        info(`finding types: ${[...new Set(findings.map((f) => f.finding_type))].join(', ')}`);
      } catch (err) {
        check('LLM returned findings', false, err.message);
      }
    }
    end();

    // ------------------------------------------------------------------
    begin('4. Decomposition (3 strategies)');
    const scenarios = {};
    for (const strategy of ['conservative', 'aggressive', 'domain']) {
      const res = await api('POST', `/api/projects/${projectId}/scenarios`, { token: user.token, body: { source_version_id: sourceVersionId, strategy_type: strategy } });
      check(`${strategy} accepted`, res.status === 202 && res.data?.data?.id, `status ${res.status} ${JSON.stringify(res.data).slice(0, 120)}`);
      scenarios[strategy] = res.data?.data?.id;
    }
    const decomposed = {};
    for (const [strategy, id] of Object.entries(scenarios)) {
      if (!id) continue;
      const s = await until(`${strategy} scenario`, async () => {
        const res = await api('GET', `/api/projects/${projectId}/scenarios/${id}`, { token: user.token });
        const d = res.data?.data;
        return { done: d && ['completed', 'failed'].includes(d.status), value: d };
      }, { timeoutMs: 120000, intervalMs: 3000 });
      decomposed[strategy] = s;
      const services = s.proposed_services || [];
      check(`${strategy} completed`, s.status === 'completed', s.status);
      const assigned = services.flatMap((x) => x.assigned_nodes).filter((n) => fileIds.has(n) || n.split('::').length === 2);
      check(`${strategy}: every analysed file belongs to exactly one service`, new Set(assigned).size === m.total_files && assigned.length === m.total_files, `${assigned.length} assigned / ${new Set(assigned).size} unique / ${m.total_files} files`);
      check(`${strategy}: DNS-safe unique service names`, services.length > 0 && services.every((x) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(x.name)) && new Set(services.map((x) => x.name)).size === services.length, services.map((x) => x.name).join(','));
      check(`${strategy}: sensible service count`, services.length >= 1 && services.length <= m.total_files, `${services.length} services`);
      info(`${strategy}: ${services.length} services -> ${services.map((x) => `${x.name}(${x.metrics?.file_count})`).join(', ')}`);
    }
    data.scenarios = Object.fromEntries(Object.entries(decomposed).map(([k, v]) => [k, (v.proposed_services || []).map((x) => ({ name: x.name, files: x.metrics?.file_count, internal: x.metrics?.internal_edges, external: x.metrics?.external_edges_out }))]));
    end();

    // ------------------------------------------------------------------
    begin('5. Migration plan');
    const scenarioId = scenarios.domain || scenarios.conservative;
    const planRes = await api('POST', `/api/projects/${projectId}/scenarios/${scenarioId}/plans`, {
      token: user.token,
      body: { title: 'chatverse-ai migration plan', assumptions: { cloud_provider: 'aws', pricing_region: 'us-east-1', cost_multiplier: 1, team_count: 3, risk_tolerance: 'medium', migration_window_months: 6 } },
    });
    check('plan generated (201)', planRes.status === 201 && planRes.data?.data?.latest_revision, `status ${planRes.status} ${JSON.stringify(planRes.data).slice(0, 160)}`);
    const plan = planRes.data.data;
    data.planId = plan.id;
    const realNames = new Set((decomposed.domain?.proposed_services || decomposed.conservative.proposed_services).map((x) => x.name));
    const rev1 = plan.latest_revision;
    const planned = new Set(rev1.roadmap.stages.flatMap((st) => st.target_services));
    const infra = new Set(['API-Gateway-Infrastructure', 'Legacy-Monolith-Decommission']);
    check('roadmap covers every real service and invents none', [...realNames].every((n) => planned.has(n)) && [...planned].every((n) => realNames.has(n) || infra.has(n)), [...planned].join(','));
    check('team map uses only real services', rev1.team_mapping.team_assignments.flatMap((t) => t.assigned_services).every((n) => realNames.has(n)));
    check('cost model produced values', rev1.cost_performance.monolith_monthly_cost_usd > 0 && rev1.cost_performance.microservices_monthly_cost_usd > 0);
    info(`roadmap: ${rev1.roadmap.pattern_recommended}, ${rev1.roadmap.total_duration_weeks} weeks, ${rev1.roadmap.stages.length} stages; cost $${rev1.cost_performance.monolith_monthly_cost_usd} -> $${rev1.cost_performance.microservices_monthly_cost_usd}`);

    const recalc = await api('POST', `/api/projects/${projectId}/plans/${plan.id}/assumptions`, {
      token: user.token,
      body: { assumptions: { cloud_provider: 'gcp', pricing_region: 'europe-west1', cost_multiplier: 1.4, team_count: 4, risk_tolerance: 'low', migration_window_months: 9 } },
    });
    check('recalculation creates revision 2', recalc.status === 200 && recalc.data?.data?.revisions?.length === 2, `status ${recalc.status}`);
    check('recalculated plan has ids and timestamps on every revision', recalc.data?.data?.revisions?.every((r) => r.id && r.created_at));
    check('recalculated plan keeps the real services', recalc.data?.data?.latest_revision?.team_mapping?.team_assignments?.flatMap((t) => t.assigned_services).every((n) => realNames.has(n)));
    const plans = await api('GET', `/api/projects/${projectId}/plans`, { token: user.token });
    check('plan list returns the plan with 2 revisions', plans.data?.data?.[0]?.plan_revisions?.length === 2);
    end();

    // ------------------------------------------------------------------
    begin('6. Blueprint export');
    const t1 = Date.now();
    const bp = await api('POST', `/api/projects/${projectId}/blueprints`, { token: user.token, body: { planId: plan.id } });
    check('blueprint generated (200)', bp.status === 200 && bp.data?.data?.id, `status ${bp.status} ${JSON.stringify(bp.data).slice(0, 160)}`);
    check('blueprint request returned promptly (report job must not block it)', Date.now() - t1 < 30000, `${Date.now() - t1}ms`);
    const blueprint = bp.data.data;
    data.blueprintId = blueprint.id;
    const files = blueprint.files || {};
    check('response carries file previews', Object.keys(files).length >= 8 + realNames.size * 5, `${Object.keys(files).length} files`);
    check('terraform main.tf generated for the recalculated cloud (gcp)', /google_artifact_registry_repository/.test(files['blueprint/infrastructure/terraform/main.tf'] || ''));
    check('every service has a Dockerfile and Kubernetes manifests', [...realNames].every((n) => files[`blueprint/services/${n}/Dockerfile`] && files[`blueprint/services/${n}/k8s/deployment.yaml`] && files[`blueprint/services/${n}/k8s/service.yaml`]));
    check('manifest validation checks all pass', Object.values(blueprint.manifest?.validation_results || {}).length === 3 && Object.values(blueprint.manifest.validation_results).every(Boolean), JSON.stringify(blueprint.manifest?.validation_results));
    const filesRes = await api('GET', `/api/projects/${projectId}/blueprints/${blueprint.id}/files`, { token: user.token });
    check('files endpoint matches', filesRes.status === 200 && Object.keys(filesRes.data.data.files).length === Object.keys(files).length);
    const dl = await api('GET', `/api/projects/${projectId}/blueprints/${blueprint.id}/download`, { token: user.token });
    const zip = Buffer.from(await dl.res.arrayBuffer());
    check('ZIP download is valid', dl.status === 200 && zip.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])), `${zip.length} bytes`);
    const list = await api('GET', `/api/projects/${projectId}/blueprints`, { token: user.token });
    check('blueprint is listed', list.data?.data?.some((b) => b.id === blueprint.id));
    end();

    // ------------------------------------------------------------------
    begin('7. Deployment simulation');
    const dep = await api('POST', `/api/projects/${projectId}/deployments`, { token: user.token, body: { blueprintId: blueprint.id } });
    check('deployment started (202)', dep.status === 202 && dep.data?.data?.id, `status ${dep.status}`);
    const deployed = await until('deployment', async () => {
      const res = await api('GET', `/api/projects/${projectId}/deployments/${dep.data.data.id}`, { token: user.token });
      return { done: res.data?.data?.status === 'deployed', value: res.data?.data };
    }, { timeoutMs: 60000, intervalMs: 1500 });
    check('deployment reached deployed with 4 log lines', deployed.status === 'deployed' && deployed.logs.length === 4);
    const svc = await api('GET', `/api/projects/${projectId}/deployments/${dep.data.data.id}/services`, { token: user.token });
    check('service health available', svc.status === 200 && svc.data?.data?.length > 0);
    end();

    // ------------------------------------------------------------------
    begin('8. Report (queue -> worker -> AI -> Redis -> gateway -> socket)');
    const report = await until('report', async () => {
      const res = await api('GET', `/api/projects/${projectId}/reports`, { token: user.token });
      const r = res.data?.data;
      return { done: r && ['completed', 'failed'].includes(r.status), value: r };
    }, { timeoutMs: 180000, intervalMs: 3000 });
    data.report = report;
    check('report completed (not failed)', report.status === 'completed', report.payload?.error || report.status);
    const p = report.payload || {};
    check('report version is 1', report.version_number === 1, `v${report.version_number}`);
    const reportServices = (decomposed.domain?.proposed_services || decomposed.conservative.proposed_services).length;
    check('report lists every proposed service of the latest scenario', p.decomposition_strategy?.length === reportServices, `${p.decomposition_strategy?.length} vs ${reportServices}`);
    check('executive summary has services, risk and timeline', p.executive_summary?.total_services_extracted === reportServices && p.executive_summary?.estimated_timeline_months > 0 && ['LOW', 'MEDIUM', 'HIGH'].includes(p.executive_summary?.overall_risk_score), JSON.stringify(p.executive_summary && { ...p.executive_summary, business_impact: undefined }));
    check('business impact text present and not the failure fallback', typeof p.executive_summary?.business_impact === 'string' && p.executive_summary.business_impact.length > 60 && !/failed due to AI provider/.test(p.executive_summary.business_impact), (p.executive_summary?.business_impact || '').slice(0, 80));
    check('cost analysis present with multiplier', p.cost_analysis?.projected_microservices_cost_monthly > 0 && p.cost_analysis?.infrastructure_multiplier > 0);
    check('risk assessment present', Array.isArray(p.risk_assessment?.mitigation_strategies) && p.risk_assessment.mitigation_strategies.length > 0);
    const withDeps = (p.decomposition_strategy || []).filter((x) => x.dependencies?.length);
    check('cross-service dependencies derived from the graph', withDeps.length > 0 || reportServices < 2, `${withDeps.length} services with dependencies`);
    info(`report: ${JSON.stringify({ services: p.executive_summary?.total_services_extracted, risk: p.executive_summary?.overall_risk_score, months: p.executive_summary?.estimated_timeline_months, multiplier: p.cost_analysis?.infrastructure_multiplier, servicesWithDeps: withDeps.length })}`);

    await sleep(1500);
    check('websocket delivered report_completed for this project', socketEvents.some((e) => e.project_id === projectId && e.status === 'completed'), `${socketEvents.length} events`);

    const before = socketEvents.length;
    const regen = await api('POST', `/api/projects/${projectId}/reports/generate`, { token: user.token });
    check('report regeneration queued (202)', regen.status === 202, `status ${regen.status} ${JSON.stringify(regen.data)}`);
    const second = await until('report v2', async () => {
      const res = await api('GET', `/api/projects/${projectId}/reports`, { token: user.token });
      const r = res.data?.data;
      return { done: r && r.version_number >= 2 && ['completed', 'failed'].includes(r.status), value: r };
    }, { timeoutMs: 180000, intervalMs: 3000 });
    check('report v2 completed', second.version_number === 2 && second.status === 'completed', `v${second.version_number} ${second.status}`);
    await sleep(1500);
    check('websocket delivered the second event', socketEvents.length > before, `${socketEvents.length - before} new events`);
    end();
  } catch (err) {
    check(`unexpected error: ${err.message}`, false, (err.stack || '').split('\n').slice(0, 3).join(' | '));
  } finally {
    begin('Cleanup');
    try { socket?.close(); } catch { /* ignore */ }
    if (projectId && !KEEP) {
      const del = await http('DELETE', `${SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}`, { headers: admin });
      info(`project removed: ${del.status}`);
    } else if (projectId) {
      info(`project kept for inspection: ${projectId}`);
    }
    if (user?.throwaway) {
      await http('DELETE', `${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { headers: admin });
      info('throwaway user deleted');
    }
    end();
  }

  const failed = results.filter((r) => !r.ok);
  const out = { repo: REPO_URL, branch: REPO_BRANCH, startedAt: new Date(t0).toISOString(), seconds: Number(((Date.now() - t0) / 1000).toFixed(0)), passed: results.length - failed.length, failed: failed.length, timings, data: { ...data, report: data.report && { status: data.report.status, version: data.report.version_number, payload: data.report.payload } }, results };
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  const file = path.join(__dirname, 'results', `github-flow-${new Date(t0).toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));

  console.log(`\n${out.passed} passed, ${out.failed} failed in ${out.seconds}s  (details: ${path.relative(process.cwd(), file)})`);
  console.log('\nStage timings:');
  for (const [k, v] of Object.entries(timings)) console.log(`  ${String(v.seconds ?? '?').padStart(6)}s  ${k}`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  [${f.stage}] ${f.name}${f.detail ? ` -> ${f.detail}` : ''}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main();
