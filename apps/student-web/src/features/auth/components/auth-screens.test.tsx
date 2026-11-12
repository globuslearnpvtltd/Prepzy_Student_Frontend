import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { onApiEvent } from '@/shared/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { useOnboardingStore } from '../onboarding-store';
import { phoneFormSchema, phoneSchema } from '../schemas';
import { AuthScreen, AuthSubmit, BrandPanel } from './auth-screen';
import { ExamPicker } from './exam-picker';
import { OtpForm } from './otp-form';
import { PhoneField } from './phone-field';
import { SetupForm } from './setup-form';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// GET /api/v4/exams: JEE Main is active in the backend but has no pages yet; reference books are not a sign-up exam.
const EXAM_LIST = {
  success: true,
  data: [
    { exam_id: 1, exam_name: 'CBSE', exam_slice: 'cbse', category: 'board' },
    { exam_id: 2, exam_name: 'NEET-UG', exam_slice: 'neet-ug', category: 'competitive' },
    { exam_id: 3, exam_name: 'JEE Main', exam_slice: 'jee-main', category: 'competitive' },
    { exam_id: 4, exam_name: 'Reference Books', exam_slice: 'reference-books', category: 'reference' },
  ],
};

beforeEach(() => {
  useOnboardingStore.getState().reset();
  navigation.searchParams = new URLSearchParams();
});

describe('ExamPicker', () => {
  it('sends students without a phone number back to the start', () => {
    server.use(http.get(`${API}/api/v4/exams`, () => HttpResponse.json(EXAM_LIST)));
    renderWithProviders(<ExamPicker />);
    expect(navigation.replace).toHaveBeenCalledWith('/get-started');
  });

  it('shows a loading skeleton, then the exams with unavailable ones disabled', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    server.use(http.get(`${API}/api/v4/exams`, () => HttpResponse.json(EXAM_LIST)));
    const { container } = renderWithProviders(<ExamPicker />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: /CBSE/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /NEET-UG/ })).toBeEnabled();
    const jee = screen.getByRole('radio', { name: /JEE Main/ });
    expect(jee).toBeDisabled();
    expect(jee).toHaveTextContent('Coming soon');
    expect(screen.queryByRole('radio', { name: /Reference Books/ })).not.toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
    // Nothing chosen yet.
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('stores the chosen exam and moves on to setup', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    server.use(http.get(`${API}/api/v4/exams`, () => HttpResponse.json(EXAM_LIST)));
    renderWithProviders(<ExamPicker />);
    await userEvent.click(await screen.findByRole('radio', { name: /NEET-UG/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(useOnboardingStore.getState()).toMatchObject({ examId: 2, examName: 'NEET-UG' });
    expect(navigation.push).toHaveBeenCalledWith('/setup');
  });

  it('preselects the exam from a marketing link (case-insensitive)', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().setPreselection({ exam: 'neet-ug' });
    server.use(http.get(`${API}/api/v4/exams`, () => HttpResponse.json(EXAM_LIST)));
    renderWithProviders(<ExamPicker />);
    await waitFor(() => expect(screen.getByRole('radio', { name: /NEET-UG/ })).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('ignores an unknown preselected exam', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().setPreselection({ exam: 'GATE' });
    server.use(http.get(`${API}/api/v4/exams`, () => HttpResponse.json(EXAM_LIST)));
    renderWithProviders(<ExamPicker />);
    await screen.findByRole('radio', { name: /CBSE/ });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('keeps the exam picked earlier in this flow', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().selectExam(1, 'CBSE');
    server.use(http.get(`${API}/api/v4/exams`, () => HttpResponse.json(EXAM_LIST)));
    renderWithProviders(<ExamPicker />);
    expect(await screen.findByRole('radio', { name: /CBSE/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the backend message when the list fails with HTTP 200 + success:false', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    server.use(
      http.get(`${API}/api/v4/exams`, () => HttpResponse.json({ success: false, message: 'Exams unavailable' })),
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
    // Brand panel (desktop) and the stat list under the card (mobile).
    expect(screen.getByRole('heading', { name: /Prepare better/ })).toBeInTheDocument();
    expect(screen.getAllByText('200k+')).toHaveLength(2);
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
    // Only the brand panel's stats, no mobile stat list.
    expect(screen.getAllByText('200k+')).toHaveLength(1);
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

describe('Onboarding step screens', () => {
  it('draws the typed code in six boxes, digits only', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    renderWithProviders(<OtpForm />);
    const input = screen.getByLabelText('One-time code');
    await userEvent.type(input, '12a3');
    expect(input).toHaveValue('123');
    // The boxes are drawn next to the (transparent) input.
    const boxes = input.parentElement!.querySelectorAll(':scope > [aria-hidden="true"] > span');
    expect(boxes).toHaveLength(6);
    expect([...boxes].map((box) => box.textContent)).toEqual(['1', '2', '3', '', '', '']);
    expect(screen.getAllByText('We sent a 6-digit code on WhatsApp to +919876543210.')).toHaveLength(2);
  });

  it('shows step 2 and goes back to the start of the flow it came from', () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'login');
    const { unmount } = renderWithProviders(<OtpForm />);
    expect(screen.getAllByText('Step 2')).toHaveLength(2);
    screen.getAllByRole('link', { name: 'Back' }).forEach((link) => expect(link).toHaveAttribute('href', '/login'));
    expect(screen.getByRole('heading', { name: "What's waiting inside" })).toBeInTheDocument();
    unmount();

    navigation.searchParams = new URLSearchParams('flow=signup');
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    renderWithProviders(<OtpForm />);
    screen.getAllByRole('link', { name: 'Back' }).forEach((link) => expect(link).toHaveAttribute('href', '/get-started'));
  });

  it('lists the live and upcoming exams under the exam cards', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    server.use(http.get(`${API}/api/v4/exams`, () => HttpResponse.json(EXAM_LIST)));
    renderWithProviders(<ExamPicker />);
    expect(await screen.findByText('CBSE and NEET-UG are live. JEE Main is on the way.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /CBSE/ })).toHaveTextContent('Class 6 to 12');
    expect(screen.getAllByText('Step 3')).toHaveLength(2);
  });

  it('groups classes by grade and folds streams of one class into an expandable card', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'signup');
    useOnboardingStore.getState().selectExam(1, 'CBSE');
    server.use(
      http.get(`${API}/api/v4/billing/board/1/onboarding-options`, () =>
        HttpResponse.json({ success: true, data: { choose: 'class', plan_lengths: [] } }),
      ),
      http.get(`${API}/api/v4/learn/board/1/classes`, () =>
        HttpResponse.json({
          success: true,
          data: {
            classes: [
              { class_id: 6, title: 'Class 6', stream_name: null },
              { class_id: 10, title: 'Class 10', stream_name: null },
              { class_id: 11, title: 'Class 11', stream_name: 'PCM' },
              { class_id: 13, title: 'Class 11', stream_name: 'PCB' },
            ],
          },
        }),
      ),
    );
    renderWithProviders(<SetupForm />);
    expect(await screen.findByRole('radio', { name: 'Class 6' })).toHaveTextContent('NCERT · practice · Atlas AI');
    expect(screen.getByText('Foundation')).toBeInTheDocument();
    expect(screen.getByText('Secondary · Boards')).toBeInTheDocument();
    expect(screen.getByText('2 streams inside')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'PCB' })).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /Class 11/ });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'PCB' }));
    expect(within(toggle).getByText('PCB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
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
      http.post(`${API}/api/v4/auth/verify-otp`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ success: true, message: 'Phone number verified', data: null });
      }),
    );
    renderWithProviders(<OtpForm />);
    await userEvent.type(screen.getByLabelText('One-time code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify & continue' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/exam-selection'));
    expect(body).toEqual({ phone: '+919876543210', otp: '123456' });
  });

  it('sends the student to a safe ?next= page after login', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'login');
    navigation.searchParams = new URLSearchParams('next=/neet/tests');
    server.use(
      http.post(`${API}/api/v4/auth/verify-login-otp`, () =>
        HttpResponse.json({ success: true, message: 'Logged in successfully', data: { account_id: 7 } }),
      ),
    );
    renderWithProviders(<OtpForm />);
    await userEvent.type(screen.getByLabelText('One-time code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify & continue' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/neet/tests'));
    expect(document.cookie).toContain('prepzy_exam=cbse');
  });

  it('validates the code format before calling the backend', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'login');
    renderWithProviders(<OtpForm />);
    await userEvent.type(screen.getByLabelText('One-time code'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Verify & continue' }));
    expect(await screen.findByText('Enter the 6-digit code')).toBeInTheDocument();
  });

  it('shows a generic message when the server fails', async () => {
    useOnboardingStore.getState().startOtp('+919876543210', 'login');
    server.use(
      http.post(`${API}/api/v4/auth/verify-login-otp`, () =>
        HttpResponse.json(
          { success: false, message: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', data: null },
          { status: 500 },
        ),
      ),
    );
    renderWithProviders(<OtpForm />);
    await userEvent.type(screen.getByLabelText('One-time code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify & continue' }));
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
        http.post(`${API}/api/v4/auth/resend-otp`, ({ request }) => {
          flow = new URL(request.url).searchParams.get('flow');
          return HttpResponse.json({ success: true, message: 'OTP sent to your WhatsApp number', data: null });
        }),
      );
      renderWithProviders(<OtpForm />);
      await waitOutCountdown();
      const resend = screen.getByRole('button', { name: 'Resend OTP' });
      expect(resend).toBeEnabled();
      fireEvent.click(resend);
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('A new code is on its way.'));
      expect(flow).toBe('signup');
      expect(screen.getByRole('button', { name: /Resend in 59s/ })).toBeDisabled();
    });

    it('shows the rate-limit message as a toast, not the plan-limit dialog (429 TOO_MANY_REQUESTS)', async () => {
      useOnboardingStore.getState().startOtp('+919876543210', 'login');
      const message = 'Too many OTP requests for this number. Please wait a few minutes and try again.';
      const planLimit = vi.fn();
      const stop = onApiEvent('rateLimited', planLimit);
      server.use(
        http.post(`${API}/api/v4/auth/resend-otp`, () =>
          HttpResponse.json({ success: false, message, code: 'TOO_MANY_REQUESTS', data: null }, { status: 429 }),
        ),
      );
      renderWithProviders(<OtpForm />);
      await waitOutCountdown();
      fireEvent.click(screen.getByRole('button', { name: 'Resend OTP' }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
      expect(planLimit).not.toHaveBeenCalled();
      stop();
    });

    it('shows the WhatsApp delivery failure message (502 OTP_DELIVERY_FAILED)', async () => {
      useOnboardingStore.getState().startOtp('+919876543210', 'signup');
      const message = 'Failed to send OTP. Please check your network and try again.';
      server.use(
        http.post(`${API}/api/v4/auth/resend-otp`, () =>
          HttpResponse.json({ success: false, message, code: 'OTP_DELIVERY_FAILED', data: null }, { status: 502 }),
        ),
      );
      renderWithProviders(<OtpForm />);
      await waitOutCountdown();
      fireEvent.click(screen.getByRole('button', { name: 'Resend OTP' }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    });
  });
});
