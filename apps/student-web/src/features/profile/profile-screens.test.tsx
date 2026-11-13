import { act, fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { toast } from 'sonner';
import { testExam } from '@/test/exams';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { AccountScreen } from './components/account/account-screen';
import { AccountSettings } from './components/account/account-settings';
import { ChangePasswordScreen } from './components/change-password-screen';
import { DeleteAccountDialog } from './components/delete/delete-dialog';
import { DeleteAccountPage } from './components/delete/delete-page';
import { useMediaQuery, useOffline } from './hooks';
import { accountHandlers, accountRow, fail, ok } from './test-fixtures';

vi.mock('sonner', () => ({ toast: { custom: vi.fn(), dismiss: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const cbse = testExam('cbse');

const lastToast = () => {
  const render = vi.mocked(toast.custom).mock.calls.at(-1)?.[0] as ((id: string) => React.ReactElement) | undefined;
  if (!render) return '';
  const view = renderWithProviders(render('t1'));
  const text = view.container.textContent ?? '';
  view.unmount();
  return text;
};

const setDesktop = (desktop: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: desktop,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

const typeCode = async (code: string) => {
  for (const [i, d] of code.split('').entries()) await userEvent.type(screen.getByLabelText(`Digit ${i + 1}`), d);
};

beforeEach(() => {
  navigation.searchParams = new URLSearchParams();
  setDesktop(true);
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('AccountSettings', () => {
  const handlers = () => ({
    course: 'CBSE · Class 12 (PCM)',
    medium: 'English',
    onOpenCourse: vi.fn(),
    onChangeMedium: vi.fn(),
    onManagePlans: vi.fn(),
    onOpenParent: vi.fn(),
    onOpenHelp: vi.fn(),
    onOpenRefer: vi.fn(),
    onDeleteAccount: vi.fn(),
    onLogout: vi.fn(),
  });

  it('opens Get the app from Downloads / Get the app and closes it every way', async () => {
    renderWithProviders(<AccountSettings plan={null} offline={false} loggingOut={false} {...handlers()} />);
    await userEvent.click(screen.getByRole('button', { name: /Get the Prepzy app/ }));
    const dialog = screen.getByRole('dialog', { name: 'Study offline in the Prepzy app' });
    expect(within(dialog).getByRole('link', { name: /Android/ })).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=com.prepzyai.learning',
    );
    expect(within(dialog).getByRole('link', { name: /iPhone/ })).toHaveAttribute('target', '_blank');
    // Clicks inside the dialog keep it open; the backdrop closes it.
    await userEvent.click(within(dialog).getByText('Scan with your phone'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(dialog.parentElement!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Downloads/ }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Downloads/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('routes the rows and dims plan / delete while offline', async () => {
    const h = handlers();
    const plan = { title: 'Topper Plan', subtitle: 'Ends 1 May', mobileTitle: 'Topper', mobileSubtitle: 'Ends 1 May' };
    renderWithProviders(<AccountSettings plan={plan} offline loggingOut {...h} />);
    expect(screen.getByText('Topper')).toBeInTheDocument();
    expect(screen.getByText('Topper Plan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage plans' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Logging out/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Refer & Earn/ }));
    await userEvent.click(screen.getByRole('button', { name: /Help and support/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Parent/ }));
    expect(h.onOpenRefer).toHaveBeenCalled();
    expect(h.onOpenHelp).toHaveBeenCalled();
    expect(h.onOpenParent).toHaveBeenCalled();
    // Changing the medium needs internet too.
    expect(screen.getByRole('button', { name: 'Change medium' })).toBeDisabled();
  });

  it('shows the LEARNING group: the course (→ goals) and the medium with Change', async () => {
    const h = handlers();
    renderWithProviders(<AccountSettings plan={null} offline={false} loggingOut={false} {...h} medium="हिन्दी" />);
    expect(screen.getByText('LEARNING')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Course CBSE · Class 12 \(PCM\)/ }));
    expect(h.onOpenCourse).toHaveBeenCalled();
    expect(screen.getByText('हिन्दी')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Change medium' }));
    expect(h.onChangeMedium).toHaveBeenCalled();
  });

  it('shows a dash until the medium is known', () => {
    renderWithProviders(<AccountSettings plan={null} offline={false} loggingOut={false} {...handlers()} medium={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('Change password', () => {
  it('checks the fields, saves, and shows a wrong old password', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.put(`${API}/api/v4/student/account/password`, async ({ request }) => {
        bodies.push(await request.json());
        return bodies.length === 1 ? ok(null) : fail(400, 'INVALID_PASSWORD', 'Your old password is not correct.');
      }),
    );
    renderWithProviders(<ChangePasswordScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText('Enter your old password')).toBeInTheDocument();
    expect(screen.getByText('Enter a new password')).toBeInTheDocument();
    expect(screen.getByText('Confirm your new password')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Old Password'), 'old1');
    await userEvent.type(screen.getByLabelText('New Password'), 'new1');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'new2');
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText('Password Should Be Same')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Confirm password'));
    await userEvent.type(screen.getByLabelText('Confirm password'), 'new1');
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Password Successfully Updated!'));
    expect(bodies[0]).toEqual({ old_password: 'old1', new_password: 'new1' });
    expect(screen.getByLabelText('Old Password')).toHaveValue('');

    await userEvent.type(screen.getByLabelText('Old Password'), 'bad');
    await userEvent.type(screen.getByLabelText('New Password'), 'x');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText('Your old password is not correct.')).toBeInTheDocument();
  });
});

describe('My Account offline', () => {
  it('shows the saved copy with its time, and retries once back online', async () => {
    const savedAt = new Date(2026, 10, 12, 9, 5).getTime();
    localStorage.setItem('prepzy-account-snapshot', JSON.stringify({ ...toSnapshot(), firstName: 'Saved' }));
    localStorage.setItem('prepzy-account-snapshot-at', String(savedAt));
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    let loads = 0;
    server.use(
      http.get(`${API}/api/v4/student/account`, () => {
        loads += 1;
        return fail(503, 'OFFLINE');
      }),
      ...accountHandlers(),
    );
    renderWithProviders(<AccountScreen />, { exam: cbse });
    expect(await screen.findByText(/You’re offline\. Showing your account as saved at 9:05 AM\./)).toBeInTheDocument();
    expect((await screen.findAllByText('Saved Shah')).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    const before = loads;
    onLine.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(loads).toBeGreaterThan(before));
  });

  it('a broken snapshot is ignored', async () => {
    localStorage.setItem('prepzy-account-snapshot', '{not json');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    server.use(
      http.get(`${API}/api/v4/student/account`, () => fail(503, 'OFFLINE')),
      ...accountHandlers(),
    );
    renderWithProviders(<AccountScreen />, { exam: cbse });
    expect(await screen.findByText('We couldn’t load your account')).toBeInTheDocument();
  });
});

function toSnapshot() {
  return {
    accountId: 7,
    firstName: 'Meera',
    lastName: 'Shah',
    email: '',
    phone: accountRow.phone,
    dateOfBirth: '',
    address: '',
    city: '',
    school: '',
    gender: '',
    classId: '12',
    picture: null,
    completion: 60,
    updatedAt: null,
  };
}

describe('delete account flow', () => {
  const deleteHandlers = (
    confirm: Parameters<typeof http.post>[1],
    otp: Parameters<typeof http.post>[1] = () => ok(null),
  ) => [
    http.post(`${API}/api/v4/student/account/deletion/otp`, otp),
    http.post(`${API}/api/v4/student/account/deletion/confirm`, confirm),
    ...accountHandlers(),
  ];

  it('dialog: back to info, paste a code, then the result covers the page', async () => {
    server.use(
      ...deleteHandlers(() => ok({ requested_on: '2026-11-12T10:00:00.000Z', delete_on: '2026-12-12T10:00:00.000Z' })),
    );
    renderWithProviders(<DeleteAccountDialog trigger={(open) => <button onClick={open}>Delete Account</button>} />, {
      exam: cbse,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    const info = await screen.findByRole('dialog', { name: 'Delete your account?' });
    await userEvent.click(within(info).getByRole('button', { name: 'Continue' }));
    await screen.findByRole('dialog', { name: 'Confirm it’s you' });
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await screen.findByRole('dialog', { name: 'Confirm it’s you' });

    fireEvent.paste(screen.getByLabelText('Digit 1'), { clipboardData: { getData: () => '12-34-56' } });
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText('Your account will be deleted on 12 Dec 2026')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // A full page load to log in (jsdom only logs that it can't navigate).
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
  });

  it('page: back from the code step, keys on the boxes, resend, and a server error toast', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    let otps = 0;
    server.use(
      ...deleteHandlers(
        () => fail(503, 'DOWN'),
        () => {
          otps += 1;
          return ok(null);
        },
      ),
    );
    try {
      renderWithProviders(<DeleteAccountPage />, { exam: cbse });
      await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
      await screen.findByLabelText('Digit 1');
      // Back on the code step returns to the info step.
      await userEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

      // Empty paste does nothing; backspace on an empty box moves back.
      fireEvent.paste(screen.getByLabelText('Digit 1'), { clipboardData: { getData: () => 'ab' } });
      expect(screen.getByLabelText('Digit 1')).toHaveValue('');
      await userEvent.type(screen.getByLabelText('Digit 1'), '1');
      await userEvent.type(screen.getByLabelText('Digit 2'), '{Backspace}');
      expect(screen.getByLabelText('Digit 1')).toHaveFocus();

      for (let i = 0; i < 31; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
      }
      await userEvent.click(screen.getByRole('button', { name: /Resend/ }));
      await waitFor(() => expect(otps).toBe(3));

      await typeCode('123456');
      await userEvent.type(screen.getByLabelText('Digit 6'), '{Enter}');
      await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
      await waitFor(() =>
        expect(lastToast()).toContain('Something went wrong. Your account is not deleted. Please try again.'),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('a rate limit on the code says why', async () => {
    server.use(
      ...deleteHandlers(
        () => ok(null),
        () => fail(429, 'RATE_LIMITED', 'Too many codes. Try again in an hour.'),
      ),
    );
    renderWithProviders(<DeleteAccountPage />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(lastToast()).toContain('Too many codes. Try again in an hour.'));
  });

  it('a 4xx on confirm shows the backend message', async () => {
    server.use(...deleteHandlers(() => fail(409, 'ALREADY', 'A delete request is already open.')));
    renderWithProviders(<DeleteAccountPage />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await typeCode('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    await waitFor(() => expect(lastToast()).toContain('A delete request is already open.'));
  });
});

describe('browser hooks', () => {
  it('useOffline follows online / offline events', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const { result } = renderHook(() => useOffline());
    expect(result.current).toBe(false);
    onLine.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(true);
  });

  it('useMediaQuery tracks the query and is false without matchMedia', () => {
    let listener: () => void = () => undefined;
    const list = {
      matches: false,
      addEventListener: (_: string, fn: () => void) => (listener = fn),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn(() => list) as unknown as typeof window.matchMedia;
    const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);
    list.matches = true;
    act(() => listener());
    expect(result.current).toBe(true);
    unmount();
    expect(list.removeEventListener).toHaveBeenCalled();

    // @ts-expect-error browsers without matchMedia
    window.matchMedia = undefined;
    expect(renderHook(() => useMediaQuery('(min-width: 1024px)')).result.current).toBe(false);
  });
});
