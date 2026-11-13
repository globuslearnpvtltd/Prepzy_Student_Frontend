import type { Page } from '@playwright/test';
import { expect, signIn, test } from './fixtures';
import { mockStudentApi } from './student-mocks';
import { MOCKS } from '../visual/mocks';

/** The common checkout: one page for every exam (/purchase), the exam named by ?exam=. */

const examCard = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name} ?Prepare`) });
const searchOf = (page: Page) => new URL(page.url()).searchParams;

test('board exam: /purchase?exam=cbse sells CBSE, and switching exam replaces ?exam= in the URL', async ({ page, context }) => {
  await signIn(context, 'cbse');
  await mockStudentApi(page, 'board');
  await page.goto('/purchase?exam=cbse');
  await expect(page.getByRole('heading', { name: 'What are you preparing for?' })).toBeVisible();
  await expect(examCard(page, 'CBSE')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Choose your class')).toBeVisible();

  await examCard(page, 'NEET-UG').click();
  await expect(page).toHaveURL(/\/purchase\?exam=neet$/);
  await expect(page.getByText('Target year')).toBeVisible();
  await expect(examCard(page, 'NEET-UG')).toHaveAttribute('aria-pressed', 'true');
  // replace, not push: going back leaves the checkout instead of returning to CBSE.
  await page.goBack();
  await expect(page).not.toHaveURL(/\/purchase\?exam=cbse/);
});

test('competitive exam: /purchase?exam=neet sells NEET by target year', async ({ page, context }) => {
  await signIn(context, 'cbse');
  await mockStudentApi(page, 'competitive');
  await page.goto('/purchase?exam=neet');
  await expect(page.getByText('Target year')).toBeVisible();
  await expect(examCard(page, 'NEET-UG')).toHaveAttribute('aria-pressed', 'true');
});

test('without ?exam= the page opens the remembered exam', async ({ page, context }) => {
  await signIn(context, 'neet');
  await mockStudentApi(page, 'competitive');
  await page.goto('/purchase');
  await expect(page.getByText('Target year')).toBeVisible();
  await expect(examCard(page, 'NEET-UG')).toHaveAttribute('aria-pressed', 'true');
});

test('an exam the app has no pages for (DB rows only) is sold on the same page', async ({ page, context }) => {
  await signIn(context, 'cbse');
  const exams = MOCKS['/api/v4/exams'] as { data: object[] };
  const catalog = MOCKS['/api/v4/billing/board/1/catalog'] as { data: { variants: object[] } };
  await mockStudentApi(page, 'board', {
    'GET /api/v4/exams': { ...exams, data: [...exams.data, { exam_id: 7, exam_name: 'ICSE', exam_slice: 'icse', category: 'board' }] },
    'GET /api/v4/billing/board/7/catalog': {
      success: true,
      data: { exam: { exam_id: 7, exam_key: 'icse', title: 'ICSE', category: 'board', exam_date: null }, variants: catalog.data.variants },
    },
    'GET /api/v4/billing/board/7/feature-limits': { success: true, data: { features: [] } },
    'GET /api/v4/billing/board/7/coupons': { success: true, data: { coupons: [] } },
  });
  await page.goto('/purchase?exam=icse');
  await expect(examCard(page, 'ICSE')).toHaveAttribute('aria-pressed', 'true');
  await expect(examCard(page, 'CBSE')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Choose your class')).toBeVisible();
});

test('the old exam-scoped checkout URL redirects to /purchase with its exam and query', async ({ page, context }) => {
  await signIn(context, 'cbse');
  await mockStudentApi(page, 'board');
  await page.goto('/neet/plans/purchase?CLASSID=20');
  await expect(page).toHaveURL(/\/purchase\?/);
  expect(new URL(page.url()).pathname).toBe('/purchase');
  expect(searchOf(page).get('exam')).toBe('neet');
  expect(searchOf(page).get('CLASSID')).toBe('20');
  await expect(page.getByText('Target year')).toBeVisible();

  await page.goto('/cbse/plans/purchase');
  await expect(page).toHaveURL(/\/purchase\?exam=cbse$/);
  await expect(examCard(page, 'CBSE')).toHaveAttribute('aria-pressed', 'true');
});
