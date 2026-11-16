import { expect, test, type Page } from '@playwright/test';
import type { ExamDesign } from '../../src/shared/config/exams';
import { routes } from '../../src/shared/config/routes';

// Sidebar pages per exam category, plus the account pages.
export function mainPages(exam: ExamDesign): { name: string; path: string }[] {
  const account = [
    { name: 'My Account', path: routes.profile(exam.slug) },
    { name: 'Manage plans', path: routes.managePlans() },
  ];
  const pages: Record<ExamDesign['category'], { name: string; path: string }[]> = {
    competitive: [
      { name: 'Dashboard', path: routes.dashboard(exam.slug) },
      { name: 'Notes', path: routes.notes(exam.slug) },
      { name: 'Mock Tests', path: routes.mockTests(exam.slug) },
      { name: 'PYQ Library', path: routes.pyqLibrary(exam.slug) },
      { name: 'Daily Practice', path: routes.dailyPractice(exam.slug) },
      { name: 'Refer & Earn', path: routes.referAndEarn(exam.slug) },
      { name: 'Custom Exam', path: routes.customTest(exam.slug) },
      ...account,
    ],
    // no Study Plan: it is locked until the student builds one
    board: [
      { name: 'Dashboard', path: routes.dashboard(exam.slug) },
      { name: 'Learn', path: routes.learn(exam.slug) },
      { name: 'Assessments', path: routes.assessments(exam.slug) },
      { name: 'Notes', path: routes.notes(exam.slug) },
      { name: 'Refer & Earn', path: routes.referAndEarn(exam.slug) },
      ...account,
    ],
    reference: [],
  };
  return pages[exam.category];
}

const ERROR_SCREEN =
  /couldn't load|isn't available|isn't on your account|no active plan|something went wrong|page not found|^not found$/i;

// The page opened: still signed in, no error screen, no API call answering 5xx or 401.
export async function expectPageOpens(page: Page, path: string, apiUrl: string) {
  const failedCalls: string[] = [];
  page.on('response', (response) => {
    if (!response.url().startsWith(`${apiUrl}/`)) return;
    if (response.status() >= 500 || response.status() === 401) {
      failedCalls.push(`${response.request().method()} ${new URL(response.url()).pathname} → ${response.status()}`);
    }
  });
  page.on('pageerror', (error) => {
    test.info().annotations.push({ type: 'Finding', description: `Script error on ${path}: ${error.message}` });
  });

  const response = await page.goto(path);
  expect(response?.status(), `${path} answered`).toBeLessThan(400);
  // some pages poll, so don't wait forever
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);

  await expect(page, 'the student stays signed in').not.toHaveURL(/\/login(\?|$)/);
  await expect(page.getByRole('banner'), 'the page header').toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: ERROR_SCREEN }), 'an error screen').toHaveCount(0);
  expect([...new Set(failedCalls)], 'server calls that failed').toEqual([]);
}
