import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { parentKeys } from '../hooks';
import { ParentDashboard } from './dashboard';
import { ParentLoginScreen } from './login-screen';
import { ParentHeader } from './parent-header';

const PARENTS = `${API}/api/v4/parents`;
const GENERATE = `${PARENTS}/auth/otp`;
const VERIFY = `${PARENTS}/auth/verify`;

beforeEach(() => localStorage.clear());

async function typeOtp(code: string) {
  for (const [i, digit] of [...code].entries()) {
    await userEvent.type(screen.getByLabelText(`Digit ${i + 1}`), digit);
  }
}

describe('ParentLoginScreen', () => {
  it('sends an email code, then verifies it and opens the dashboard', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(GENERATE, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ success: true });
      }),
      http.post(VERIFY, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ success: true, message: 'Logged in successfully', data: { parent_data: { account_id: 5 } } });
      }),
    );
    renderWithProviders(<ParentLoginScreen />);
    await userEvent.type(screen.getByLabelText('Email'), 'sunita@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText('OTP sent successfully via email')).toBeInTheDocument();
    expect(screen.getByText('sunita@example.com')).toBeInTheDocument();
    expect(screen.getByText(/Resend in 2:00/)).toBeInTheDocument();
    expect(Number(localStorage.getItem('otp_resend_until'))).toBeGreaterThan(Date.now());

    await typeOtp('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify & sign in' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/parents/dashboard'));
    expect(bodies).toEqual([
      { method: 'email', contact: 'sunita@example.com' },
      { contact: 'sunita@example.com', otp: '123456' },
    ]);
  });

  it('sends the code on WhatsApp with the full international number', async () => {
    let body: unknown;
    server.use(
      http.post(GENERATE, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );
    renderWithProviders(<ParentLoginScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Continue with WhatsApp instead' }));
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '98765 43210');
    await userEvent.click(screen.getByRole('button', { name: 'Send code on WhatsApp' }));

    expect(await screen.findByRole('heading', { name: 'Check your WhatsApp' })).toBeInTheDocument();
    expect(body).toEqual({ method: 'whatsapp', contact: '+919876543210' });
    expect(screen.getByText('+919876543210')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '← Back' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Email instead' }));
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('uses the picked country code', async () => {
    let body: unknown;
    server.use(
      http.post(GENERATE, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );
    renderWithProviders(<ParentLoginScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Continue with WhatsApp instead' }));
    await userEvent.selectOptions(screen.getByLabelText('Country code'), 'AE');
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '501234567');
    await userEvent.click(screen.getByRole('button', { name: 'Send code on WhatsApp' }));
    await waitFor(() => expect(body).toEqual({ method: 'whatsapp', contact: '+971501234567' }));
  });

  it('asks for credentials before calling the backend', async () => {
    const called = vi.fn();
    server.use(http.post(GENERATE, () => (called(), HttpResponse.json({ success: true }))));
    renderWithProviders(<ParentLoginScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Add Valid Credentials');

    await userEvent.click(screen.getByRole('button', { name: 'Continue with WhatsApp instead' }));
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Send code on WhatsApp' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Add Valid Credentials');
    expect(called).not.toHaveBeenCalled();
  });

  it('shows the backend error for an unregistered contact (404 ACCOUNT_NOT_FOUND)', async () => {
    server.use(
      http.post(GENERATE, () =>
        HttpResponse.json(
          { success: false, message: 'This phone number or email is not registered.', code: 'ACCOUNT_NOT_FOUND', data: null },
          { status: 404 },
        ),
      ),
    );
    renderWithProviders(<ParentLoginScreen />);
    await userEvent.type(screen.getByLabelText('Email'), 'nobody@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not registered');
    expect(screen.queryByRole('heading', { name: 'Check your email' })).not.toBeInTheDocument();
  });

  it('shows the INVALID_OTP message and clears the code', async () => {
    server.use(
      http.post(GENERATE, () => HttpResponse.json({ success: true })),
      http.post(VERIFY, () =>
        HttpResponse.json({ success: false, message: 'Invalid Otp', code: 'INVALID_OTP', data: null }, { status: 400 }),
      ),
    );
    renderWithProviders(<ParentLoginScreen />);
    await userEvent.type(screen.getByLabelText('Email'), 'sunita@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
    await screen.findByRole('heading', { name: 'Check your email' });

    // Paste fills every box.
    fireEvent.paste(screen.getByLabelText('Digit 1'), { clipboardData: { getData: () => '65-43 21' } });
    expect(screen.getByLabelText('Digit 6')).toHaveValue('1');
    await userEvent.click(screen.getByRole('button', { name: 'Verify & sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid Otp');
    expect(screen.getByLabelText('Digit 1')).toHaveValue('');
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('handles HTTP errors on verify and an incomplete code', async () => {
    server.use(
      http.post(GENERATE, () => HttpResponse.json({ success: true })),
      http.post(VERIFY, () => HttpResponse.json({ message: 'Otp Expired' }, { status: 400 })),
    );
    renderWithProviders(<ParentLoginScreen />);
    await userEvent.type(screen.getByLabelText('Email'), 'sunita@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
    await screen.findByRole('heading', { name: 'Check your email' });

    await typeOtp('12');
    await userEvent.type(screen.getByLabelText('Digit 3'), 'x');
    expect(screen.getByLabelText('Digit 3')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Verify & sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the 6-digit code');

    // Backspace in an empty box moves back.
    await userEvent.click(screen.getByLabelText('Digit 3'));
    await userEvent.keyboard('{Backspace}');
    expect(screen.getByLabelText('Digit 2')).toHaveFocus();

    await typeOtp('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify & sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Otp Expired');
  });

  it('counts down before offering Resend', async () => {
    server.use(http.post(GENERATE, () => HttpResponse.json({ success: true })));
    renderWithProviders(<ParentLoginScreen />);
    await userEvent.type(screen.getByLabelText('Email'), 'sunita@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
    await screen.findByText(/Resend in 2:00/);
    expect(await screen.findByText(/Resend in 1:59/, undefined, { timeout: 2000 })).toBeInTheDocument();
  });

  it('shows Resend when the countdown ends and sends the code again', async () => {
    let sends = 0;
    server.use(http.post(GENERATE, () => (sends++, HttpResponse.json({ success: true }))));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithProviders(<ParentLoginScreen />);
      await user.type(screen.getByLabelText('Email'), 'sunita@example.com');
      await user.click(screen.getByRole('button', { name: 'Send verification code' }));
      await screen.findByRole('heading', { name: 'Check your email' });
      for (let i = 0; i < 121; i++) act(() => vi.advanceTimersByTime(1000));
      expect(localStorage.getItem('otp_resend_until')).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Resend' }));
      await waitFor(() => expect(sends).toBe(2));
    } finally {
      vi.useRealTimers();
    }
  });
});

const children = {
  success: true,
  data: {
    student_data: [
      {
        account_id: 1,
        first_name: 'Ravi',
        last_name: 'Kumar',
        created_at: '2025-06-14T10:00:00.000Z',
        classes: [
          { class_id: 12, class_name: 'CLASS 12', stream_name: 'PCB' },
          { class_id: 11, class_name: 'CLASS 11', stream_name: 'PCB' },
        ],
      },
      { account_id: 2, first_name: 'Asha', last_name: 'Kumar', created_at: null, classes: [] },
    ],
  },
};

function dashboardHandlers(seen: string[] = []) {
  const record = (request: Request) => {
    const url = new URL(request.url);
    seen.push(`${url.pathname.split('/students/').pop()}?${url.searchParams.toString()}`);
  };
  return [
    http.get(`${PARENTS}/students`, () => HttpResponse.json(children)),
    http.get(`${PARENTS}/students/:studentId/learning-hours`, ({ request }) => {
      record(request);
      return HttpResponse.json({
        success: true,
        data: {
          graph_data: { Mon: 1, Today: 0.5 },
          study_engagement: {
            this_week: { total_hours: 6.25, hours: 6, minutes: 15 },
            total_since_joining_hours: 84,
            avg_minutes_per_active_day: 54,
          },
        },
      });
    }),
    http.get(`${PARENTS}/students/:studentId/videos`, ({ request }) => {
      record(request);
      return HttpResponse.json({
        success: true,
        data: {
          video_completion: {
            total: 24,
            subjects: [{ subject_id: 1, subject_name: 'Physics', count: 10 }],
            chapters: ['Solutions'],
          },
        },
      });
    }),
    http.get(`${PARENTS}/students/:studentId/doubts`, () =>
      HttpResponse.json({
        success: true,
        data: {
          doubts: {
            total: 37,
            subjects: [{ name: 'Biology', count: 11, color: '#10B981' }],
            categories: [{ label: 'ATLAS', count: 18, color: '#3D348B' }],
          },
        },
      }),
    ),
    http.get(`${PARENTS}/students/:studentId/assessments`, () =>
      HttpResponse.json({ success: true, data: { assessments: { total: 12, categories: [{ label: 'Quiz', count: 6, percentage: 72 }] } } }),
    ),
  ];
}

describe('ParentDashboard', () => {
  it('shows the first child with their first class, and switches class and child', async () => {
    const seen: string[] = [];
    server.use(...dashboardHandlers(seen));
    renderWithProviders(<ParentDashboard />);

    expect(await screen.findByRole('heading', { name: 'Ravi Kumar' })).toBeInTheDocument();
    expect(screen.getByText('RK')).toBeInTheDocument();
    expect(screen.getByText('Since 14 Jun 2025')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CLASS 12 PCB' })).toHaveAttribute('aria-pressed', 'true');

    expect(await screen.findByText('6h 15 Min')).toBeInTheDocument();
    expect(screen.getByText('84h')).toBeInTheDocument();
    expect(screen.getByText('54 Min')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'Today 30 min' })).toBeInTheDocument();
    expect(await screen.findByText('24')).toBeInTheDocument();
    expect(screen.getByText('Solutions')).toBeInTheDocument();
    expect(await screen.findByText('37')).toBeInTheDocument();
    expect(screen.getByText('ATLAS')).toBeInTheDocument();
    expect(await screen.findByText('Quiz (6)')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(seen).toContain('1/learning-hours?class_id=12');

    await userEvent.click(screen.getByRole('button', { name: 'CLASS 11 PCB' }));
    await waitFor(() => expect(seen).toContain('1/videos?class_id=11'));

    await userEvent.click(screen.getByRole('button', { name: 'Asha Kumar' }));
    expect(await screen.findByText(/hasn.t joined a class yet/)).toBeInTheDocument();
    expect(screen.getByText('Since —')).toBeInTheDocument();
  });

  it('explains when no student is linked', async () => {
    server.use(
      http.get(`${PARENTS}/students`, () =>
        HttpResponse.json({ success: true, data: { student_data: [] } }),
      ),
    );
    renderWithProviders(<ParentDashboard />);
    expect(await screen.findByText('No students linked yet')).toBeInTheDocument();
  });

  it('shows an error with a retry', async () => {
    let calls = 0;
    server.use(
      http.get(`${PARENTS}/students`, () => {
        calls++;
        return calls === 1 ? HttpResponse.json({ message: 'Bad request' }, { status: 400 }) : HttpResponse.json(children);
      }),
      ...dashboardHandlers().slice(1),
    );
    renderWithProviders(<ParentDashboard />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Bad request');
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Ravi Kumar' })).toBeInTheDocument();
  });

  it('marks a section that fails to load', async () => {
    server.use(
      http.get(`${PARENTS}/students/:studentId/assessments`, () =>
        HttpResponse.json({ message: 'nope' }, { status: 400 }),
      ),
      ...dashboardHandlers(),
    );
    renderWithProviders(<ParentDashboard />);
    const card = await screen.findByRole('region', { name: 'Tests & Assessments ( With Avg Score )' });
    expect(await within(card).findByText("Couldn't load this section.")).toBeInTheDocument();
  });
});

describe('ParentHeader', () => {
  it('shows the parent in the menu and logs out to the portal login, clearing cached data', async () => {
    let loggedOut = false;
    server.use(
      http.get(`${PARENTS}/auth/me`, () =>
        HttpResponse.json({
          success: true,
          data: { parent_data: { account_id: 5, first_name: 'Sunita', last_name: 'Kumar', email: 'sunita@example.com', phone: '+919876500000' } },
        }),
      ),
      http.post(`${PARENTS}/auth/logout`, () => {
        loggedOut = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const { queryClient } = renderWithProviders(<ParentHeader />);
    queryClient.setQueryData(parentKeys.children, []);
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(await screen.findAllByText('Sunita Kumar')).not.toHaveLength(0);
    expect(screen.getAllByText('sunita@example.com')).not.toHaveLength(0);

    const menu = screen.getByRole('button', { name: 'Account menu' }).parentElement!;
    await userEvent.click(within(menu).getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/parents/login'));
    expect(loggedOut).toBe(true);
    expect(queryClient.getQueryData(parentKeys.children)).toBeUndefined();
  });

  it('opens and closes the mobile drawer and still logs out when the API fails', async () => {
    server.use(
      http.get(`${PARENTS}/auth/me`, () => HttpResponse.json({ success: true, data: { parent_data: null } })),
      http.post(`${PARENTS}/auth/logout`, () => HttpResponse.json({}, { status: 500 })),
    );
    renderWithProviders(<ParentHeader />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('navigation', { name: 'Menu' });
    expect(within(drawer).getByText('Parent')).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Close menu' }));
    expect(drawer).toHaveAttribute('aria-hidden', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/parents/login'));
  });
});
