#!/usr/bin/env node
/**
 * Screenshots of every app page, plus clear pictures of the dependency graph for each
 * decomposition scenario, for the paper.
 *
 *   cd e2e && E2E_USER_EMAIL=you@example.com THEME=light OUT_DIR=../Images/white node ui-screenshots.js
 *
 * Config: THEME (light | dark, default light), OUT_DIR (default ../Images/white), SCALE (device pixel
 * ratio, default 2), ONLY (pages | graphs; default both), PROJECT_ID (default: newest chatverse-ai
 * project with a completed report), GRAPH_WAIT_MS (default 16000), GRAPH_ZOOM (set to skip the automatic framing, default 0).
 * Read-only: it opens pages and scenario tabs, and runs the digital twin replay in the browser.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const S = require('./lib/session');

S.requireConfig();
const { FRONTEND } = S.config;
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light';
const OUT = path.resolve(__dirname, process.env.OUT_DIR || '../Images/white');
const SCALE = Number(process.env.SCALE || 2);
const ONLY = process.env.ONLY || 'all';
const GRAPH_WAIT = Number(process.env.GRAPH_WAIT_MS || 16000);
const GRAPH_ZOOM = Number(process.env.GRAPH_ZOOM || 0);
const GRAPH_HEIGHT = Number(process.env.GRAPH_HEIGHT || 900);

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

(async () => {
  const session = await S.signIn(S.config.EMAIL);
  const projectId = await S.findProject(session);
  if (!projectId) { console.error('No chatverse-ai project found.'); process.exit(2); }
  const bps = await S.json('GET', `${S.config.SUPABASE_URL}/rest/v1/blueprints?project_id=eq.${projectId}&select=id&order=created_at.desc&limit=1`, S.admin());
  const blueprintId = bps.data?.[0]?.id;
  console.log(`theme=${THEME} scale=${SCALE} project=${projectId} -> ${OUT}`);

  fs.mkdirSync(path.join(OUT, 'graphs'), { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: SCALE });
  await S.addSession(context, session);
  await context.addInitScript((theme) => { try { localStorage.setItem('monomelt-theme', theme); } catch { /* ignore */ } }, THEME);
  const p = await context.newPage();
  // Stop the pulsing badges and cursors so a still frame is never caught half faded.
  await context.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = '.animate-pulse,.animate-ping,.animate-spin{animation:none!important}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  });

  /** Size the viewport to the page, let charts finish animating, and capture the whole page. */
  async function shoot(name, file = name) {
    const height = await p.evaluate(() => Math.min(document.documentElement.scrollHeight, 5000)).catch(() => 900);
    await p.setViewportSize({ width: 1440, height: Math.max(900, height) });
    await p.waitForTimeout(2800);
    await p.screenshot({ path: path.join(OUT, `${file}.png`) });
    await p.setViewportSize({ width: 1440, height: 900 });
    console.log(`  saved ${file}.png`);
  }
  const open = async (url) => { await p.goto(`${FRONTEND}${url}`, { waitUntil: 'domcontentloaded' }); };
  const waitText = (re, timeout = 25000) => p.getByText(re).first().waitFor({ timeout });
  const base = `/dashboard/projects/${projectId}`;

  if (ONLY === 'all' || ONLY === 'pages') {
    console.log('\npages');
    await open('/dashboard');
    await waitText(/recent_workspaces/);
    await waitText(/SYSTEM_STATUS/);
    await p.waitForTimeout(3500); // status rows settle to ONLINE
    await shoot('dashboard');

    await open(`${base}/analysis`);
    await waitText(/Microservice Decomposition/i);
    await waitText(/AI Intelligence Findings/i);
    await p.getByRole('button', { name: /^(conservative|aggressive|domain)/i }).first().click();
    await waitText(/Proposed Boundaries/i);
    await p.waitForTimeout(3000);
    await shoot('analysis');

    await open(`${base}/planning`);
    await waitText(/responsibility_map/);
    await waitText(/boundary_controls/);
    await shoot('planning');

    await open(`${base}/export`);
    await waitText(/Generated Artifacts/i);
    await waitText(/Workspace \(\d+\)/);
    await shoot('export');

    await open(`${base}/deployment?blueprintId=${blueprintId}`);
    await waitText(/Live Services Dashboard/i, 60000);
    await shoot('deployment');

    await open(`${base}/twin`);
    await waitText(/DIGITAL TWIN OBSERVATORY/);
    // Until the project's own summary loads, the twin shows its built-in demo data (42 files, Java).
    await p.waitForFunction(() => /\d+\s*FILES/.test(document.body.innerText) && !/42\s*FILES/.test(document.body.innerText), null, { timeout: 30000 });
    await p.waitForTimeout(1500);
    await p.locator('button[title="Reset Pipeline"]').click();
    await p.locator('button[title="Run Simulation"]').click();
    // Run to the end, then pause so the picture shows every stage done. The replay loops otherwise.
    const progress = async () => Number((((await p.locator('body').innerText()).match(/STAGE\s*PROGRESS:\s*\n?(\d+)%/)) || [])[1] ?? 0);
    for (let i = 0; i < 240; i++) {
      if ((await progress()) >= 100) break;
      await p.waitForTimeout(250);
    }
    await p.locator('button[title="Pause Simulation"]').click().catch(() => {});
    await p.waitForTimeout(1200);
    const twinText = await p.locator('body').innerText();
    if (/monolith_ecommerce_demo|OrderController|PaymentGateway|Java \(/i.test(twinText)) throw new Error('digital twin is showing demo data, not the project');
    if ((await progress()) < 100) throw new Error(`digital twin stopped at ${await progress()}%`);
    await shoot('digital-twin');

    await open(`${base}/report`);
    await waitText(/executive_summary/);
    await waitText(/financial_projection/);
    await p.waitForSelector('.recharts-bar-rectangle', { timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(1800);
    await shoot('report');
  }

  if (ONLY === 'all' || ONLY === 'graphs') {
    console.log('\ngraphs');
    await open(`${base}/analysis`);
    await waitText(/Microservice Decomposition/i);

    // Give the graph a tall canvas, let the layout settle, then frame the main cluster once.
    // Every scenario is captured from the same camera, so the pictures compare directly.
    await p.addStyleTag({ content: `div.group.relative{min-height:${GRAPH_HEIGHT}px!important}` });
    await p.evaluate(() => window.dispatchEvent(new Event('resize')));
    await p.waitForTimeout(GRAPH_WAIT);

    /** Extent of the drawn graph in CSS pixels. Outlying nodes are ignored (3rd to 97th percentile). */
    const measure = () => p.evaluate(() => {
      const cv = document.querySelector('canvas');
      const ratio = cv.width / cv.clientWidth;
      const { data } = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
      const xs = [];
      const ys = [];
      for (let y = 0; y < cv.height; y += 2) {
        for (let x = 0; x < cv.width; x += 2) {
          const i = (y * cv.width + x) * 4;
          if (data[i + 3] > 0 && (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235)) { xs.push(x / ratio); ys.push(y / ratio); }
        }
      }
      const at = (arr, q) => { arr.sort((a, b) => a - b); return arr[Math.floor(q * (arr.length - 1))]; };
      const x0 = at(xs, 0.03); const x1 = at(xs, 0.97); const y0 = at(ys, 0.03); const y1 = at(ys, 0.97);
      return { W: cv.clientWidth, H: cv.clientHeight, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    });

    async function frameGraph() {
      const FILL = 0.78;
      // The wheel only reaches the canvas while it is on screen.
      await p.setViewportSize({ width: 1440, height: GRAPH_HEIGHT + 200 });
      await p.locator('canvas').first().scrollIntoViewIfNeeded();
      await p.waitForTimeout(800);
      for (let i = 0; i < 16; i++) {
        const m = await measure();
        const s = Math.min((FILL * m.W) / m.w, (FILL * m.H) / m.h);
        if (s <= 1.04) break;
        // Zoom about the point that carries the cluster centre onto the canvas centre.
        const px = (m.W / 2 - s * m.cx) / (1 - s);
        const py = (m.H / 2 - s * m.cy) / (1 - s);
        const box = await p.locator('canvas').first().boundingBox();
        await p.mouse.move(box.x + Math.max(5, Math.min(m.W - 5, px)), box.y + Math.max(5, Math.min(m.H - 5, py)));
        await p.mouse.wheel(0, -Math.min(240, 60 + (s - 1) * 120));
        await p.waitForTimeout(500);
      }
      const m = await measure();
      console.log(`  framed: cluster ${Math.round(m.w)}x${Math.round(m.h)} of ${m.W}x${m.H}`);
    }
    if (!GRAPH_ZOOM) await frameGraph();

    async function shootGraph(file) {
      const panel = p.locator('div.group.relative:has(canvas)').first().locator('xpath=..');
      await panel.scrollIntoViewIfNeeded();
      await p.waitForTimeout(1200);
      await panel.screenshot({ path: path.join(OUT, 'graphs', `${file}.png`) });
      console.log(`  saved graphs/${file}.png`);
    }

    await shootGraph('graph-dependency');

    for (const [type, file] of [['conservative', 'graph-conservative'], ['aggressive', 'graph-aggressive'], ['domain', 'graph-domain-driven']]) {
      const tab = p.getByRole('button', { name: new RegExp(`^${type}`, 'i') }).first();
      if (!(await tab.count())) { console.log(`  no ${type} scenario tab; skipped`); continue; }
      await tab.click();
      await waitText(new RegExp(`Showing ${type} Boundaries`, 'i'));
      await shootGraph(file);
    }
  }

  await browser.close();
})().catch((err) => { console.error(err); process.exit(2); });
