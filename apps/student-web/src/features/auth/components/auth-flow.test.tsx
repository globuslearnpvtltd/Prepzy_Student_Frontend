import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { authKeys } from '../hooks';
import { useOnboardingStore } from '../onboarding-store';
import { LoginForm } from './login-form';
import { OtpForm, safeNext } from './otp-form';
import { SetupForm } from './setup-form';
import { SignupForm } from './signup-form';

beforeEach(() => {
  useOnboardingStore.getState().reset();
  navigation.searchParams = new URLSearchParams();
});

describe('LoginForm', () => {
  it('validates the number before calling the backend', async () => {
    renderWithProviders(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Mobile number'), '12345');
    await userEvent.click(screen.getAllByRole('button', { name: 'Send OTP' })[0]!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid mobile number');
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('requests an OTP with the device id and moves to verification', async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/api/v4/auth/login-otp`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ success: true, message: 'OTP sent to your WhatsApp number', data: null });
      }),
    );
    navigation.searchParams = new URLSearchParams('next=/neet/tests');
    renderWithProviders(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Mobile number'), '98765 43210');
    await userEvent.click(screen.getAllByRole('button', { name: 'Send OTP' })[0]!);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/verify-otp?flow=login&next=%2Fneet%2Ftests'));
    expect(body).toEqual({ phone: '+919876543210', fingerprint: 'test-device' });
    expect(useOnboardingStore.getState()).toMatchObject({ phone: '+919876543210', flow: 'login' });
  });

  it('shows the backend message when the number is not registered (404 STUDENT_NOT_FOUND)', async () => {
    server.use(
      http.post(`${API}/api/v4/auth/login-otp`, () =>
        HttpResponse.json(
          {
            success: false,
            message: 'This phone number is not registered. Please sign up first.',
            code: 'STUDENT_NOT_FOUND',
            data: null,
          },
          { status: 404 },
        ),
      ),
    );
    renderWithProviders(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Mobile number'), '9876543210');
    await userEvent.click(screen.getAllByRole('button', { name: 'Send OTP' })[0]!);
    expect(await screen.findByRole('alert')).toHaveTextContent('not registered');
  });
});

describe('SignupForm', () => {
  it('skips the OTP step when the number was already verified', async () => {
    server.use(
      http.post(`${API}/api/v4/auth/register`, () =>
        HttpResponse.json({ success: true, message: 'Phone number already verified', data: { otp_verified: true } }),
      ),
    );
    renderWithProviders(<SignupForm />);
    await userEvent.type(screen.getByLabelText('Mobile number'), '9876543210');
    await userEvent.click(screen.getAllByRole('button', { name: 'Get OTP on WhatsApp' })[0]!);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/exam-selection'));
  });

  it('stores marketing preselections from the URL', () => {
    navigation.searchParams = new URLSearchParams('class_id=12&exam=NEET-UG&ref=FRIEND');
    renderWithProviders(<SignupForm />);
    expect(useOnboardingStore.getState()).toMatchObject({
      preselectedClassId: 12,
      preselectedExam: 'NEET-UG',
      referralCode: 'FRIEND',
    });
    // The welcome screen after sign-up reads the code from here and applies it.
    expect(localStorage.getItem('prepzy_referral_code')).toBe('FRIEND');
    localStorage.removeItem('prepzy_referral_code');
  });
});

describe('OtpForm', () => {
  it('restarts the flow when there is no phone number', () => {
    renderWithProviders(<OtpForm />);
    expect(navigation.replace).toHaveBeenCalledWith('/login');
  });

  it('logs in, caches the student and opens their exam dashboard', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'login');
    server.use(
      http.post(`${API}/api/v4/auth/verify-login-otp`, () =>
        HttpResponse.json({
          success: true,
          message: 'Logged in successfully',
          data: { account_id: 7, first_name: 'Ravi', target_exam: 'NEET-UG' },
        }),
      ),
    );
    const { queryClient } = renderWithProviders(<OtpForm />);
    await userEvent.type(screen.getByLabelText('One-time code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify & continue' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/neet/dashboard'));
    // Clearing the flow state after success must not bounce the student back to login.
    expect(navigation.replace).not.toHaveBeenCalledWith('/login');
    expect(queryClient.getQueryData(authKeys.me)).toMatchObject({ accountId: 7, firstName: 'Ravi' });
    expect(document.cookie).toContain('prepzy_exam=neet');
    expect(useOnboardingStore.getState().phone).toBeNull();
  });

  it('shows the backend message for a wrong code (400 INVALID_OTP)', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'login');
    server.use(
      http.post(`${API}/api/v4/auth/verify-login-otp`, () =>
        HttpResponse.json(
          {
            success: false,
            message: 'The OTP entered is incorrect. Please try again.',
            code: 'INVALID_OTP',
            data: null,
          },
          { status: 400 },
        ),
      ),
    );
    renderWithProviders(<OtpForm />);
    await userEvent.type(screen.getByLabelText('One-time code'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Verify & continue' }));
    expect(await screen.findByText('The OTP entered is incorrect. Please try again.')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalledWith(expect.stringContaining('dashboard'));
  });

  it('disables resend during the countdown', () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    renderWithProviders(<OtpForm />);
    expect(screen.getByRole('button', { name: /Resend in \d+s/ })).toBeDisabled();
  });

  it('only accepts same-site redirect targets', () => {
    expect(safeNext('/neet/tests')).toBe('/neet/tests');
    expect(safeNext('//evil.example')).toBeNull();
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

describe('SetupForm', () => {
  // GET …/onboarding-options of a target-year exam: lengths of its active plans, each with the class to send.
  const lengthOptions = (planLengths: Record<string, unknown>[]) =>
    http.get(`${API}/api/v4/billing/competitive/2/onboarding-options`, () =>
      HttpResponse.json({ success: true, data: { choose: 'target_year', plan_lengths: planLengths } }),
    );
  const onboarded = (onBody: (body: Record<string, unknown>) => void) =>
    http.post(`${API}/api/v4/auth/complete-onboarding`, async ({ request }) => {
      onBody((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({
        success: true,
        message: 'Onboarding completed successfully',
        data: { account_id: 9, target_exam: 'NEET-UG', plan_expiry_date: '2026-12-08T23:30:00.000Z' },
      });
    });

  it("completes target-year onboarding with the plan's class, the chosen length and the bundle", async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().selectExam(2, 'NEET-UG');
    let body: Record<string, unknown> = {};
    server.use(
      lengthOptions([
        { plan_length: 1, target_year: 2027, class_id: 21, has_bundle: false, bundle_options: [] },
        { plan_length: 2, target_year: 2028, class_id: 21, has_bundle: true, bundle_options: [{ exam_id: 1, title: 'CBSE' }] },
      ]),
      onboarded((b) => (body = b)),
    );
    renderWithProviders(<SetupForm />);
    expect((await screen.findAllByText('Which NEET UG are you writing?')).length).toBeGreaterThan(0);
    await userEvent.click(await screen.findByRole('radio', { name: 'NEET UG 2028' }));
    expect(screen.getByRole('radio', { name: 'NEET UG 2027' })).toBeInTheDocument();
    // A length with a combo plan asks what to prepare for next (step 5), as in the previous app.
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getAllByText('What are you preparing for?').length).toBeGreaterThan(0);
    expect(screen.getByRole('radio', { name: 'NEET UG only' })).toHaveTextContent('You get Topper NEET UG Monthly free');
    const bundle = screen.getByRole('radio', { name: 'NEET UG + CBSE' });
    // The registry's wording for what the combo adds.
    expect(bundle).toHaveTextContent('NEET UG only + CBSE Class 11 and 12 (PCB)');
    expect(bundle).toHaveTextContent('Most Chosen');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    // Back returns to the target year, keeping the choice.
    await userEvent.click(screen.getAllByRole('button', { name: 'Back' })[0]!);
    expect(screen.getByRole('radio', { name: 'NEET UG 2028' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('radio', { name: 'NEET UG + CBSE' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/welcome?exam=neet'));
    expect(navigation.replace).not.toHaveBeenCalledWith('/get-started');
    expect(body).toMatchObject({ phone: '+919876543210', exam_id: 2, class_id: 21, plan_length: 2, with_bundle: true });
  });

  it('falls back to the current year without an exam date and finishes at the year for a length without a combo', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().selectExam(2, 'NEET-UG');
    let body: Record<string, unknown> = {};
    server.use(
      lengthOptions([
        { plan_length: 1, target_year: null, class_id: 21, has_bundle: false, bundle_options: [] },
        { plan_length: 2, target_year: null, class_id: 21, has_bundle: true, bundle_options: [] },
      ]),
      onboarded((b) => (body = b)),
    );
    renderWithProviders(<SetupForm />);
    const year = new Date().getFullYear();
    await userEvent.click(await screen.findByRole('radio', { name: `NEET UG ${year + 1}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(body).toMatchObject({ class_id: 21, plan_length: 1, with_bundle: false }));
    expect(screen.queryByText('What are you preparing for?')).not.toBeInTheDocument();
  });

  it('works for a competitive exam without a registry entry: its name, plan lengths and bundle names from the backend', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().selectExam(3, 'JEE Main');
    let body: Record<string, unknown> = {};
    server.use(
      http.get(`${API}/api/v4/exams`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { exam_id: 1, exam_name: 'CBSE', exam_slice: 'cbse', category: 'board' },
            { exam_id: 3, exam_name: 'JEE Main', exam_slice: 'jee-main', category: 'competitive' },
          ],
        }),
      ),
      http.get(`${API}/api/v4/billing/competitive/3/onboarding-options`, () =>
        HttpResponse.json({
          success: true,
          data: {
            choose: 'target_year',
            plan_lengths: [{ plan_length: 1, target_year: 2027, class_id: 40, has_bundle: true, bundle_options: [{ exam_id: 1, title: 'CBSE' }] }],
          },
        }),
      ),
      onboarded((b) => (body = b)),
    );
    renderWithProviders(<SetupForm />);
    await userEvent.click(await screen.findByRole('radio', { name: 'JEE Main 2027' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const bundle = screen.getByRole('radio', { name: 'JEE Main + CBSE' });
    expect(bundle).toHaveTextContent('JEE Main only + CBSE');
    expect(bundle).toHaveTextContent('You get Topper JEE Main + CBSE Monthly free');
    await userEvent.click(screen.getByRole('radio', { name: 'JEE Main only' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(body).toMatchObject({ exam_id: 3, class_id: 40, plan_length: 1, with_bundle: false }));
    expect(navigation.replace).toHaveBeenCalledWith('/welcome?exam=jee-main');
  });

  it('hides the bundle option when no length has one, and shows load errors', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().selectExam(2, 'NEET-UG');
    server.use(lengthOptions([{ plan_length: 1, target_year: 2027, class_id: 21, has_bundle: false }]));
    const { unmount } = renderWithProviders(<SetupForm />);
    expect(await screen.findByRole('radio', { name: 'NEET UG 2027' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    unmount();

    server.use(
      http.get(`${API}/api/v4/billing/competitive/2/onboarding-options`, () =>
        HttpResponse.json({ success: false, message: 'Plans unavailable', code: 'PURCHASE_NOT_AVAILABLE' }, { status: 404 }),
      ),
    );
    renderWithProviders(<SetupForm />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Plans unavailable');
  });

  it('lets board students pick their class, preselecting from the marketing link', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().selectExam(1, 'CBSE');
    useOnboardingStore.getState().setPreselection({ classId: 12 });
    let body: Record<string, unknown> = {};
    server.use(
      http.get(`${API}/api/v4/billing/board/1/onboarding-options`, () =>
        HttpResponse.json({ success: true, data: { choose: 'class', plan_lengths: [] } }),
      ),
      http.get(`${API}/api/v4/learn/board/1/classes`, () =>
        HttpResponse.json({
          success: true,
          data: {
            classes: [
              { class_id: 11, title: 'CLASS 11', stream_name: 'PCM' },
              { class_id: 12, title: 'CLASS 12', stream_name: '' },
            ],
          },
        }),
      ),
      onboarded((b) => (body = b)),
    );
    renderWithProviders(<SetupForm />);
    expect(await screen.findByRole('button', { name: /Class 12/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Class 11/ })).toHaveTextContent('PCM');
    // Tapping a picked class again clears it (previous app), Continue needs a class.
    await userEvent.click(screen.getByRole('button', { name: /Class 12/ }));
    expect(screen.getByRole('button', { name: /Class 12/ })).toHaveAttribute('aria-pressed', 'false');
    for (const button of screen.getAllByRole('button', { name: 'Continue' })) expect(button).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Class 11/ }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Continue' })[0]!);
    await waitFor(() => expect(body).toMatchObject({ exam_id: 1, class_id: 11 }));
    expect(body.plan_length).toBeUndefined();
  });

  it('works for a board exam without a registry entry, with classes it shares with another exam', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().selectExam(10, 'JAC');
    let body: Record<string, unknown> = {};
    server.use(
      http.get(`${API}/api/v4/exams`, () =>
        HttpResponse.json({ success: true, data: [{ exam_id: 10, exam_name: 'JAC', exam_slice: 'jac2', category: 'board' }] }),
      ),
      http.get(`${API}/api/v4/billing/board/10/onboarding-options`, () =>
        HttpResponse.json({ success: true, data: { choose: 'class', plan_lengths: [] } }),
      ),
      http.get(`${API}/api/v4/learn/board/10/classes`, () =>
        HttpResponse.json({ success: true, data: { classes: [{ class_id: 2, title: 'CLASS 10', exam_id: 1, stream_name: '' }] } }),
      ),
      onboarded((b) => (body = b)),
    );
    renderWithProviders(<SetupForm />);
    expect(await screen.findByText('You picked JAC. Pick your class to get started.')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /Class 10/ }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Continue' })[0]!);
    await waitFor(() => expect(body).toMatchObject({ exam_id: 10, class_id: 2 }));
    expect(navigation.replace).toHaveBeenCalledWith('/welcome?exam=jac2');
  });
});
