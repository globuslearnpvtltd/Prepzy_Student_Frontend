import { expect, signIn, test } from './fixtures';
import { mockStudentApi } from './student-mocks';
import { MOCKS } from '../visual/mocks';

test.beforeEach(async ({ context }) => {
  await signIn(context, 'cbse');
});

test('diagnostic: pick chapters, review the blueprint, take the test and see the report', async ({ page }) => {
  const calls: Record<string, unknown> = {};
  const fetched = MOCKS['/api/v1/diagnostic/fetch-questions/31'] as { data: { questions: object[] } };
  await mockStudentApi(page, 'board', {
    'POST /api/v1/diagnostic/blueprint-preview': (body) => {
      calls.blueprint = body;
      return { success: true, data: { is_valid: true, subject_count: 2, chapter_count: 5, total_questions: 2, duration_minutes: 25 } };
    },
    'POST /api/v1/diagnostic/start-test': (body) => {
      calls.start = body;
      return { success: true, data: { assessment_id: 31 } };
    },
    'GET /api/v1/diagnostic/fetch-questions/31': {
      success: true,
      data: {
        time_left: 1500,
        questions: fetched.data.questions
          .slice(0, 2)
          .map((q) => ({ ...q, selected_answer: null, status: 'not_visited' })),
      },
    },
    'PUT /api/v1/diagnostic/update-questions/31': { success: true },
    'POST /api/v1/diagnostic/submit': (body) => {
      calls.submit = body;
      return { success: true };
    },
  });

  await page.goto('/cbse/diagnostic');
  await expect(page.getByRole('heading', { name: 'Which chapters have you studied?' })).toBeVisible();
  for (const chapter of ['Electric charges and fields', 'Electrostatic potential', 'Current electricity', 'Moving charges and magnetism'])
    await page.getByRole('button', { name: new RegExp(`^${chapter}`) }).click();
  await page.getByRole('button', { name: /^Chemistry/ }).click();
  await page.getByRole('button', { name: /^Solutions/i }).click();
  await expect(page.getByText('5 chapters selected')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  const blueprint = page.getByRole('complementary').filter({ has: page.getByRole('button', { name: 'Start Test' }) });
  await expect(blueprint).toContainText('25 Mins');
  await expect(blueprint).toContainText(/5\s*Chapters/);
  await blueprint.getByRole('button', { name: 'Start Test' }).click();

  await expect(page).toHaveURL(/\/cbse\/diagnostic-test\/31$/);
  await expect(page.getByText('(Q1)')).toBeVisible();
  await page.getByRole('radio', { name: /It is quantised/ }).click();
  await page.getByRole('button', { name: 'Save & Next' }).click();
  await expect(page.getByText('(Q2)')).toBeVisible();
  await page.getByRole('button', { name: 'Submit Test' }).first().click();
  await expect(page).toHaveURL(/\/cbse\/diagnostic-result\?assessment_id=31$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Here is what I found', level: 1 })).toBeVisible();
  await expect(page.getByText('Physics is clearly your strength', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Build My Study Plan' })).toBeVisible();
  expect(calls.start).toEqual({ class_id: 12, module_ids: [4, 5, 6, 7, 20] });
  expect(calls.submit).toMatchObject({ assessment_id: 31 });
});

/** yyyy-mm-dd in local time, `offset` days from today (as visual/mocks-account.ts builds the plan). */
const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('study plan: month view, pick a day and work through its tasks', async ({ page }) => {
  let patched: unknown;
  const day = MOCKS[`/api/v1/study-plan/day/41/${isoDay(0)}`] as { data: { tasks: { task_id: number }[] } };
  await mockStudentApi(page, 'board', {
    // Today is a rest day in the shared plan; tomorrow gets today's sample tasks (task 3 done once patched).
    [`GET /api/v1/study-plan/day/41/${isoDay(1)}`]: () => ({
      success: true,
      data: {
        tasks: day.data.tasks.map((t) =>
          t.task_id === 3 && patched ? { ...t, status: 'completed', is_completed: true, is_started: true } : t,
        ),
      },
    }),
    'PATCH /api/v1/study-plan/task/3': (body) => {
      patched = body;
      return { success: true };
    },
  });
  await page.goto('/cbse/study-plan');
  await expect(page.getByRole('heading', { name: 'Your Study Plan at a Glance', level: 1 })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Plan progress' })).toBeVisible();
  await page.getByRole('button', { name: isoDay(1), exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Electric charges and fields not done/ })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Chemistry Notes · Solutions' })).toBeVisible();

  const doubts = page.getByRole('checkbox', { name: 'Mark Solve Doubts with Socrates done' });
  await doubts.click();
  await expect.poll(() => patched).toBeTruthy();
  await expect(page.getByRole('checkbox', { name: 'Mark Solve Doubts with Socrates not done' })).toBeChecked();
});

test('notes: board notes library opens a chapter\'s notes', async ({ page }) => {
  await mockStudentApi(page, 'board');
  await page.goto('/cbse/notes');
  await expect(page.getByRole('heading', { name: 'Notes', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'View Notes: Physics Part 1' }).click();
  await expect(page).toHaveURL(/\/cbse\/notes\/5/);
  await expect(page.getByRole('heading', { name: 'Electric Charges and Fields', level: 1 })).toBeVisible();
  // Next chapter from the Previous / Next bar (fixed at the bottom on phones, under the notes on desktop).
  await page.getByRole('navigation', { name: 'Chapter navigation' }).getByRole('button', { name: /Next/ }).click();
  await expect(page.getByRole('heading', { name: 'Electrostatic Potential', level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/cbse\/notes\/5\?module_id=3$/);
});

test('notes: NEET notes library opens a chapter in the study-notes step', async ({ page, context }) => {
  await signIn(context, 'neet');
  await mockStudentApi(page, 'competitive');
  await page.goto('/neet/notes');
  await expect(page.getByRole('heading', { name: 'NEET UG Notes Library', level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Physics' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('img', { name: 'Locked' })).toBeVisible();
  await page.getByRole('link', { name: /03 Laws of Motion/ }).click();
  await expect(page).toHaveURL(/\/neet\/learn\/214\/341\/study-notes\?from=notes$/);
  await expect(page.getByRole('heading', { name: 'Newton’s First Law' })).toBeVisible();
});
