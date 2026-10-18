#!/usr/bin/env node
/**
 * Theme test: drives the real frontend in headless Chromium and checks the dark/light toggle.
 *
 *   cd e2e && E2E_USER_EMAIL=you@example.com node ui-theme.js
 *
 * Checks that every page follows the chosen theme (dark by default, light when chosen), that the
 * toggle is on the login page and the app pages but never on the landing page, that light mode
 * renders a white page with no large dark surfaces left over, that dark mode is unchanged, and that
 * the choice survives a reload and carries across pages. Read-only: it never starts a job or
 * changes project data, and it takes no screenshots.
 */
const { chromium } = require('playwright');
const S = require('./lib/session');

S.requireConfig();
const { FRONTEND } = S.config;

const results = [];
let section = '';
function check(name, ok, detail = '') {
  results.push({ section, name, ok: !!ok, detail: String(detail) });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  -> ${detail}` : ''}`);
  return !!ok;
}

const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b);
const parse = (css) => (css.match(/[\d.]+/g) || []).slice(0, 4).map(Number);

/** The colour actually painted behind the middle of the page, walking up past transparent layers. */
const pageBackground = (page) => page.evaluate(() => {
  let el = document.elementFromPoint(2, window.innerHeight / 2) || document.body; // left edge: the page itself, not a header strip
  while (el) {
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg.match(/[\d.]+/g) || [];
    if (!(m.length === 4 && Number(m[3]) === 0) && bg !== 'transparent') return bg;
    el = el.parentElement;
  }
  return getComputedStyle(document.body).backgroundColor;
});

/** Large surfaces still painted dark: over 6000 px² and darker than luminance 80. Buttons are skipped; solid dark buttons are intended. */
const darkSurfaces = (page) => page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 6000 || ['CANVAS', 'svg', 'BUTTON', 'A'].includes(el.tagName)) continue;
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg.match(/[\d.]+/g) || [];
    if (m.length < 3 || (m.length === 4 && Number(m[3]) < 0.5)) continue;
    const lum = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
    if (lum < 80) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} ${bg}`);
  }
  return out.slice(0, 5);
});

const theme = (page) => page.evaluate(() => document.documentElement.dataset.theme);
const toggles = (page) => page.getByTestId('theme-toggle').count();

(async () => {
  const session = await S.signIn(S.config.EMAIL);
  const projectId = await S.findProject(session);
  if (!projectId) { console.error('No e2e project found. Run github-flow.js first (or set PROJECT_ID).'); process.exit(2); }
  const bps = await S.json('GET', `${S.config.SUPABASE_URL}/rest/v1/blueprints?project_id=eq.${projectId}&select=id&order=created_at.desc&limit=1`, S.admin());
  const blueprintId = bps.data?.[0]?.id;

  const browser = await chromium.launch();

  // ---- Signed-out pages: landing and login follow the theme; only login has the toggle. -------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();

    section = 'Landing page';
    console.log(`\n== ${section}`);
    await p.goto(`${FRONTEND}/`, { waitUntil: 'domcontentloaded' });
    await p.evaluate(() => localStorage.removeItem('monomelt-theme'));
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    check('has no theme toggle', (await toggles(p)) === 0);
    check('opens in dark by default', (await theme(p)) === 'dark', `data-theme=${await theme(p)}`);
    const landingDark = await pageBackground(p);
    check('dark background is unchanged (#0a0a0a)', landingDark === 'rgb(10, 10, 10)', landingDark);

    section = 'Login page';
    console.log(`\n== ${section}`);
    await p.goto(`${FRONTEND}/login`, { waitUntil: 'domcontentloaded' });
    await p.getByTestId('theme-toggle').first().waitFor({ timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(800);
    check('shows exactly one theme toggle', (await toggles(p)) === 1, `${await toggles(p)} toggles`);
    check('opens in dark by default', (await theme(p)) === 'dark', `data-theme=${await theme(p)}`);
    const loginDark = await pageBackground(p);
    check('dark background is unchanged (#0a0a0a)', loginDark === 'rgb(10, 10, 10)', loginDark);
    await p.getByTestId('theme-toggle').click();
    await p.waitForTimeout(600);
    check('toggle switches to light', (await theme(p)) === 'light', `data-theme=${await theme(p)}`);
    const loginLight = await pageBackground(p);
    check('light background is white', loginLight === 'rgb(255, 255, 255)', loginLight);
    const loginSurfaces = await darkSurfaces(p);
    check('no large dark surfaces remain in light mode', loginSurfaces.length === 0, loginSurfaces.join(' | '));
    const signIn = await p.getByRole('button', { name: /Sign in with GitHub/i }).evaluate((el) => getComputedStyle(el).backgroundColor);
    check('the sign-in button stays readable (solid, not white on white)', signIn !== 'rgb(255, 255, 255)', signIn);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.getByTestId('theme-toggle').first().waitFor({ timeout: 15000 }).catch(() => {});
    check('the light choice survives a reload', (await theme(p)) === 'light', `data-theme=${await theme(p)}`);

    // The choice made on login carries to the landing page, which still has no toggle.
    section = 'Landing page (light)';
    console.log(`\n== ${section}`);
    await p.goto(`${FRONTEND}/`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    check('follows the light choice made on the login page', (await theme(p)) === 'light', `data-theme=${await theme(p)}`);
    check('still has no theme toggle', (await toggles(p)) === 0);
    const landingLight = await pageBackground(p);
    check('light background is white', landingLight === 'rgb(255, 255, 255)', landingLight);
    const landingSurfaces = await darkSurfaces(p);
    check('no large dark surfaces remain in light mode', landingSurfaces.length === 0, landingSurfaces.join(' | '));

    // Back to dark on login.
    await p.goto(`${FRONTEND}/login`, { waitUntil: 'domcontentloaded' });
    await p.getByTestId('theme-toggle').first().waitFor({ timeout: 15000 });
    await p.getByTestId('theme-toggle').click();
    await p.waitForTimeout(500);
    section = 'Login page';
    check('toggle switches back to dark', (await theme(p)) === 'dark');
    await ctx.close();
  }

  // ---- App pages. -------------------------------------------------------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await S.addSession(ctx, session);
  const p = await ctx.newPage();
  const base = `/dashboard/projects/${projectId}`;
  const pages = [
    ['Dashboard', '/dashboard'],
    ['Analysis', `${base}/analysis`],
    ['Planning', `${base}/planning`],
    ['Export', `${base}/export`],
    ['Deployment', `${base}/deployment?blueprintId=${blueprintId}`],
    ['Digital Twin', `${base}/twin`],
    ['Report', `${base}/report`],
  ];

  // Start from a clean slate: dark is the default.
  await p.goto(`${FRONTEND}/dashboard`, { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => localStorage.removeItem('monomelt-theme'));

  for (const [name, url] of pages) {
    section = name;
    console.log(`\n== ${name}`);
    await p.goto(`${FRONTEND}${url}`, { waitUntil: 'domcontentloaded' });
    await p.getByTestId('theme-toggle').first().waitFor({ timeout: 25000 }).catch(() => {});
    await p.waitForTimeout(1500);

    check('shows exactly one theme toggle', (await toggles(p)) === 1, `${await toggles(p)} toggles`);
    check('opens in dark by default', (await theme(p)) === 'dark', `data-theme=${await theme(p)}`);
    const darkBg = await pageBackground(p);
    check('dark background is unchanged (#0a0a0a)', darkBg === 'rgb(10, 10, 10)', darkBg);

    await p.getByTestId('theme-toggle').click();
    await p.waitForTimeout(700);
    check('toggle switches to light', (await theme(p)) === 'light', `data-theme=${await theme(p)}`);
    const lightBg = await pageBackground(p);
    check('light background is white', lightBg === 'rgb(255, 255, 255)', lightBg);
    const dark = await darkSurfaces(p);
    check('no large dark surfaces remain in light mode', dark.length === 0, dark.join(' | '));
    const bodyText = await p.evaluate(() => {
      const h = document.querySelector('h1, h2');
      return h ? getComputedStyle(h).color : 'none';
    });
    check('headings are dark text on the white page', bodyText === 'none' || luminance(parse(bodyText)) < 120, bodyText);

    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.getByTestId('theme-toggle').first().waitFor({ timeout: 25000 }).catch(() => {});
    check('the light choice survives a reload', (await theme(p)) === 'light', `data-theme=${await theme(p)}`);

    await p.getByTestId('theme-toggle').click();
    await p.waitForTimeout(500);
    check('toggle switches back to dark', (await theme(p)) === 'dark');
    await p.evaluate(() => localStorage.removeItem('monomelt-theme'));
  }

  // The choice made on an app page carries to the landing page and back.
  section = 'Navigation';
  console.log('\n== Navigation');
  await p.goto(`${FRONTEND}/dashboard`, { waitUntil: 'domcontentloaded' });
  await p.getByTestId('theme-toggle').first().waitFor({ timeout: 25000 });
  await p.getByTestId('theme-toggle').click();
  check('light is active on the dashboard', (await theme(p)) === 'light');
  await p.getByRole('link', { name: /^HOME$/ }).first().click();
  await p.waitForTimeout(1500);
  check('going Home keeps the light theme, with no toggle on the landing page', (await theme(p)) === 'light' && (await toggles(p)) === 0, `data-theme=${await theme(p)}, toggles=${await toggles(p)}`);
  await p.goBack();
  await p.waitForTimeout(1200);
  check('coming back to the dashboard keeps light', (await theme(p)) === 'light');

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(2); });
