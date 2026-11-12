import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { navigation } from '@/test/setup';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { formatUpdated, toDateInput, toParent, toProfile } from './api';
import { ChangePasswordScreen } from './components/change-password-screen';
import { DeleteAccountDialog } from './components/delete-account-dialog';
import { sameContact, toParentDetails } from './components/parent-link';
import { ProfileScreen } from './components/profile-screen';
import { testExam } from '@/test/exams';

const cbse = testExam('cbse');

const accountRow = {
  account_id: 7,
  first_name: 'Meera',
  last_name: 'Shah',
  email: 'meera@example.com',
  phone: '+919876543210',
  date_of_birth: '2008-02-16T00:00:00.000Z',
  address: 'MG Road',
  city: 'Pune',
  school: 'DPS',
  gender: 'female',
  class: 12,
  profile_picture: null,
  completion_percentage: 62.4,
  updated_at: '2024-10-12T10:00:00.000Z',
};

function handlers(parent: unknown = null) {
  return [
    http.get(`${API}/api/v4/student/account`, () => HttpResponse.json({ success: true, data: accountRow })),
    http.get(`${API}/api/v4/learn/board/${cbse.examId}/classes`, () =>
      HttpResponse.json({ success: true, data: { classes: [{ class_id: 12, title: 'CLASS 12' }, { class_id: 11, title: 'CLASS 11' }] } }),
    ),
    http.get(`${API}/api/v4/student/mentor`, () =>
      HttpResponse.json({ success: true, data: { mentor_data: parent } }),
    ),
  ];
}

describe('profile normalisers', () => {
  it('maps the account row', () => {
    const profile = toProfile(accountRow);
    expect(profile).toMatchObject({
      accountId: 7,
      firstName: 'Meera',
      dateOfBirth: '2008-02-16',
      gender: 'female',
      classId: '12',
      completion: 62,
      picture: null,
    });
    expect(toProfile({ account_id: 1, gender: 'x', class: null, city: 'null' })).toMatchObject({ gender: '', classId: '', city: '' });
  });

  it('formats dates', () => {
    expect(toDateInput('2020-01-05')).toBe('2020-01-05');
    expect(toDateInput('nope')).toBe('');
    expect(toDateInput(null)).toBe('');
    expect(formatUpdated('2024-10-12T10:00:00.000Z')).toBe('12 October 2024');
    expect(formatUpdated(null)).toBe('');
    expect(formatUpdated('bad')).toBe('');
  });

  it('maps the linked parent', () => {
    expect(toParent(null)).toBeNull();
    expect(toParent({ account_id: 3 })).toBeNull();
    expect(toParent({ account_id: 3, firstName: 'Priya', lastName: 'Menon', contactMethod: 'email', contactValue: 'p@x.in' })).toEqual({
      id: 3,
      firstName: 'Priya',
      lastName: 'Menon',
      contactMethod: 'email',
      contactValue: 'p@x.in',
    });
  });

  it('builds parent contact details', () => {
    const details = toParentDetails({ firstName: ' A ', lastName: 'B', contactMethod: 'whatsapp', dialCode: '91', contact: '98765 43210' });
    expect(details.contactValue).toBe('+919876543210');
    const parent = { id: 1, firstName: 'A', lastName: 'B', contactMethod: 'whatsapp' as const, contactValue: '+91 98765 43210' };
    expect(sameContact(parent, details)).toBe(true);
    expect(sameContact(parent, { ...details, contactMethod: 'email' })).toBe(false);
    expect(sameContact(null, details)).toBe(false);
    expect(
      sameContact({ ...parent, contactMethod: 'email', contactValue: 'X@Y.in' }, { ...details, contactMethod: 'email', contactValue: 'x@y.in' }),
    ).toBe(true);
  });
});

describe('ProfileScreen', () => {
  it('shows the profile and saves edits', async () => {
    let saved: Record<string, unknown> | null = null;
    server.use(
      ...handlers(),
      http.put(`${API}/api/v4/student/account`, async ({ request }) => {
        saved = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: accountRow });
      }),
    );
    renderWithProviders(<ProfileScreen />, { exam: cbse });
    expect(await screen.findByText('Edit Profile')).toBeInTheDocument();
    expect(screen.getByText('62%')).toBeInTheDocument();
    expect(screen.getByText('12 October 2024')).toBeInTheDocument();
    const first = screen.getByLabelText(/First Name/);
    expect(first).toHaveValue('Meera');
    await screen.findByRole('option', { name: 'CLASS 11' });
    await userEvent.clear(first);
    await userEvent.type(first, 'Mira');
    await userEvent.selectOptions(screen.getByLabelText(/^Class/), '11');
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(saved).toMatchObject({ first_name: 'Mira', student_class: '11', gender: 'female' }));
  });

  it('validates required fields', async () => {
    server.use(...handlers());
    renderWithProviders(<ProfileScreen />, { exam: cbse });
    const last = await screen.findByLabelText(/Last Name/);
    await userEvent.clear(last);
    await userEvent.clear(screen.getByLabelText('Email'));
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText('Last Name is required')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
  });

  it('shows an error state', async () => {
    server.use(http.get(`${API}/api/v4/student/account`, () => HttpResponse.json({ message: 'nope' }, { status: 500 })));
    renderWithProviders(<ProfileScreen />, { exam: cbse });
    expect(await screen.findByText("We couldn't load your profile")).toBeInTheDocument();
  });

  it('links a parent with an OTP', async () => {
    let verified: Record<string, unknown> | null = null;
    server.use(
      ...handlers(),
      http.post(`${API}/api/v4/student/mentor/otp`, () => HttpResponse.json({ success: true })),
      http.post(`${API}/api/v4/student/mentor/verify`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        if (body.otp !== '123456')
          return HttpResponse.json({ success: false, code: 'INVALID_OTP', message: 'The OTP entered is incorrect. Please try again.' }, { status: 400 });
        verified = body;
        return HttpResponse.json({ success: true, data: { mentor_id: 9 } });
      }),
    );
    renderWithProviders(<ProfileScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: /Add Parent Account/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP & Continue' }));
    expect(await screen.findByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp number is required')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('First Name'), 'Priya');
    await userEvent.type(screen.getByPlaceholderText('Last Name'), 'Menon');
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP & Continue' }));
    const code = await screen.findByLabelText('Verification code');
    expect(screen.getByText('+919876543210')).toBeInTheDocument();
    await userEvent.type(code, '111111');
    await userEvent.click(screen.getByRole('button', { name: 'Verify & Create Account' }));
    expect(await screen.findByText('The OTP entered is incorrect. Please try again.')).toBeInTheDocument();
    await userEvent.clear(code);
    await userEvent.type(code, '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify & Create Account' }));
    expect(await screen.findByText('Account Created!')).toBeInTheDocument();
    expect(verified).toMatchObject({ contact_method: 'whatsapp', contact_value: '+919876543210', first_name: 'Priya' });
  });

  it('renames a linked parent without an OTP', async () => {
    let renamed: Record<string, unknown> | null = null;
    server.use(
      ...handlers({ account_id: 4, firstName: 'Priya', lastName: 'Menon', contactMethod: 'email', contactValue: 'p@x.in' }),
      http.put(`${API}/api/v4/student/mentor`, async ({ request }) => {
        renamed = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: null });
      }),
    );
    renderWithProviders(<ProfileScreen />, { exam: cbse });
    expect(await screen.findByText('Priya Menon')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const first = screen.getByPlaceholderText('First Name');
    await userEvent.clear(first);
    await userEvent.type(first, 'Priyanka');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByText('Changes Saved!')).toBeInTheDocument();
    // Only the names: the backend renames the student's own parent, never an id the client sends.
    expect(renamed).toEqual({ first_name: 'Priyanka', last_name: 'Menon' });
  });
});

describe('ChangePasswordScreen', () => {
  it('requires matching passwords, then saves', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.put(`${API}/api/v4/student/account/password`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true });
      }),
    );
    renderWithProviders(<ChangePasswordScreen />);
    await userEvent.type(screen.getByLabelText('Old Password'), 'old-one');
    await userEvent.type(screen.getByLabelText('New Password'), 'new-one');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'different');
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText('Password Should Be Same')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Confirm password'));
    await userEvent.type(screen.getByLabelText('Confirm password'), 'new-one');
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(body).toEqual({ old_password: 'old-one', new_password: 'new-one' }));
  });

  it('shows the backend error', async () => {
    server.use(
      http.put(`${API}/api/v4/student/account/password`, () => HttpResponse.json({ success: false, code: 'PASSWORD_MISMATCH', message: 'Password Not Matching' }, { status: 400 })),
    );
    renderWithProviders(<ChangePasswordScreen />);
    for (const label of ['Old Password', 'New Password', 'Confirm password']) {
      await userEvent.type(screen.getByLabelText(label), 'x');
    }
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText('Password Not Matching')).toBeInTheDocument();
  });
});

describe('DeleteAccountDialog', () => {
  it('asks for confirmation, deletes and signs out', async () => {
    let deleted = false;
    server.use(
      http.get(`${API}/api/v4/student/account`, () => HttpResponse.json({ success: true, data: accountRow })),
      http.delete(`${API}/api/v4/student/account`, () => {
        deleted = true;
        return HttpResponse.json({ success: true, message: 'Successfully deleted', data: null });
      }),
    );
    renderWithProviders(<DeleteAccountDialog trigger={(open) => <button onClick={open}>Delete Account</button>} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    expect(await screen.findByText('Delete Account?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Delete Account?')).not.toBeInTheDocument());
    expect(deleted).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
    expect(deleted).toBe(true);
  });
});
