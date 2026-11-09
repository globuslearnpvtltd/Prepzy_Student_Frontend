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
      http.post(`${API}/api/auth/loginWithOtp`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ success: true });
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

  it('shows the backend message when the number is not registered (HTTP 200 + success:false)', async () => {
    server.use(
      http.post(`${API}/api/auth/loginWithOtp`, () =>
        HttpResponse.json({ success: false, message: 'This phone number is not registered. Please sign up first.' }),
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
      http.post(`${API}/api/v1/auth/register`, () =>
        HttpResponse.json({ success: true, data: { otp_verified: true } }),
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
      http.post(`${API}/api/auth/verifyLoginOtp`, () =>
        HttpResponse.json({ success: true, account_id: 7, first_name: 'Ravi', target_exam: 'NEET-UG' }),
      ),
    );
    const { queryClient } = renderWithProviders(<OtpForm />);
    await userEvent.type(screen.getByLabelText('One-time code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/neet/dashboard'));
    // Clearing the flow state after success must not bounce the student back to login.
    expect(navigation.replace).not.toHaveBeenCalledWith('/login');
    expect(queryClient.getQueryData(authKeys.me)).toMatchObject({ accountId: 7, firstName: 'Ravi' });
    expect(document.cookie).toContain('prepzy_exam=neet');
    expect(useOnboardingStore.getState().phone).toBeNull();
  });

  it('shows an error when the backend rejects the code with HTTP 200', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'login');
    server.use(http.post(`${API}/api/auth/verifyLoginOtp`, () => HttpResponse.json({ error: 'Invalid Otp' })));
    renderWithProviders(<OtpForm />);
    await userEvent.type(screen.getByLabelText('One-time code'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('Invalid Otp')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalledWith(expect.stringContaining('dashboard'));
  });

  it('disables resend during the countdown', () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    renderWithProviders(<OtpForm />);
    expect(screen.getByRole('button', { name: /Resend code in \d+s/ })).toBeDisabled();
  });

  it('only accepts same-site redirect targets', () => {
    expect(safeNext('/neet/tests')).toBe('/neet/tests');
    expect(safeNext('//evil.example')).toBeNull();
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

describe('SetupForm', () => {
  it('completes NEET onboarding with the configured class and chosen target year', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().selectExam(2, 'NEET-UG');
    let body: Record<string, unknown> = {};
    server.use(
      http.get(`${API}/api/neet-plan-lengths`, () => HttpResponse.json({ success: true, data: [1, 2] })),
      http.post(`${API}/api/auth/v3/complete-onboarding`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, account_id: 9, target_exam: 'NEET-UG' });
      }),
    );
    renderWithProviders(<SetupForm />);
    const year = new Date().getFullYear() + 2;
    await userEvent.click(await screen.findByRole('radio', { name: `NEET UG ${year}` }));
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Start learning' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/welcome?exam=neet'));
    expect(navigation.replace).not.toHaveBeenCalledWith('/get-started');
    expect(body).toMatchObject({ phone: '+919876543210', exam_id: 2, class_id: 20, plan_length: 2, with_cbse: true });
  });

  it('lets CBSE students pick their class, preselecting from the marketing link', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().selectExam(1, 'CBSE');
    useOnboardingStore.getState().setPreselection({ classId: 12 });
    server.use(
      http.get(`${API}/api/class-list`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { class_id: 11, title: 'CLASS 11', stream_name: 'PCM' },
            { class_id: 12, title: 'CLASS 12', stream_name: '' },
          ],
        }),
      ),
    );
    renderWithProviders(<SetupForm />);
    expect(await screen.findByRole('radio', { name: 'CLASS 12' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /CLASS 11/ })).toHaveTextContent('PCM');
  });
});
