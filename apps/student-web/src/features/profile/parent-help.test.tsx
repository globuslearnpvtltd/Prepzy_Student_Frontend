import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { testExam } from '@/test/exams';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { HelpScreen } from './components/help/help-screen';
import { searchFaqs } from './components/help/help-data';
import { contactError, toDetails } from './components/parent/parent-model';
import { ParentScreen } from './components/parent/parent-screen';
import { fail, ok } from './test-fixtures';

vi.mock('sonner', () => ({ toast: { custom: vi.fn(), dismiss: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const cbse = testExam('cbse');

type ToastRender = (id: string) => React.ReactElement;
const toastAt = (index: number) => {
  const calls = vi.mocked(toast.custom).mock.calls;
  const render = calls.at(index)?.[0] as ToastRender | undefined;
  if (!render) return { text: '', unmount: () => undefined };
  const view = renderWithProviders(render('t1'));
  return { text: view.container.textContent ?? '', view, unmount: view.unmount };
};

const MENTOR = {
  account_id: 40,
  firstName: 'Asha',
  lastName: 'Kumar',
  contactMethod: 'whatsapp',
  contactValue: '+919811111111',
};

const typeCode = async (code: string) => {
  for (const [i, d] of code.split('').entries()) await userEvent.type(screen.getByLabelText(`Digit ${i + 1}`), d);
};

/** Desktop-only controls are hidden with CSS, so both copies are in the DOM; the first is the desktop one. */
const desktopButton = (name: string) => screen.getAllByRole('button', { name })[0]!;

describe('parent model', () => {
  it('builds the contact the backend expects and explains bad numbers', () => {
    expect(
      toDetails({ firstName: ' A ', lastName: 'B', contactMethod: 'whatsapp', contactValue: '9811111111' }),
    ).toMatchObject({
      firstName: 'A',
      contactValue: '+919811111111',
    });
    expect(contactError({ firstName: '', lastName: '', contactMethod: 'whatsapp', contactValue: '98111' })).toBe(
      'Enter a 10-digit mobile number. This one has 5.',
    );
    expect(contactError({ firstName: '', lastName: '', contactMethod: 'whatsapp', contactValue: '1811111111' })).toBe(
      'Enter a valid mobile number. It starts with 6, 7, 8 or 9.',
    );
    expect(contactError({ firstName: '', lastName: '', contactMethod: 'email', contactValue: 'x@' })).toBe(
      'Enter a full email, like name@gmail.com.',
    );
  });
});

describe('Parent', () => {
  it('adds a parent: details, code on WhatsApp, then linked', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.get(`${API}/api/v4/student/mentor`, () => ok({ mentor_data: null })),
      http.post(`${API}/api/v4/student/mentor/otp`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return ok(null);
      }),
      http.post(`${API}/api/v4/student/mentor/verify`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return ok({ mentor_id: 55 });
      }),
    );
    renderWithProviders(<ParentScreen />, { exam: cbse });

    await userEvent.type(await screen.findByLabelText(/First name/), 'Asha');
    await userEvent.type(screen.getByLabelText(/Last name/), 'Kumar');
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '98111-11111');
    await userEvent.click(desktopButton('Send OTP & continue'));

    expect(
      await screen.findByText('We sent a 6-digit code on WhatsApp to +91 98111 11111. Ask them to share it with you.'),
    ).toBeInTheDocument();
    expect(bodies[0]).toEqual({
      first_name: 'Asha',
      last_name: 'Kumar',
      contact_method: 'whatsapp',
      contact_value: '+919811111111',
    });

    await typeCode('123456');
    await userEvent.click(desktopButton('Verify & link'));

    expect(
      await screen.findByText(/Asha Kumar is linked\. They can log in with \+91 98111 11111\./),
    ).toBeInTheDocument();
    expect(bodies[1]).toMatchObject({ otp: '123456', contact_value: '+919811111111' });
  });

  it('shows a wrong code and locks after five', async () => {
    server.use(
      http.get(`${API}/api/v4/student/mentor`, () => ok({ mentor_data: null })),
      http.post(`${API}/api/v4/student/mentor/otp`, () => ok(null)),
      http.post(`${API}/api/v4/student/mentor/verify`, () => fail(400, 'INVALID_OTP')),
    );
    renderWithProviders(<ParentScreen />, { exam: cbse });
    await userEvent.type(await screen.findByLabelText(/First name/), 'Asha');
    await userEvent.type(screen.getByLabelText(/Last name/), 'K');
    await userEvent.click(screen.getByRole('button', { name: 'Email' }));
    await userEvent.type(screen.getByLabelText('Email'), 'asha@x.in');
    await userEvent.click(desktopButton('Send OTP & continue'));
    await typeCode('111111');

    for (let i = 0; i < 5; i += 1) {
      await userEvent.click(desktopButton('Verify & link'));
      await screen.findAllByRole('alert');
      if (i < 4) {
        expect(screen.getByText("That code doesn't match. Check it and try again.")).toBeInTheDocument();
        await userEvent.type(screen.getByLabelText('Digit 6'), '2');
      }
    }
    expect(screen.getByText('Too many wrong tries. Ask for a new code.')).toBeInTheDocument();
    expect(desktopButton('Verify & link')).toBeDisabled();
    // A wrong code unlocks resend straight away.
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeInTheDocument();
  });

  it('renames without a code when only the name changes', async () => {
    let body: unknown = null;
    const otp = vi.fn();
    server.use(
      http.get(`${API}/api/v4/student/mentor`, () => ok({ mentor_data: MENTOR })),
      http.post(`${API}/api/v4/student/mentor/otp`, otp),
      http.put(`${API}/api/v4/student/mentor`, async ({ request }) => {
        body = await request.json();
        return ok({ mentor_data: { ...MENTOR, firstName: 'Asha Rani' } });
      }),
    );
    renderWithProviders(<ParentScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(desktopButton('Save changes')).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/First name/), ' Rani');
    await userEvent.click(desktopButton('Save changes'));

    expect(await screen.findByText('Asha Rani Kumar')).toBeInTheDocument();
    expect(body).toEqual({ first_name: 'Asha Rani', last_name: 'Kumar' });
    expect(otp).not.toHaveBeenCalled();
  });

  it('removes the parent and puts them back with Undo', async () => {
    let restoreBody: unknown = null;
    server.use(
      http.get(`${API}/api/v4/student/mentor`, () => ok({ mentor_data: MENTOR })),
      http.delete(`${API}/api/v4/student/mentor`, () => ok({ undo_token: 'undo-1' })),
      http.post(`${API}/api/v4/student/mentor/restore`, async ({ request }) => {
        restoreBody = await request.json();
        return ok({ mentor_data: MENTOR });
      }),
    );
    renderWithProviders(<ParentScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    const sheet = screen.getByRole('dialog', { name: 'Remove Asha Kumar?' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Remove' }));

    expect(await screen.findByText('Add a parent')).toBeInTheDocument();
    const removed = toastAt(-1);
    expect(removed.text).toContain('Asha Kumar removed');
    await userEvent.click(within(removed.view!.container).getByRole('button', { name: 'Undo' }));
    removed.unmount();

    await waitFor(() => expect(restoreBody).toEqual({ undo_token: 'undo-1' }));
    expect(await screen.findByText('Asha Kumar')).toBeInTheDocument();
  });

  it('cancel without a parent goes back to My Account', async () => {
    server.use(http.get(`${API}/api/v4/student/mentor`, () => ok({ mentor_data: null })));
    renderWithProviders(<ParentScreen />, { exam: cbse });
    await screen.findByText('Add a parent');
    await userEvent.click(desktopButton('Cancel'));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/cbse/profile'));
  });
});

describe('Help and support', () => {
  const requests = [
    {
      request_id: 12,
      topic: 'Login',
      description: 'OTP never came',
      status: 'in_progress',
      created_at: '2026-11-01T10:00:00.000Z',
      updated_at: null,
    },
  ];

  it('searches the bundled answers', () => {
    expect(searchFaqs('refund')[0]?.id).toBe('refund');
    expect(searchFaqs('the a')).toEqual([]);
    expect(searchFaqs('zzzz')).toEqual([]);
  });

  it('lists top questions, topics and the student’s requests', async () => {
    server.use(http.get(`${API}/api/v4/student/help/requests`, () => ok({ requests })));
    renderWithProviders(<HelpScreen />, { exam: cbse });

    expect(await screen.findByText('Top questions')).toBeInTheDocument();
    expect(screen.getByText('#SR-12 · 1 Nov 2026')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Doubts/ }));
    expect(screen.getByText('Doubts · 1 answer')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Login.*#SR-12/ }));
    expect(screen.getByText(/You: OTP never came/)).toBeInTheDocument();
  });

  it('search shows results, or a no-answers state', async () => {
    server.use(http.get(`${API}/api/v4/student/help/requests`, () => ok({ requests: [] })));
    renderWithProviders(<HelpScreen />, { exam: cbse });
    await userEvent.type(await screen.findByLabelText('Search help'), 'refund');
    expect(screen.getByText('1 result for “refund”')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Can I get a refund\?/ }));
    expect(screen.getByRole('dialog', { name: 'Can I get a refund?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await userEvent.clear(screen.getByLabelText('Search help'));
    await userEvent.type(screen.getByLabelText('Search help'), 'xylophone');
    expect(screen.getByText('No answers for “xylophone”')).toBeInTheDocument();
  });

  it('reports a problem (multipart) and adds it to Your requests', async () => {
    let fields: Record<string, string> = {};
    server.use(
      http.get(`${API}/api/v4/student/help/requests`, () => ok({ requests: [] })),
      http.post(`${API}/api/v4/student/help/requests`, async ({ request }) => {
        const form = await request.formData();
        fields = Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : 'file']));
        return HttpResponse.json(
          {
            success: true,
            data: { request_id: 31, topic: 'Login', status: 'new', created_at: '2026-11-12T10:00:00.000Z' },
          },
          { status: 201 },
        );
      }),
    );
    renderWithProviders(<HelpScreen />, { exam: cbse });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Report a problem' }))[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Report a problem' });
    const send = within(dialog).getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Login' }));
    await userEvent.type(within(dialog).getByLabelText('Tell us more'), '  OTP never came ');
    await userEvent.click(send);

    expect(await screen.findByRole('dialog', { name: 'We got it' })).toBeInTheDocument();
    expect(fields).toEqual({ topic: 'Login', description: 'OTP never came' });
    expect(screen.getAllByText('#SR-31').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('Your requests')).toBeInTheDocument();
  });

  it('offers retry and Report a problem when requests fail to load', async () => {
    server.use(http.get(`${API}/api/v4/student/help/requests`, () => fail(500, 'INTERNAL')));
    renderWithProviders(<HelpScreen />, { exam: cbse });
    expect(await screen.findByText('We couldn’t load help')).toBeInTheDocument();
    server.use(http.get(`${API}/api/v4/student/help/requests`, () => ok({ requests: [] })));
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Top questions')).toBeInTheDocument();
  });
});
