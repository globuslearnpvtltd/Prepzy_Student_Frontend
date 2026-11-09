import { expect, signIn, test } from './fixtures';
import { mockStudentApi } from './student-mocks';

const mcq = (id: number, text: string, options: string[]) => ({
  question_id: id,
  question_type: 'mcq',
  question_text: `<p>${text}</p>`,
  marks: 1,
  options: options.map((option_text, i) => ({ option_id: id * 10 + i + 1, option_text })),
  sub_questions: [],
});

test('board: a CBSE mock test from the list through submit to the result', async ({ page, context }) => {
  await signIn(context, 'cbse');
  let submitted: unknown;
  await mockStudentApi(page, 'board', {
    'GET /api/v1/exams/mock-exam/fetch-mock-questions': {
      success: true,
      time_left: 3600,
      questions: [
        mcq(1, 'Which of the following is the SI unit of electric charge?', ['Ampere', 'Coulomb']),
        mcq(2, 'The force between two charges is given by which law?', ["Ohm's law", "Coulomb's law"]),
      ],
    },
    'PUT /api/mock-exams/update-mock-session-questions': { success: true },
    'POST /api/v1/exams/mock-exam/submit-exam': (body) => {
      submitted = body;
      return { success: true, data: { attempt_id: 300 } };
    },
  });

  await page.goto('/cbse/tests');
  await page.getByRole('link', { name: /Mock tests/ }).click();
  await expect(page).toHaveURL(/\/cbse\/tests\/mock$/);
  await expect(page.getByRole('heading', { name: 'Mock tests', level: 1 })).toBeVisible();
  await page.getByRole('listitem').filter({ hasText: 'Paper 3' }).getByRole('link', { name: 'Start' }).click();

  await expect(page).toHaveURL(/\/cbse\/tests\/mock\/10$/);
  await expect(page.getByText('Which of the following is the SI unit of electric charge?')).toBeVisible();
  await page.getByRole('radio', { name: 'Coulomb' }).click();
  await page.getByRole('button', { name: 'Save & Next' }).click();
  await expect(page.getByText('The force between two charges is given by which law?')).toBeVisible();

  await page.getByRole('button', { name: 'Finish Quiz' }).click();
  const dialog = page.getByRole('dialog', { name: 'Submit your test?' });
  await expect(dialog).toContainText('1 of 2');
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click();

  await expect(page).toHaveURL(/\/cbse\/tests\/mock\/result\/300$/);
  await expect(page.getByRole('heading', { name: 'Your Score' })).toBeVisible();
  await expect(page.getByText('3/4')).toBeVisible();
  expect(submitted).toBeTruthy();
});

test('competitive: create a custom test from subject, chapter and topics', async ({ page, context }) => {
  await signIn(context, 'neet');
  let generated: unknown;
  await mockStudentApi(page, 'competitive', {
    'POST /api/neet/custom-exam/generate': (body) => {
      generated = body;
      return { success: true, set_id: 77 };
    },
    'POST /api/neet/custom-exam/start-custom-exam': {
      success: true,
      data: {
        name: 'Cell: The Unit of Life',
        session_expiry_time: new Date(Date.now() + 3600_000).toISOString(),
        questions: [
          {
            question_id: 1,
            question_text: '<p>Who proposed the cell theory?</p>',
            options: [
              { option_id: 11, text: 'Schleiden and Schwann' },
              { option_id: 12, text: 'Darwin' },
            ],
          },
        ],
      },
    },
  });

  await page.goto('/neet/custom-test/create');
  await expect(page.getByRole('heading', { name: 'Which subject do you want to practise?' })).toBeVisible();
  await page.getByRole('button', { name: /^Botany/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Cell: The Unit of Life/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Choose the topics' })).toBeVisible();
  await page.getByRole('button', { name: 'Cell theory' }).click();
  await page.getByRole('button', { name: 'hard' }).click();
  await expect(page.getByText('1 of 5 topics selected')).toBeVisible();
  await page.getByRole('button', { name: 'Create test' }).click();
  await expect(page).toHaveURL(/\/neet\/tests\/custom\/77$/);
  await expect(page.getByText('Who proposed the cell theory?')).toBeVisible();
  await expect(page.getByRole('timer')).toBeVisible();
  expect(generated).toEqual({ module_id: 14, lecture_ids: [1], difficulty_level: 'hard' });
});

const dppQuestions = [
  {
    question_id: 1,
    question_text: '<p>Powerhouse of the cell?</p>',
    options: [
      { option_id: 11, text: 'Ribosome' },
      { option_id: 12, text: 'Mitochondria' },
    ],
  },
];

test('competitive: daily practice — today\'s paper from the dashboard to the result, and the paper list', async ({
  page,
  context,
}) => {
  await signIn(context, 'neet');
  let submitted: { dpp_id?: unknown; questions?: { selected_option: unknown }[] } = {};
  await mockStudentApi(page, 'competitive', {
    'GET /api/neet/start-dpp-attempt': (_body, url) => {
      expect(url.searchParams.get('dpp_id')).toBe('9');
      return { success: true, attempt_id: 610, time_left: 1800, questions: dppQuestions };
    },
    'PUT /api/neet/update-dpp-session-questions': { success: true },
    'POST /api/neet/submit-dpp-attempt': (body) => {
      submitted = body as typeof submitted;
      return { success: true };
    },
    'GET /api/neet/get-dpp-result': {
      success: true,
      data: {
        summary: { name: 'Daily practice · 14 Nov', total_marks: 4, total_marks_obtained: 4 },
        questions: [{ ...dppQuestions[0], selected_option_id: 12, correct_option_id: 12, is_correct: 1 }],
      },
    },
  });

  await page.goto('/neet/dashboard');
  await page.getByRole('region', { name: "Today's DPP" }).getByRole('link', { name: 'Start Now' }).click();
  await expect(page).toHaveURL(/\/neet\/tests\/dpp\/9$/);
  await page.getByRole('radio', { name: /Mitochondria/ }).click();
  await page.getByRole('button', { name: /Submit test/i }).click();
  await page.getByRole('dialog', { name: 'Submit your test?' }).getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page).toHaveURL(/\/neet\/tests\/dpp\/result\/610$/);
  await expect(page.getByLabel('Score 4 out of 4')).toBeVisible();
  expect(submitted.dpp_id).toBe('9');
  expect(submitted.questions?.[0]?.selected_option).toBe(12);

  await page.goto('/neet/daily-practice');
  await expect(page.getByRole('heading', { name: 'Daily Practice', level: 1 })).toBeVisible();
  const today = page.getByRole('region', { name: "Today's DPP" });
  await expect(today).toContainText('15 questions');
  await expect(today.getByRole('link', { name: 'Start Now' })).toHaveAttribute('href', '/neet/tests/dpp/9');
  const papers = page.getByRole('region', { name: 'All practice papers' });
  await expect(papers.getByRole('listitem').filter({ hasText: '12 Nov' }).getByRole('link', { name: 'Result' })).toBeVisible();
});
