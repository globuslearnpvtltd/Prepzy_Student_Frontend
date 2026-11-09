import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { useOnboardingStore } from '../onboarding-store';
import { phoneFormSchema, phoneSchema } from '../schemas';
import { AuthScreen, AuthSubmit, BrandPanel } from './auth-screen';
import { ExamPicker } from './exam-picker';
import { OtpForm } from './otp-form';
import { PhoneField } from './phone-field';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const EXAM_LIST = {
  success: true,
  data: [
    { exam_id: 1, exam_name: 'CBSE', exam_slice: 'cbse' },
    { exam_id: 2, exam_name: 'NEET-UG', exam_slice: 'neet-ug' },
    { exam_id: 3, exam_name: 'JEE Main', exam_slice: 'jee-main' },
  ],
};

beforeEach(() => {
  useOnboardingStore.getState().reset();
  navigation.searchParams = new URLSearchParams();
});

describe('ExamPicker', () => {
  it('sends students without a phone number back to the start', () => {
    server.use(http.get(`${API}/api/exam-list`, () => HttpResponse.json(EXAM_LIST)));
    renderWithProviders(<ExamPicker />);
    expect(navigation.replace).toHaveBeenCalledWith('/get-started');
  });

  it('shows a loading skeleton, then the exams with unavailable ones disabled', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    server.use(http.get(`${API}/api/exam-list`, () => HttpResponse.json(EXAM_LIST)));
    const { container } = renderWithProviders(<ExamPicker />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: /CBSE/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /NEET-UG/ })).toBeEnabled();
    const jee = screen.getByRole('radio', { name: /JEE Main/ });
    expect(jee).toBeDisabled();
    expect(jee).toHaveTextContent('Coming soon');
    expect(navigation.replace).not.toHaveBeenCalled();
    // Nothing chosen yet.
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('stores the chosen exam and moves on to setup', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    server.use(http.get(`${API}/api/exam-list`, () => HttpResponse.json(EXAM_LIST)));
    renderWithProviders(<ExamPicker />);
    await userEvent.click(await screen.findByRole('radio', { name: /NEET-UG/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(useOnboardingStore.getState()).toMatchObject({ examId: 2, examName: 'NEET-UG' });
    expect(navigation.push).toHaveBeenCalledWith('/setup');
  });

  it('preselects the exam from a marketing link (case-insensitive)', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().setPreselection({ exam: 'neet-ug' });
    server.use(http.get(`${API}/api/exam-list`, () => HttpResponse.json(EXAM_LIST)));
    renderWithProviders(<ExamPicker />);
    await waitFor(() => expect(screen.getByRole('radio', { name: /NEET-UG/ })).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('ignores an unknown preselected exam', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().setPreselection({ exam: 'GATE' });
    server.use(http.get(`${API}/api/exam-list`, () => HttpResponse.json(EXAM_LIST)));
    renderWithProviders(<ExamPicker />);
    await screen.findByRole('radio', { name: /CBSE/ });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('keeps the exam picked earlier in this flow', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().selectExam(1, 'CBSE');
    server.use(http.get(`${API}/api/exam-list`, () => HttpResponse.json(EXAM_LIST)));
    renderWithProviders(<ExamPicker />);
    expect(await screen.findByRole('radio', { name: /CBSE/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the backend message when the list fails with HTTP 200 + success:false', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    server.use(
      http.get(`${API}/api/exam-list`, () => HttpResponse.json({ success: false, message: 'Exams unavailable' })),
    );
    renderWithProviders(<ExamPicker />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Exams unavailable');
  });
});

describe('AuthScreen', () => {
  it('renders the titles, progress, stats and legal links', () => {
    const { container } = renderWithProviders(
      <AuthScreen eyebrow="Step" title="Log in" subtitle="Welcome back" step={[2, 4]} showStats>
        <p>form</p>
      </AuthScreen>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByText('Step')).toBeInTheDocument();
    expect(screen.getAllByText('Welcome back')).toHaveLength(2);
    expect(screen.getByText('form')).toBeInTheDocument();
    expect(screen.getByText('200k+')).toBeInTheDocument();
    expect(container.querySelector('[style*="width: 50%"]')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Our Terms' })).toHaveAttribute('href', expect.stringMatching(/\/terms$/));
    expect(screen.getByRole('link', { name: 'Privacy Policy.' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/policy$/),
    );
  });

  it('uses separate mobile copy and omits optional parts', () => {
    const { container } = renderWithProviders(
      <AuthScreen title="Desktop title" mobileTitle="Mobile title">
        <p>form</p>
      </AuthScreen>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Mobile title' })).toBeInTheDocument();
    expect(screen.queryByText('200k+')).not.toBeInTheDocument();
    expect(container.querySelector('[style*="width"]')).not.toBeInTheDocument();
  });

  it('renders the brand panel and a submit button tied to the form', () => {
    renderWithProviders(
      <>
        <BrandPanel />
        <form id="f" />
        <AuthSubmit form="f">Send OTP</AuthSubmit>
      </>,
    );
    expect(screen.getByRole('heading', { name: /Prepare better/ })).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Send OTP' });
    expect(buttons).toHaveLength(2);
    buttons.forEach((button) => expect(button).toHaveAttribute('form', 'f'));
  });
});

function PhoneHarness({ error }: { error?: string }) {
  const [country, setCountry] = useState('IN');
  const form = useForm<{ phone: string }>();
  return (
    <>
      <PhoneField country={country} onCountryChange={setCountry} registration={form.register('phone')} error={error} />
      <output>{country}</output>
    </>
  );
}

const registration = { name: 'phone', onChange: async () => undefined, onBlur: async () => undefined, ref: () => undefined };

describe('PhoneField', () => {
  it('shows the dial code of the chosen country', async () => {
    renderWithProviders(<PhoneHarness />);
    expect(screen.getByText('+91')).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile number')).not.toHaveAttribute('aria-describedby');
    await userEvent.selectOptions(screen.getByLabelText('Country code'), 'GB');
    expect(screen.getByRole('status')).toHaveTextContent('GB');
    expect(screen.getByText('+44')).toBeInTheDocument();
  });

  it('links the error message to the input', () => {
    renderWithProviders(<PhoneHarness error="Enter your mobile number" />);
    const input = screen.getByLabelText('Mobile number');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'phone-error');
    expect(screen.getByText('Enter your mobile number')).toBeInTheDocument();
  });

  it('falls back to region codes without Intl.DisplayNames and +91 for unknown countries', () => {
    const original = Intl.DisplayNames;
    Object.defineProperty(Intl, 'DisplayNames', { value: undefined, configurable: true });
    try {
      renderWithProviders(
        <PhoneField country="ZZ" onCountryChange={() => undefined} registration={registration} />,
      );
      expect(screen.getByRole('option', { name: 'IN (+91)' })).toBeInTheDocument();
      expect(screen.getByText('+91')).toBeInTheDocument();
    } finally {
      Object.defineProperty(Intl, 'DisplayNames', { value: original, configurable: true });
    }
  });
});

describe('phone schemas', () => {
  it('builds the international number from the picked country', () => {
    expect(phoneFormSchema.parse({ country: 'GB', phone: '7700 900123' })).toBe('+447700900123');
    expect(phoneFormSchema.parse({ country: 'XX', phone: '98765 43210' })).toBe('+919876543210');
    expect(phoneFormSchema.safeParse({ country: 'IN', phone: '12345' }).success).toBe(false);
    expect(phoneSchema.parse(' 98765 43210 ')).toBe('+919876543210');
    expect(phoneSchema.safeParse('').success).toBe(false);
  });
});

describe('OtpForm (more flows)', () => {
  it('restarts sign-up at get-started when there is no phone', () => {
    navigation.searchParams = new URLSearchParams('flow=signup');
    renderWithProviders(<OtpForm />);
    expect(navigation.replace).toHaveBeenCalledWith('/get-started');
  });

  it('verifies a sign-up code and continues to exam selection', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    let body: unknown;
    server.use(
      http.post(`${API}/api/auth/v2/verify-otp`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );
    renderWithProviders(<OtpForm />);
    await userEvent.type(screen.getByLabelText('One-time code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/exam-selection'));
    expect(body).toEqual({ phone: '+919876543210', otp: '123456' });
  });

  it('sends the student to a safe ?next= page after login', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'login');
    navigation.searchParams = new URLSearchParams('next=/neet/tests');
    server.use(
      http.post(`${API}/api/auth/verifyLoginOtp`, () => HttpResponse.json({ success: true, account_id: 7 })),
    );
    renderWithProviders(<OtpForm />);
    await userEvent.type(screen.getByLabelText('One-time code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/neet/tests'));
    expect(document.cookie).toContain('prepzy_exam=cbse');
  });

  it('validates the code format before calling the backend', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'login');
    renderWithProviders(<OtpForm />);
    await userEvent.type(screen.getByLabelText('One-time code'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('Enter the 6-digit code')).toBeInTheDocument();
  });

  it('shows a generic message when the server fails', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'login');
    server.use(http.post(`${API}/api/auth/verifyLoginOtp`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<OtpForm />);
    await userEvent.type(screen.getByLabelText('One-time code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('That code is not valid. Please try again.')).toBeInTheDocument();
  });

  describe('resend', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    async function waitOutCountdown() {
      for (let i = 0; i < 60; i += 1) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }
    }

    it('resends after the countdown and restarts it', async () => {
      useOnboardingStore.getState().startOtp('+919876543210', 'signup');
      let flow: string | null = null;
      server.use(
        http.post(`${API}/api/auth/v2/resend-otp`, ({ request }) => {
          flow = new URL(request.url).searchParams.get('flow');
          return HttpResponse.json({ success: true });
        }),
      );
      renderWithProviders(<OtpForm />);
      await waitOutCountdown();
      const resend = screen.getByRole('button', { name: 'Resend code' });
      expect(resend).toBeEnabled();
      fireEvent.click(resend);
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('A new code is on its way.'));
      expect(flow).toBe('signup');
      expect(screen.getByRole('button', { name: /Resend code in 59s/ })).toBeDisabled();
    });

    it('shows a toast when resending fails (HTTP 200 + success:false)', async () => {
      useOnboardingStore.getState().startOtp('+919876543210', 'login');
      server.use(
        http.post(`${API}/api/auth/v2/resend-otp`, () =>
          HttpResponse.json({ success: false, message: 'Too many attempts' }),
        ),
      );
      renderWithProviders(<OtpForm />);
      await waitOutCountdown();
      fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Too many attempts'));
    });
  });
});
