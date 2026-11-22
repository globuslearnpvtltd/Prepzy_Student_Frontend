import { expect, signIn, test } from './fixtures';
import { mockStudentApi } from './student-mocks';

/**
 * Institute feature restrictions (features/feature-access): entry points of a restricted feature stay visible with a
 * padlock and explain why when clicked; opening a restricted page's URL shows "Not enabled by your institute".
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
  await expect(studyPlan.getByLabel('Not enabled by your institute')).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Notes' })).toHaveCount(0);

  // aria-disabled (it can't be opened), but a click still explains why.
  await studyPlan.click({ force: true });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText("This feature isn't enabled for your account by your institute. Please contact your institute.");
  await expect(dialog.getByRole('link', { name: /See plans/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/cbse\/dashboard$/);
});

test('a restricted page opened by URL says "Not enabled by your institute"', async ({ page, context }) => {
  await signIn(context, 'neet');
  await mockStudentApi(page, 'competitive', {
    'GET /api/v4/feature-access/competitive/2': restricted('mock_exam'),
  });
  await page.goto('/neet/mock-tests');
  await expect(page.getByRole('heading', { name: 'Not enabled by your institute' })).toBeVisible();
  await expect(page.getByText('Contact your institute to use this feature.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to dashboard' }).click();
  await expect(page).toHaveURL(/\/neet\/dashboard$/);
});
