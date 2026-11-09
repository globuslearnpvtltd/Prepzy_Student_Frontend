import { expect, mockApi, neetAccount, signIn, test } from './fixtures';

test('signed-out students are sent to login and come back after', async ({ page }) => {
  await page.goto('/neet/tests');
  await expect(page).toHaveURL(/\/login\?next=%2Fneet%2Ftests$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('unknown exams and pages show a 404', async ({ page, context }) => {
  await signIn(context);
  await mockApi(page, neetAccount);
  const response = await page.goto('/jee/dashboard');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('login with OTP opens the NEET dashboard', async ({ page, context }) => {
  await mockApi(page, {
    ...neetAccount,
    'POST /api/v4/auth/login-otp': { success: true, message: 'OTP sent to your WhatsApp number', data: null },
    'POST /api/v4/auth/verify-login-otp': (body) => {
      expect(body).toMatchObject({ phone: '+919876543210', otp: '123456' });
      return {
        success: true,
        message: 'Logged in successfully',
        data: { account_id: 1, first_name: 'Ravi', target_exam: 'NEET-UG' },
      };
    },
    'GET /api/v4/dashboard/neet/subject-progress': {
      success: true,
      data: [{ subject_name: 'NEET-Botany', completed_chapters: 3, total_chapters: 10, progress_percentage: 30 }],
    },
    'GET /api/neet/get-live-dpp-neet': { success: true, data: { dpp: null } },
    'GET /api/v4/dashboard/neet/weekly-activity': { success: true, data: { Mon: 1 } },
    'GET /api/v4/dashboard/board/classes/20/subject-scores': { success: true, data: { overall_percent: 50, result_data: [] } },
  });

  await page.goto('/login');
  await page.getByLabel('Mobile number').fill('98765 43210');
  await page.getByRole('button', { name: 'Send OTP' }).click();
  await expect(page).toHaveURL(/\/verify-otp\?flow=login/);

  // The real backend sets the session cookie on its own domain at this step.
  await signIn(context);
  await page.getByLabel('One-time code').fill('123456');
  await page.getByRole('button', { name: 'Verify' }).click();

  await expect(page).toHaveURL(/\/neet\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Ravi/ })).toBeVisible();
  await expect(page.getByText('Botany')).toBeVisible();
});

test('take a NEET mock test from the list to the result', async ({ page, context }) => {
  await signIn(context);
  let submitted: { questions?: { selected_option: unknown; status: string }[] } = {};
  await mockApi(page, {
    ...neetAccount,
    'GET /api/neet/mock-exam/fetch-mock-exams': {
      success: true,
      data: {
        mockExams: [
          {
            set_id: 4,
            name: 'NEET Full Mock 1',
            duration: 180,
            question_count: 2,
            attempt_count: 0,
            status: 'not_started',
          },
        ],
      },
    },
    'POST /api/neet/mock-exam/start-mock-exam': {
      success: true,
      data: {
        set_id: 4,
        session_expiry_time: new Date(Date.now() + 3 * 3600_000).toISOString(),
        questions: [
          {
            question_id: 1,
            question_text: '<p>Powerhouse of the cell?</p>',
            options: [
              { option_id: 11, text: 'Ribosome' },
              { option_id: 12, text: 'Mitochondria' },
            ],
          },
          {
            question_id: 2,
            question_text: '<p>SI unit of force?</p>',
            options: [
              { option_id: 21, text: 'Newton' },
              { option_id: 22, text: 'Pascal' },
            ],
          },
        ],
      },
    },
    'PUT /api/neet/mock-exam/update-mock-session-questions': { success: true },
    'POST /api/neet/mock-exam/submit-mock-exam': (body) => {
      submitted = body as typeof submitted;
      return { success: true, data: { attempt_id: 501 } };
    },
    'GET /api/neet/mock-exam/get-mock-result': {
      success: true,
      data: {
        summary: { name: 'NEET Full Mock 1', total_marks: 8, total_marks_obtained: 4 },
        questions: [
          {
            question_id: 1,
            question_text: 'Powerhouse of the cell?',
            options: [
              { option_id: 11, text: 'Ribosome' },
              { option_id: 12, text: 'Mitochondria' },
            ],
            selected_option_id: 12,
            correct_option_id: 12,
            is_correct: 1,
          },
          {
            question_id: 2,
            question_text: 'SI unit of force?',
            options: [
              { option_id: 21, text: 'Newton' },
              { option_id: 22, text: 'Pascal' },
            ],
            selected_option_id: null,
            correct_option_id: 21,
            is_correct: 0,
          },
        ],
      },
    },
  });

  await page.goto('/neet/tests/mock');
  await expect(page.getByRole('heading', { name: 'NEET Full Mock 1' })).toBeVisible();
  await page.getByRole('link', { name: 'Start' }).click();

  await expect(page.getByText('Powerhouse of the cell?')).toBeVisible();
  await expect(page.getByRole('timer')).toBeVisible();
  // As in the previous app, the player keeps the header and breadcrumb (Dashboard > Mock Exams > Test).
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Mock Exams');

  await page.getByRole('radio', { name: /Mitochondria/ }).click();
  await page.getByRole('button', { name: 'Save & Next' }).click();
  await expect(page.getByText('SI unit of force?')).toBeVisible();

  await page.getByRole('button', { name: /Submit test/i }).click();
  const dialog = page.getByRole('dialog', { name: 'Submit your test?' });
  await expect(dialog).toContainText('1 of 2');
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click();

  await expect(page).toHaveURL(/\/neet\/tests\/mock\/result\/501$/);
  await expect(page.getByLabel('Score 4 out of 8')).toBeVisible();
  expect(submitted.questions?.map((q) => q.selected_option)).toEqual([12, null]);
});
