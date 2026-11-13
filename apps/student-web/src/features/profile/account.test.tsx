import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { toast } from 'sonner';
import { testExam } from '@/test/exams';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { useMediumDialog } from '@/features/language';
import { toDateInput, toHelpRequest, toParent, toProfile } from './api';
import { AccountScreen } from './components/account/account-screen';
import { DeleteAccountPage } from './components/delete/delete-page';
import { DeleteAccountDialog } from './components/delete/delete-dialog';
import { formatPhone } from './components/kit';
import { accountHandlers, accountRow, fail, ok } from './test-fixtures';

vi.mock('sonner', () => ({ toast: { custom: vi.fn(), dismiss: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const cbse = testExam('cbse');
const neet = testExam('neet');

/** The text of the last profile toast (toast.custom renders a component). */
const lastToast = () => {
  const calls = vi.mocked(toast.custom).mock.calls;
  const render = calls[calls.length - 1]?.[0] as ((id: string) => React.ReactElement) | undefined;
  if (!render) return '';
  const { container, unmount } = renderWithProviders(render('t1'));
  const text = container.textContent ?? '';
  unmount();
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

beforeEach(() => {
  navigation.searchParams = new URLSearchParams();
  setDesktop(true);
  localStorage.clear();
});

describe('mapping', () => {
  it('maps the account, parent and help rows', () => {
    expect(toProfile(accountRow)).toMatchObject({
      accountId: 7,
      firstName: 'Meera',
      dateOfBirth: '2008-02-16',
      gender: 'female',
      classId: '12',
      completion: 60,
    });
    expect(toProfile({ gender: 'x', class: null, city: 'null' })).toMatchObject({ gender: '', classId: '', city: '' });
    expect(toDateInput('nope')).toBe('');
    expect(
      toParent({ account_id: 4, firstName: 'A', lastName: 'B', contactMethod: 'email', contactValue: 'a@x.in' }),
    ).toEqual({
      id: 4,
      firstName: 'A',
      lastName: 'B',
      contactMethod: 'email',
      contactValue: 'a@x.in',
    });
    expect(toParent({ account_id: 4 })).toBeNull();
    expect(toHelpRequest({ request_id: 3, topic: 'Login', status: '', created_at: null })).toMatchObject({
      id: 3,
      status: 'new',
      createdAt: null,
    });
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
  });
});

describe('My Account', () => {
  it('shows the profile card, the board plan and the settings rows', async () => {
    server.use(
      ...accountHandlers({
        plans: [
          {
            plan_id: 5,
            exam_id: cbse.examId,
            class_id: 12,
            class_name: 'Class 12',
            stream_name: 'PCB',
            duration_months: 12,
            expiry_date: '2027-04-30',
            status: 'active',
          },
          {
            plan_id: 6,
            exam_id: cbse.examId,
            class_id: 11,
            class_name: 'Class 11',
            stream_name: '',
            duration_months: 0,
            expiry_date: null,
            status: 'active',
          },
        ],
      }),
    );
    renderWithProviders(<AccountScreen />, { exam: cbse });

    expect(await screen.findAllByText('Meera Shah')).not.toHaveLength(0);
    expect(screen.getAllByText('+91 98765 43210').length).toBeGreaterThan(0);
    expect(screen.getByText('CBSE')).toBeInTheDocument();
    expect(screen.getByText('12 Months')).toBeInTheDocument();
    expect(screen.getAllByText('12 Months plan · Class 12 (PCB) & 1+ Plans').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Valid till 30 Apr 2027').length).toBeGreaterThan(0);
    expect(screen.getByText('Add your photo and email to finish.')).toBeInTheDocument();
    // LEARNING: the course (exam · class) opens the goals with the plans; Medium opens the change-medium dialog.
    expect(screen.getByText('LEARNING')).toBeInTheDocument();
    expect(await screen.findByText('हिन्दी')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Course CBSE · Class 12 \(PCB\)/ }));
    expect(navigation.push).toHaveBeenCalledWith('/manage-plans');
    useMediumDialog.getState().hide();
    await userEvent.click(screen.getByRole('button', { name: 'Change medium' }));
    expect(useMediumDialog.getState().open).toBe(true);
    useMediumDialog.getState().hide();

    await userEvent.click(screen.getByRole('button', { name: 'Manage plans' }));
    expect(navigation.push).toHaveBeenCalledWith('/manage-plans');
    await userEvent.click(screen.getByRole('button', { name: /^Parent/ }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/profile/parent');
    await userEvent.click(screen.getByRole('button', { name: /Help and support/ }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/profile/help');
    await userEvent.click(screen.getByRole('button', { name: /Refer & Earn/ }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/refer-and-earn');
    await userEvent.click(screen.getAllByRole('button', { name: 'Edit profile' })[0]!);
    expect(navigation.push).toHaveBeenCalledWith('/cbse/profile?edit=1');
  });

  it('describes a competitive plan from its summary', async () => {
    server.use(
      ...accountHandlers({
        summary: {
          planName: 'Topper Plan',
          planType: 'topper',
          status: 'ACTIVE',
          expiryDate: '30 Jun, 2027',
          daysLeft: 200,
          isFreeForever: false,
        },
      }),
    );
    renderWithProviders(<AccountScreen />, { exam: neet });
    expect((await screen.findAllByText('Topper Plan')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Valid till 30 Jun, 2027').length).toBeGreaterThan(0);
    expect(screen.getByText('Topper')).toBeInTheDocument();
  });

  it('says when there is no plan, and offers retry and support when the account fails to load', async () => {
    server.use(
      http.get(`${API}/api/v4/student/account`, () => fail(500, 'INTERNAL')),
      ...accountHandlers(),
    );
    renderWithProviders(<AccountScreen />, { exam: cbse });
    expect(await screen.findByText('We couldn’t load your account')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Contact support' }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/profile/help');

    server.use(http.get(`${API}/api/v4/student/account`, () => ok(accountRow)));
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect((await screen.findAllByText('No active plan')).length).toBeGreaterThan(0);
  });

  it('asks before logging out', async () => {
    let loggedOut = false;
    server.use(
      ...accountHandlers(),
      http.post(`${API}/api/v4/auth/logout`, () => {
        loggedOut = true;
        return ok(null);
      }),
    );
    renderWithProviders(<AccountScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    const dialog = screen.getByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(loggedOut).toBe(true));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
  });
});

describe('Edit profile (?edit=1)', () => {
  beforeEach(() => {
    navigation.searchParams = new URLSearchParams('edit=1');
  });

  it('saves personal info: only that section, trimmed', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      ...accountHandlers(),
      http.put(`${API}/api/v4/student/account`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ ...accountRow, first_name: 'Meera', email: 'meera@x.in', completion_percentage: 70 });
      }),
    );
    renderWithProviders(<AccountScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit personal info' }));
    // The other section can't be edited at the same time.
    expect(screen.queryByRole('button', { name: 'Edit school and address' })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Email'), ' meera@x.in ');
    await userEvent.click(screen.getByRole('button', { name: 'Male' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(body).toEqual({
        first_name: 'Meera',
        last_name: 'Shah',
        email: 'meera@x.in',
        date_of_birth: '2008-02-16',
        gender: 'male',
      }),
    );
    await waitFor(() => expect(screen.getByText('meera@x.in')).toBeInTheDocument());
    expect(screen.getAllByText('70%').length).toBeGreaterThan(0);
    expect(lastToast()).toContain('Personal info saved');
  });

  it('checks names and email before saving', async () => {
    const put = vi.fn();
    server.use(...accountHandlers(), http.put(`${API}/api/v4/student/account`, put));
    renderWithProviders(<AccountScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit personal info' }));
    await userEvent.clear(screen.getByLabelText(/First name/));
    await userEvent.type(screen.getByLabelText('Email'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter your first name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a full email, like name@gmail.com.')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Edit personal info' })).toBeInTheDocument();
  });

  it('saves school and address and shows an error toast when it fails', async () => {
    let body: unknown = null;
    server.use(
      ...accountHandlers(),
      http.put(`${API}/api/v4/student/account`, async ({ request }) => {
        body = await request.json();
        return fail(500, 'INTERNAL');
      }),
    );
    renderWithProviders(<AccountScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit school and address' }));
    await userEvent.type(screen.getByLabelText('School'), 'DPS ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body).toEqual({ school: 'DPS', city: 'Pune', address: '' }));
    await waitFor(() => expect(lastToast()).toContain('Couldn’t save your changes'));
    expect(screen.getByLabelText('School')).toBeInTheDocument();
  });
});

describe('profile photo', () => {
  beforeEach(() => {
    navigation.searchParams = new URLSearchParams('edit=1');
  });

  it('removes the photo with an Undo toast', async () => {
    let removed = false;
    server.use(
      ...accountHandlers({ account: { ...accountRow, profile_picture: 'https://cdn.test/me.png' } }),
      http.delete(`${API}/api/v4/student/account/photo`, () => {
        removed = true;
        return ok({ profile_picture: null, completion_percentage: 50 });
      }),
    );
    renderWithProviders(<AccountScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Change photo' }));
    const sheet = screen.getByRole('dialog', { name: 'Profile photo' });
    await userEvent.click(within(sheet).getAllByRole('button', { name: 'Remove photo' })[0]!);
    await waitFor(() => expect(removed).toBe(true));
    await waitFor(() => expect(screen.getAllByText('50%').length).toBeGreaterThan(0));
    expect(vi.mocked(toast.custom).mock.calls.at(-1)?.[1]).toMatchObject({ duration: 6000 });
    expect(lastToast()).toContain('Undo');
  });

  it('explains why a file can’t be used, without uploading it', async () => {
    const upload = vi.fn();
    server.use(...accountHandlers(), http.put(`${API}/api/v4/student/account/photo`, upload));
    const user = userEvent.setup({ applyAccept: false });
    renderWithProviders(<AccountScreen />, { exam: cbse });
    await screen.findByRole('button', { name: 'Change photo' });
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['x'], 'me.heic', { type: 'image/heic' }));
    expect(await screen.findByText('This photo can’t be used')).toBeInTheDocument();
    expect(
      screen.getByText('me.heic is a HEIC file. Pick a JPG or PNG under 5 MB, at least 800 × 800.'),
    ).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('delete account', () => {
  const deleteHandlers = (confirm: Parameters<typeof http.post>[1]) => [
    // First match wins, so the override goes before the defaults.
    http.get(`${API}/api/v4/student/account/deletion`, () => ok({ active_paid_plans: 2, grace_days: 30 })),
    ...accountHandlers(),
    http.post(`${API}/api/v4/student/account/deletion/otp`, () => ok(null)),
    http.post(`${API}/api/v4/student/account/deletion/confirm`, confirm),
  ];

  const typeCode = async (code: string) => {
    for (const [i, d] of code.split('').entries()) await userEvent.type(screen.getByLabelText(`Digit ${i + 1}`), d);
  };

  it('desktop: info, code, then the result replaces the page', async () => {
    let body: unknown = null;
    server.use(
      ...deleteHandlers(async ({ request }) => {
        body = await request.json();
        return ok({
          request_id: 9,
          requested_on: '2026-11-12T10:00:00.000Z',
          delete_on: '2026-12-12T10:00:00.000Z',
          already_requested: false,
        });
      }),
      http.get(`${API}/api/v4/auth/me`, () =>
        ok({ account_id: 7, first_name: 'Meera', last_name: 'Shah', phone: '+919876543210' }),
      ),
    );
    renderWithProviders(<AccountScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete account' }));

    const info = await screen.findByRole('dialog', { name: 'Delete your account?' });
    expect(
      await within(info).findByText(
        'You have 2 active plans. They end when the account is deleted and are not refunded.',
      ),
    ).toBeInTheDocument();
    await userEvent.selectOptions(within(info).getByLabelText('Why are you leaving? (optional)'), 'It’s too expensive');
    await userEvent.click(within(info).getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('dialog', { name: 'Confirm it’s you' })).toBeInTheDocument();
    expect(screen.getByText('Resend code in 0:30')).toBeInTheDocument();
    await typeCode('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByText('Your account will be deleted on 12 Dec 2026')).toBeInTheDocument();
    expect(body).toEqual({ otp: '123456', reason: 'It’s too expensive' });
    expect(screen.getByText('Requested').nextSibling).toHaveTextContent('12 Nov 2026');
  });

  it('shows the code error and keeps the account on a wrong code', async () => {
    server.use(...deleteHandlers(() => fail(400, 'INVALID_OTP')));
    renderWithProviders(<DeleteAccountPage />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await typeCode('111111');
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText('That code doesn’t match. Check it and try again.')).toBeInTheDocument();
    expect(screen.queryByText(/Your account will be deleted/)).not.toBeInTheDocument();
    // Typing again clears the error.
    await userEvent.type(screen.getByLabelText('Digit 6'), '2');
    expect(screen.queryByText('That code doesn’t match. Check it and try again.')).not.toBeInTheDocument();
  });

  it('phones open the delete page; "Keep my account" goes back', async () => {
    setDesktop(false);
    server.use(...accountHandlers());
    renderWithProviders(<AccountScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/profile/request-account-delete');
  });

  it('stays on the info step when the code can’t be sent', async () => {
    server.use(
      ...accountHandlers(),
      http.post(`${API}/api/v4/student/account/deletion/otp`, () => fail(502, 'OTP_DELIVERY_FAILED')),
    );
    renderWithProviders(<DeleteAccountPage />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(lastToast()).toContain('Could not send the code'));
    expect(screen.getByRole('heading', { name: 'Delete account' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep my account' }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/profile');
  });

  it('the account-menu dialog opens from its trigger', async () => {
    server.use(...accountHandlers());
    renderWithProviders(<DeleteAccountDialog trigger={(open) => <button onClick={open}>Delete Account</button>} />, {
      exam: cbse,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    expect(await screen.findByRole('dialog', { name: 'Delete your account?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep my account' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
