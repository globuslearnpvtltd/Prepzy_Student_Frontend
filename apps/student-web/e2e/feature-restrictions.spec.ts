import { expect, signIn, test } from './fixtures';
import { plansFor } from '../visual/mocks';
import { mockStudentApi } from './student-mocks';

/**
 * Institute feature restrictions (features/feature-access): entry points of a restricted feature stay visible with a
 * padlock and explain why when clicked; opening a restricted page's URL shows "Not available".
 */

const restricted = (...keys: string[]) => ({ success: true, message: 'Feature access fetched', data: { restricted: keys } });

test.use({ viewport: { width: 1440, height: 900 } });

test('board: a restricted sidebar item is padlocked and opens the institute dialog', async ({ page, context }) => {
  await signIn(context, 'cbse');
  await mockStudentApi(page, 'board', {
    'GET /api/v4/feature-access/board/1': restricted('study_plan', 'notes', 'summary_videos'),
  });
  await page.goto('/cbse/dashboard');

  const sidebar = page.locator('aside').getByRole('navigation', { name: 'Main' });
  const studyPlan = sidebar.getByRole('button', { name: /Study Plan/ });
  await expect(studyPlan).toBeVisible();
  await expect(studyPlan).toHaveAttribute('aria-disabled', 'true');
  await expect(studyPlan.getByLabel('Not available')).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Notes' })).toHaveCount(0);

  // aria-disabled (it can't be opened), but a click still explains why.
  await studyPlan.click({ force: true });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText("This feature isn't enabled for your account. Please contact your admin to get access.");
  await expect(dialog.getByRole('link', { name: /See plans/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/cbse\/dashboard$/);
});

test('board: locks follow the class picked in the goal switcher (sent as class_id)', async ({ page, context }) => {
  await signIn(context, 'cbse');
  const board = plansFor('board');
  const class12 = board.data.plans[0]!;
  const class10 = { ...class12, plan_id: 4, class_id: 10, class_name: 'CLASS 10', stream_name: '' };
  const sent: (string | null)[] = [];
  await mockStudentApi(page, 'board', {
    'GET /api/v4/student/plans/active': { ...board, data: { plans: [class12, class10] } },
    // The institute restricted Class 12 only (e.g. its own plan); the student's Class 10 stays open.
    'GET /api/v4/feature-access/board/1': (_body: unknown, url: URL) => {
      sent.push(url.searchParams.get('class_id'));
      return restricted(...(url.searchParams.get('class_id') === '12' ? ['notes', 'summary_videos'] : []));
    },
  });
  await page.goto('/cbse/dashboard');

  const sidebar = page.locator('aside').getByRole('navigation', { name: 'Main' });
  await expect(sidebar.getByRole('button', { name: /^Notes/ })).toHaveAttribute('aria-disabled', 'true');
  await expect(sidebar.getByRole('link', { name: 'Notes' })).toHaveCount(0);
  expect(sent).toContain('12');

  await page.getByRole('button', { name: /^My goals: CBSE · Class 12/ }).click();
  await page.getByRole('menuitem', { name: /^CBSE Class 10,/ }).click();
  await expect(page.getByRole('button', { name: /^My goals: CBSE · Class 10/ })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Notes' })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: /^Notes/ })).toHaveCount(0);
  expect(sent).toContain('10');
});

test('a restricted page opened by URL says "Not available"', async ({ page, context }) => {
  await signIn(context, 'neet');
  await mockStudentApi(page, 'competitive', {
    'GET /api/v4/feature-access/competitive/2': restricted('mock_exam'),
  });
  await page.goto('/neet/mock-tests');
  await expect(page.getByRole('heading', { name: 'Not available' })).toBeVisible();
  await expect(page.getByText("This feature isn't enabled for your account. Please contact your admin to get access.")).toBeVisible();
  await page.getByRole('link', { name: 'Back to dashboard' }).click();
  await expect(page).toHaveURL(/\/neet\/dashboard$/);
});
