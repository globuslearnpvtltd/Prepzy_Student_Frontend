import { expect, test } from '@playwright/test';
import { routes } from '../../src/shared/config/routes';
import { expectPageOpens, mainPages } from './checks';
import { stagingApiUrl, stagingExam } from './target';


const API = stagingApiUrl();
const exam = stagingExam();

test.describe('staging: signed out', { tag: '@staging' }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a signed-out visitor is sent to login', async ({ page }) => {
    const dashboard = routes.dashboard(exam.slug);
    await page.goto(dashboard);
    await expect(page).toHaveURL((url) => url.pathname === routes.login() && url.searchParams.get('next') === dashboard);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('the server refuses a call without a login', async ({ playwright }) => {
    const anonymous = await playwright.request.newContext();
    try {
      const response = await anonymous.get(`${API}/api/v4/student/account`);
      expect(response.status(), 'GET /api/v4/student/account without a login').toBe(401);
    } finally {
      await anonymous.dispose();
    }
  });
});

test.describe('staging: signed-in student', { tag: '@staging' }, () => {
  test('the saved login is accepted and the student has this exam', async ({ request }) => {
    const account = await request.get(`${API}/api/v4/student/account`);
    expect(account.status(), 'GET /api/v4/student/account with the saved login').toBe(200);

    const purchased = await request.get(`${API}/api/v4/student/exams/purchased`);
    expect(purchased.status(), 'GET /api/v4/student/exams/purchased').toBe(200);
    const body = (await purchased.json()) as { data?: { exams?: { exam_slice: string }[] } };
    const slices = (body.data?.exams ?? []).map((row) => row.exam_slice);
    expect(slices, `the test student's exams (E2E_EXAM is ${exam.slug})`).toContain(exam.examSlice);
  });

  for (const { name, path } of mainPages(exam)) {
    test(`${name} opens for the test student`, async ({ page }) => {
      await expectPageOpens(page, path, API);
    });
  }
});
