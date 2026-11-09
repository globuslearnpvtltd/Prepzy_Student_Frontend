import { expect, signIn, test } from './fixtures';
import { mockStudentApi } from './student-mocks';
import { MOCKS } from '../visual/mocks';

test.describe('board (CBSE) learning', () => {
  test.beforeEach(async ({ page, context }) => {
    await signIn(context, 'cbse');
    await mockStudentApi(page, 'board');
  });

  test('dashboard shows plan, continue learning and subjects', async ({ page }) => {
    await page.goto('/cbse/dashboard');
    await expect(page.getByRole('region', { name: 'Your plan' })).toContainText('Topper');
    await expect(page.getByRole('heading', { name: 'Continue Learning' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Resume Mock Exam/ })).toBeVisible();
    const subjects = page.getByRole('region', { name: 'My Subjects' });
    await expect(subjects.getByRole('button', { name: /Physics/ })).toBeVisible();
    await expect(subjects.getByRole('button', { name: /Chemistry/ })).toBeVisible();
  });

  test('subject → book → chapter → lecture, then the chapter notes', async ({ page }) => {
    await page.goto('/cbse/learn');
    await expect(page.getByRole('heading', { name: 'Learn', level: 1 })).toBeVisible();
    await page.getByRole('region', { name: 'My Subjects' }).getByRole('button', { name: /Physics/ }).click();

    const books = page.getByRole('dialog', { name: 'Physics' });
    await books.getByRole('link', { name: /Physics Part 1/ }).click();
    await expect(page).toHaveURL(/\/cbse\/learn\/5(\/2)?$/);
    await expect(page.getByText('Electric Charges and Fields').first()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Learn' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('link', { name: /Video Lecture Introduction to Electric Charges/ }).click();
    await expect(page).toHaveURL(/\/cbse\/learn\/5\/2\/lecture\/8$/);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Introduction to Electric Charges');
    await page.getByRole('tab', { name: 'Transcript' }).click();
    await expect(page.getByText('Today we study electric charge.')).toBeVisible();

    await page.goBack();
    await page.getByRole('link', { name: /Chapter Notes/ }).click();
    await expect(page).toHaveURL(/\/cbse\/notes\/5\?module_id=2$/);
    await expect(page.getByRole('heading', { name: 'Electric Charges and Fields', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Coulomb’s law' })).toBeVisible();
  });
});

test.describe('competitive (NEET) learning', () => {
  test('subject → chapter → video lecture → study notes', async ({ page, context }) => {
    await signIn(context, 'neet');
    const progress = MOCKS['/api/v4/dashboard/neet/subject-progress'] as { data: { subject_name: string }[] };
    await mockStudentApi(page, 'competitive', {
      // Physics opens the course that has chapter data in the shared mocks.
      'GET /api/v4/dashboard/neet/subject-progress': {
        success: true,
        data: progress.data.map((row) => ({ ...row, course_ids: row.subject_name === 'NEET-Physics' ? [214] : [1] })),
      },
    });

    await page.goto('/neet/dashboard');
    await page.getByRole('link', { name: /^Physics \d+\/\d+ Chapters/ }).click();
    await expect(page).toHaveURL(/\/neet\/learn\/214$/);
    await expect(page.getByRole('heading', { name: 'Chapters', level: 1 })).toBeVisible();

    await page.getByRole('link', { name: /Laws of Motion/ }).click();
    await expect(page).toHaveURL(/\/neet\/learn\/214\/341\/video-lectures$/);
    await expect(page.getByRole('heading', { name: 'Laws of Motion — Part 1' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Part 2' })).toBeVisible();

    await page.getByRole('link', { name: 'Next step' }).click();
    await expect(page).toHaveURL(/\/neet\/learn\/214\/341\/study-notes$/);
    await expect(page.getByRole('heading', { name: 'Laws of Motion', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Newton’s First Law' })).toBeVisible();
  });
});
