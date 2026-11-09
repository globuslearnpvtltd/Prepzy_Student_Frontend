import { test as base, type BrowserContext, type Page } from '@playwright/test';

export const API = 'http://api.e2e.test';

type Handler = (body: unknown, url: URL) => unknown;

/** Answers the app's API calls from a table of `METHOD /path` → JSON. Unknown calls fail the test. */
/** Active exams (GET /api/v4/exams), loaded by every exam page. */
export const EXAM_CATALOG = [
  { exam_id: 1, exam_name: 'CBSE', exam_slice: 'cbse', category: 'board' },
  { exam_id: 2, exam_name: 'NEET-UG', exam_slice: 'neet-ug', category: 'competitive' },
];

export async function mockApi(page: Page, routeHandlers: Record<string, Handler | object>) {
  const handlers: Record<string, Handler | object> = {
    'GET /api/v4/exams': { success: true, message: 'Exams fetched', data: EXAM_CATALOG },
    ...routeHandlers,
  };
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders(request.headers().origin) });
    }
    const handler = handlers[key];
    if (!handler) {
      console.error(`Unmocked API call: ${key}`);
      return route.fulfill({
        status: 501,
        json: { message: `Unmocked ${key}` },
        headers: corsHeaders(request.headers().origin),
      });
    }
    const body = request.postData() ? JSON.parse(request.postData()!) : undefined;
    const json = typeof handler === 'function' ? (handler as Handler)(body, url) : handler;
    return route.fulfill({ status: 200, json, headers: corsHeaders(request.headers().origin) });
  });
}

function corsHeaders(origin = '*') {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    // Same as the real backend (src/index.js corsOptions), so e2e fails if the app sends other headers.
    'access-control-allow-headers': 'Content-Type,Authorization',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE',
  };
}

/** Pretends the backend issued a session (the real cookie is set by the API domain). */
export async function signIn(context: BrowserContext, exam = 'neet') {
  const url = test.info().project.use.baseURL!;
  await context.addCookies([
    { name: 'accessToken', value: 'e2e', url },
    { name: 'prepzy_exam', value: exam, url },
  ]);
}

/** Endpoints every signed-in NEET page needs. */
export const neetAccount = {
  'GET /api/v4/student/account': {
    success: true,
    data: { account_id: 1, first_name: 'Ravi', last_name: 'Kumar', phone: '+919876543210' },
  },
  'GET /api/v4/student/exams/purchased': {
    success: true,
    data: { exams: [{ exam_id: 2, exam_slice: 'neet-ug', exam_name: 'NEET-UG' }] },
  },
  'GET /api/v4/student/plans/active': {
    success: true,
    data: {
      plans: [
        {
          plan_id: 3,
          class_id: 20,
          class_name: 'NEET',
          duration_months: 12,
          expiry_date: '2027-05-01',
          status: 'active',
        },
      ],
    },
  },
};

export const test = base;
export { expect } from '@playwright/test';
