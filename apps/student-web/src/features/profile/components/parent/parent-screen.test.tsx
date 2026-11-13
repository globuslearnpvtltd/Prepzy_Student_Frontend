import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { toast } from 'sonner';
import { testExam } from '@/test/exams';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { fail, ok } from '../../test-fixtures';
import { ParentScreen } from './parent-screen';

vi.mock('sonner', () => ({ toast: { custom: vi.fn(), dismiss: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const cbse = testExam('cbse');

const MENTOR = {
  account_id: 40,
  firstName: 'Asha',
  lastName: 'Kumar',
  contactMethod: 'whatsapp',
  contactValue: '+919811111111',
};

const toastAt = (index = -1) => {
  const render = vi.mocked(toast.custom).mock.calls.at(index)?.[0] as ((id: string) => React.ReactElement) | undefined;
  if (!render) return null;
  return renderWithProviders(render('t1'));
};
const lastToastText = () => {
  const view = toastAt();
  const text = view?.container.textContent ?? '';
  view?.unmount();
  return text;
};

const desktopButton = (name: string) => screen.getAllByRole('button', { name })[0]!;
/** The phone header's back arrow (a button on this page). */
const mobileBack = () => screen.getByRole('button', { name: 'Back' });

const typeCode = async (code: string) => {
  for (const [i, d] of code.split('').entries()) await userEvent.type(screen.getByLabelText(`Digit ${i + 1}`), d);
};

const fillNew = async () => {
  await userEvent.type(await screen.findByLabelText(/First name/), 'Asha');
  await userEvent.type(screen.getByLabelText(/Last name/), 'Kumar');
  await userEvent.type(screen.getByLabelText('WhatsApp number'), '9811111111');
};

const noParent = () => http.get(`${API}/api/v4/student/mentor`, () => ok({ mentor_data: null }));
const withParent = () => http.get(`${API}/api/v4/student/mentor`, () => ok({ mentor_data: MENTOR }));

beforeEach(() => {
  navigation.push.mockClear();
});

describe('Parent: sending and verifying codes', () => {
  it('explains an expired code, a rate limit and an unknown failure', async () => {
    const replies = [() => fail(400, 'OTP_EXPIRED'), () => fail(500, 'INTERNAL'), () => fail(429, 'RATE_LIMITED')];
    server.use(
      noParent(),
      http.post(`${API}/api/v4/student/mentor/otp`, () => ok(null)),
      http.post(`${API}/api/v4/student/mentor/verify`, () => replies.shift()!()),
    );
    renderWithProviders(<ParentScreen />, { exam: cbse });
    await fillNew();
    await userEvent.click(desktopButton('Send OTP & continue'));
    await typeCode('123456');

    await userEvent.click(desktopButton('Verify & link'));
    expect(await screen.findByText('That code has expired. Tap Resend code to get a new one.')).toBeInTheDocument();

    // Typing clears the error.
    await userEvent.type(screen.getByLabelText('Digit 6'), '7');
    expect(screen.queryByText(/That code has expired/)).not.toBeInTheDocument();

    await userEvent.click(desktopButton('Verify & link'));
    await waitFor(() => expect(lastToastText()).toContain('Something went wrong. Please try again.'));

    await userEvent.click(desktopButton('Verify & link'));
    expect(await screen.findByText('Too many wrong tries. Ask for a new code.')).toBeInTheDocument();
    expect(desktopButton('Verify & link')).toBeDisabled();
  });

  it('resends the code (WhatsApp and email wording) and shows a send failure', async () => {
    let sends = 0;
    server.use(
      noParent(),
      http.post(`${API}/api/v4/student/mentor/otp`, () => {
        sends += 1;
        return sends === 3 ? fail(400, 'BAD_CONTACT', 'This number can’t get messages.') : ok(null);
      }),
      http.post(`${API}/api/v4/student/mentor/verify`, () => fail(400, 'INVALID_OTP')),
    );
    renderWithProviders(<ParentScreen />, { exam: cbse });
    await fillNew();
    await userEvent.click(desktopButton('Send OTP & continue'));
    await typeCode('111111');
    // A wrong code unlocks Resend straight away.
    await userEvent.click(desktopButton('Verify & link'));
    await userEvent.click(await screen.findByRole('button', { name: 'Resend code' }));
    await waitFor(() => expect(lastToastText()).toContain('New code sent on WhatsApp'));

    // Edit details goes back to the form; switching to email and resending uses the email wording.
    await userEvent.click(desktopButton('Edit details'));
    await userEvent.click(screen.getByRole('button', { name: 'Email' }));
    await userEvent.type(screen.getByLabelText('Email'), 'asha@x.in');
    await userEvent.click(desktopButton('Send OTP & continue'));
    await waitFor(() => expect(lastToastText()).toContain('This number can’t get messages.'));
    expect(screen.queryByLabelText('Digit 1')).not.toBeInTheDocument();

    await userEvent.click(desktopButton('Send OTP & continue'));
    await typeCode('111111');
    await userEvent.click(desktopButton('Verify & link'));
    await userEvent.click(await screen.findByRole('button', { name: 'Resend code' }));
    await waitFor(() => expect(lastToastText()).toContain('New code sent to email'));
  });

  it('the phone back arrow steps back: code → form → My Account', async () => {
    server.use(
      noParent(),
      http.post(`${API}/api/v4/student/mentor/otp`, () => ok(null)),
    );
    renderWithProviders(<ParentScreen />, { exam: cbse });
    await fillNew();
    await userEvent.click(desktopButton('Send OTP & continue'));
    await screen.findByLabelText('Digit 1');
    expect(screen.getByRole('heading', { name: 'Verify', level: 1 })).toBeInTheDocument();
    await userEvent.click(mobileBack());
    expect(await screen.findByLabelText(/First name/)).toHaveValue('Asha');
    await userEvent.click(mobileBack());
    expect(navigation.push).toHaveBeenCalledWith('/cbse/profile');
  });
});

describe('Parent: editing a linked parent', () => {
  it('a new number needs a code, and the name is saved after linking', async () => {
    let renamed: unknown = null;
    server.use(
      withParent(),
      http.post(`${API}/api/v4/student/mentor/otp`, () => ok(null)),
      http.post(`${API}/api/v4/student/mentor/verify`, () => ok({ mentor_id: 41 })),
      http.put(`${API}/api/v4/student/mentor`, async ({ request }) => {
        renamed = await request.json();
        return ok(null);
      }),
    );
    renderWithProviders(<ParentScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit Asha Kumar', level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText('Change their name or WhatsApp number. A new number needs a fresh code.'),
    ).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('WhatsApp number'));
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '9822222222');
    await userEvent.click(desktopButton('Save changes'));
    await typeCode('123456');
    await userEvent.click(desktopButton('Verify & link'));

    await waitFor(() => expect(renamed).toEqual({ first_name: 'Asha', last_name: 'Kumar' }));
    await waitFor(() => expect(lastToastText()).toContain('Changes saved'));
  });

  it('switching an email parent shows the email wording; Cancel and back return to the parent', async () => {
    server.use(
      http.get(`${API}/api/v4/student/mentor`, () =>
        ok({ mentor_data: { ...MENTOR, contactMethod: 'email', contactValue: 'asha@x.in' } }),
      ),
    );
    renderWithProviders(<ParentScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Change their name or email. A new email needs a fresh code.')).toBeInTheDocument();
    // Tapping the active method keeps the value.
    await userEvent.click(screen.getByRole('button', { name: 'Email' }));
    expect(screen.getByLabelText('Email')).toHaveValue('asha@x.in');
    await userEvent.click(desktopButton('Cancel'));
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(mobileBack());
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    // From the linked view the arrow leaves the page.
    await userEvent.click(mobileBack());
    expect(navigation.push).toHaveBeenCalledWith('/cbse/profile');
  });

  it('a failed rename keeps the form and says why', async () => {
    server.use(
      withParent(),
      http.put(`${API}/api/v4/student/mentor`, () => fail(500, 'INTERNAL')),
    );
    renderWithProviders(<ParentScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await userEvent.type(screen.getByLabelText(/First name/), ' Rani');
    await userEvent.click(desktopButton('Save changes'));
    await waitFor(() => expect(lastToastText()).toContain('Could not save the changes. Please try again.'));
    expect(screen.getByLabelText(/First name/)).toHaveValue('Asha Rani');
  });
});

describe('Parent: removing', () => {
  it('a failed remove keeps the parent; the sheet can be closed', async () => {
    server.use(
      withParent(),
      http.delete(`${API}/api/v4/student/mentor`, () => fail(500, 'INTERNAL')),
    );
    renderWithProviders(<ParentScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    const sheet = screen.getByRole('dialog', { name: 'Remove Asha Kumar?' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(lastToastText()).toContain('Could not remove. Please try again.'));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Asha Kumar')).toBeInTheDocument();
  });

  it('offers no Undo without a token', async () => {
    server.use(
      withParent(),
      http.delete(`${API}/api/v4/student/mentor`, () => ok({ undo_token: null })),
    );
    renderWithProviders(<ParentScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Add a parent')).toBeInTheDocument();
    const first = toastAt()!;
    expect(first.container).toHaveTextContent('Asha Kumar removed');
    expect(within(first.container).queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    first.unmount();
  });

  it('a failed Undo explains itself', async () => {
    server.use(
      withParent(),
      http.delete(`${API}/api/v4/student/mentor`, () => ok({ undo_token: 'undo-1' })),
      http.post(`${API}/api/v4/student/mentor/restore`, () => fail(410, 'UNDO_EXPIRED', 'Undo has expired.')),
    );
    renderWithProviders(<ParentScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    await screen.findByText('Add a parent');
    const removed = toastAt()!;
    await userEvent.click(within(removed.container).getByRole('button', { name: 'Undo' }));
    removed.unmount();
    await waitFor(() => expect(lastToastText()).toContain('Undo has expired.'));
  });
});
