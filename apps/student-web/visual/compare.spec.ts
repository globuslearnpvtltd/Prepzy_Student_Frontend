import { test, type Page } from '@playwright/test';
import { MOCKS, plansFor, student } from './mocks';
import { voiceStub } from './voice-stub';

/**
 * Screenshots the same page in the OLD app and the NEW app with identical backend data, so a port can be
 * checked side by side. Usage (from apps/student-web):
 *
 *   PAIRS="cbse-dashboard|/cbse/dashboard|/cbse/dashboard|board" OUT=/tmp/shots \
 *     npx playwright test -c visual/playwright.config.ts
 *
 * PAIRS: `name|oldPath|newPath|board|competitive|none[|click text]` entries separated by `;` (use `-` to skip a side).
 * `parents` | `schools` | `partners` sign in to that portal (old side on <portal>.localhost:3002).
 * `board-noplan` signs in as a CBSE student without an active plan. An optional 5th field clicks the first
 * element with that exact text (e.g. a button that opens a modal) before the screenshot.
 * Needs the old app on OLD_URL (default http://localhost:3002) and the new app on NEW_URL
 * (default http://localhost:3200), both pointed at API_URL (default http://localhost:3005) — requests to
 * it are answered from visual/mocks.ts, so no real backend or login is needed.
 */
const API = process.env.API_URL ?? 'http://localhost:3005';
const OUT = process.env.OUT ?? 'visual-output';
const pairs = (process.env.PAIRS ?? '')
  .split(';')
  .filter(Boolean)
  .map((entry) => {
    const [name, oldPath, newPath, exam = 'none', click] = entry.split('|');
    return { name: name!, oldPath: oldPath!, newPath: newPath!, exam: exam as Exam, click };
  });

type Exam = 'board' | 'board-noplan' | 'competitive' | 'none' | 'parents' | 'schools' | 'partners';

/** Portal session cookies; the OLD app only serves portals on their subdomain, e.g. parents.localhost:3002. */
const PORTAL_COOKIE: Partial<Record<Exam, string>> = {
  parents: 'mentorAccessToken',
  schools: 'teacherAccessToken',
  partners: 'partnerAccessToken',
};

async function prepare(page: Page, base: string, exam: Exam, extra: Record<string, unknown>) {
  const portalCookie = PORTAL_COOKIE[exam];
  if (portalCookie) {
    await page.context().addCookies([{ name: portalCookie, value: 'visual', url: base }]);
  } else if (exam !== 'none') {
    await page.context().addCookies([
      { name: 'accessToken', value: 'visual', url: base },
      { name: 'userSessionToken', value: 'visual', url: base },
      { name: 'prepzy_exam', value: exam === 'competitive' ? 'neet' : 'cbse', url: base },
    ]);
    await page.addInitScript((u) => localStorage.setItem('globuslearn-user', JSON.stringify(u)), student);
  }
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const origin = request.headers().origin ?? base;
    const headers = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'Content-Type,Authorization',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;
    let body = extra[path] ?? MOCKS[path];
    if (path === '/api/v1/student/plans/active' || path === '/api/v4/student/plans/active')
      body = exam === 'board-noplan' ? { success: true, data: { plans: [] } } : plansFor(exam === 'competitive' ? 'competitive' : 'board');
    return route.fulfill({ status: 200, json: body ?? { success: true, data: [] }, headers });
  });
}

for (const pair of pairs) {
  for (const side of ['old', 'new'] as const) {
    const path = side === 'old' ? pair.oldPath : pair.newPath;
    if (path === '-') continue;
    test(`${pair.name} (${side})`, async ({ page }, info) => {
      const portal = PORTAL_COOKIE[pair.exam] ? pair.exam : null;
      const oldBase = process.env.OLD_URL ?? (portal ? `http://${portal}.localhost:3002` : 'http://localhost:3002');
      const base = side === 'old' ? oldBase : (process.env.NEW_URL ?? 'http://localhost:3200');
      await prepare(page, base, pair.exam, {});
      // VOICE_STUB=connecting|listening|answering fakes the mic + WebRTC for live talk screens (visual/voice-stub.ts).
      if (process.env.VOICE_STUB) await page.addInitScript(voiceStub, process.env.VOICE_STUB);
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 120_000 }).catch(() => undefined);
      await page.waitForTimeout(2000);
      // Several clicks in a row: "first>>second".
      for (const text of pair.click?.split('>>') ?? []) {
        await page.getByText(text, { exact: true }).first().click({ timeout: 15_000 }).catch(() => undefined);
        await page.waitForTimeout(1500);
      }
      await page.screenshot({ path: `${OUT}/${pair.name}-${side}-${info.project.name}.png`, fullPage: true });
    });
  }
}
