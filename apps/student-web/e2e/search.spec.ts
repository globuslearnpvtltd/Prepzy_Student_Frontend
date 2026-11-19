import type { Page } from '@playwright/test';
import { expect, signIn, test } from './fixtures';
import { mockStudentApi } from './student-mocks';

/**
 * The header search: suggestions while typing (with their type), and the search button's results panel with links
 * to the lecture, notes, practice and quizzes. Board (CBSE) and competitive (NEET), with the shared visual mocks.
 */

const boardSuggestions = {
  success: true,
  data: {
    suggestions: [
      { result_id: 4, result_name: 'COULOMB LAW', result_type: 'topic', subject_name: 'PHYSICS', class_name: 'CLASS 12', course_id: 7, module_id: 8, module_name: null, anchor_id: null },
      { result_id: 5, result_name: 'COULOMB FORCE BETWEEN CHARGES', result_type: 'topic', subject_name: 'PHYSICS', class_name: 'CLASS 12', course_id: 7, module_id: 8, module_name: null, anchor_id: null },
    ],
  },
};

const competitiveSuggestions = {
  success: true,
  data: {
    suggestions: [
      { result_id: 1, result_name: 'Cell cycle', result_type: 'topic', subject_name: 'NEET-BOTANY', class_name: 'NEET', course_id: 214, module_id: 341, module_name: 'Cell Cycle and Cell Division', anchor_id: 'cell-cycle' },
      { result_id: 341, result_name: 'Cell Cycle and Cell Division', result_type: 'module', subject_name: 'NEET-BOTANY', class_name: 'NEET', course_id: 214, module_id: 341, module_name: null, anchor_id: null },
      { result_id: 214, result_name: 'Cell Biology', result_type: 'course', subject_name: 'NEET-BOTANY', class_name: 'NEET', course_id: 214, module_id: null, module_name: null, anchor_id: null },
    ],
  },
};

const lecture = (courseId: number, moduleId: number) => ({
  success: true,
  data: {
    result: {
      lecture_id: 41,
      lecture_name: "COULOMB'S LAW AND ELECTRIC FORCE",
      course_id: courseId,
      module_id: moduleId,
      module_name: 'Electric Charges and Fields',
      subject_name: 'PHYSICS',
      score: 0.87,
      assessments: [
        { assessment_id: 90, title: 'ELECTRIC CHARGES QUIZ', assessment_type: 'quiz' },
        { assessment_id: 91, title: 'Charges unit test', assessment_type: 'unit_test' },
      ],
    },
  },
});

/** The visible search box (desktop header, or the phone's search panel after tapping the magnifier). */
async function searchBox(page: Page) {
  const opener = page.getByRole('button', { name: 'Open search' });
  const box = page.getByRole('combobox', { name: 'Search topics' }).locator('visible=true');
  // Phones: the box is behind the magnifier (a tap before hydration does nothing, so tap until it opens).
  await expect(async () => {
    if ((await opener.isVisible()) && !(await box.isVisible())) await opener.click();
    await expect(box).toBeVisible({ timeout: 1000 });
  }).toPass();
  return box;
}

test('board: a topic suggestion runs the lecture search; the panel links the video and the quizzes', async ({ page, context }) => {
  await signIn(context, 'cbse');
  const searches: unknown[] = [];
  await mockStudentApi(page, 'board', {
    'GET /api/v4/search/board/1/suggestions': boardSuggestions,
    'POST /api/v4/search/board/1/lectures': (body) => {
      searches.push(body);
      return lecture(7, 8);
    },
  });
  await page.goto('/cbse/dashboard');
  const box = await searchBox(page);
  await box.fill('coul');

  const option = page.getByRole('option', { name: /coulomb law/i });
  await expect(option).toContainText('Topic');
  await expect(option).toContainText('Physics');
  await option.click();

  const panel = page.getByRole('region', { name: 'Search results' });
  await expect(panel.getByText('Recommended video')).toBeVisible();
  // The panel drops below the box, over the page (it must not push or cover the header).
  const boxRect = (await box.boundingBox())!;
  expect((await panel.boundingBox())!.y).toBeGreaterThanOrEqual(boxRect.y + boxRect.height);
  expect((await box.boundingBox())!.y).toBe(boxRect.y);
  expect(searches).toEqual([{ query: 'COULOMB LAW', subject_name: 'PHYSICS', class_id: 12 }]);
  await expect(panel.getByRole('link', { name: /coulomb's law and electric force/i })).toHaveAttribute('href', '/cbse/learn/7/8/lecture/41');
  await expect(panel.getByText('Practice & assess')).toBeVisible();
  await expect(panel.getByRole('link', { name: /electric charges quiz/i })).toHaveAttribute('href', '/cbse/tests/quiz/90');
  await expect(panel.getByRole('link', { name: /charges unit test/i })).toContainText('unit test');
});

test('competitive: suggestions open their page; the search button shows the chapter steps', async ({ page, context }) => {
  await signIn(context, 'neet');
  await mockStudentApi(page, 'competitive', {
    'GET /api/v4/search/competitive/2/suggestions': competitiveSuggestions,
    'POST /api/v4/search/competitive/2/lectures': lecture(214, 341),
  });
  await page.goto('/neet/dashboard');
  const box = await searchBox(page);
  await box.fill('cell');
  await expect(page.getByRole('option')).toHaveCount(3);
  await expect(page.getByRole('option').nth(1)).toContainText('Chapter');
  await expect(page.getByRole('option').nth(2)).toContainText('Course');

  await box.press('Enter');
  const panel = page.getByRole('region', { name: 'Search results' });
  await expect(panel.getByRole('link', { name: /video lesson/i })).toHaveAttribute('href', '/neet/learn/214/341/video-lectures');
  await expect(panel.getByRole('link', { name: /study notes/i })).toHaveAttribute('href', '/neet/learn/214/341/study-notes');
  await expect(panel.getByRole('link', { name: /practice questions/i })).toHaveAttribute('href', '/neet/learn/214/341/practice-questions');

  await box.fill('cel');
  await page.getByRole('option', { name: /^cell cycle and cell division/i }).click();
  await expect(page).toHaveURL(/\/neet\/learn\/214\/341\/video-lectures$/);
});
