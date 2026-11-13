import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { toast } from 'sonner';
import { testExam } from '@/test/exams';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { profileApi } from '../../api';
import { accountRow, fail, ok } from '../../test-fixtures';
import { FAQS, SUPPORT_EMAIL, SUPPORT_PHONE } from './help-data';
import { CallModal, EmailModal, FaqModal, ReportModal, ReportSentModal, RequestModal } from './help-modals';
import { HelpScreen } from './help-screen';

vi.mock('sonner', () => ({ toast: { custom: vi.fn(), dismiss: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const cbse = testExam('cbse');

const lastToastText = () => {
  const render = vi.mocked(toast.custom).mock.calls.at(-1)?.[0] as ((id: string) => React.ReactElement) | undefined;
  if (!render) return '';
  const view = renderWithProviders(render('t1'));
  const text = view.container.textContent ?? '';
  view.unmount();
  return text;
};

const writeText = vi.fn<(text: string) => Promise<void>>();
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  writeText.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

const request = {
  id: 12,
  topic: 'Login',
  description: 'OTP never came',
  status: 'resolved',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-03T10:00:00.000Z',
};

describe('FaqModal', () => {
  it('thanks the student for yes or no and offers Talk to us', async () => {
    const onTalk = vi.fn();
    const onClose = vi.fn();
    const faq = FAQS[0]!;
    const { unmount } = renderWithProviders(<FaqModal faq={faq} onTalk={onTalk} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(screen.getByText('Thanks for telling us.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Talk to us' }));
    expect(onTalk).toHaveBeenCalled();
    unmount();

    renderWithProviders(<FaqModal faq={faq} onTalk={onTalk} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.getByText('Sorry about that. Talk to us and we’ll help.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('CallModal and EmailModal', () => {
  it('call: shows the number and login number, copies it', async () => {
    const onClose = vi.fn();
    renderWithProviders(<CallModal loginPhone="+91 98765 43210" onClose={onClose} />);
    expect(screen.getByText(/Keep your login number/)).toHaveTextContent('+91 98765 43210');
    expect(screen.getByRole('link', { name: /Call now/ })).toHaveAttribute('href', 'tel:+917459968555');
    await userEvent.click(screen.getByRole('button', { name: 'Copy number' }));
    expect(writeText).toHaveBeenCalledWith(SUPPORT_PHONE);
    expect(lastToastText()).toContain('Number copied');
    await userEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it('call without a login number leaves it out', () => {
    renderWithProviders(<CallModal loginPhone="" onClose={vi.fn()} />);
    expect(screen.queryByText(/Keep your login number/)).not.toBeInTheDocument();
  });

  it('email: mail link carries the login number; copy failure is explained', async () => {
    renderWithProviders(<EmailModal loginPhone="+91 98765 43210" onClose={vi.fn()} />);
    const href = screen.getByRole('link', { name: /Open mail app/ }).getAttribute('href')!;
    expect(href.startsWith(`mailto:${SUPPORT_EMAIL}?subject=Help%20with%20Prepzy&body=`)).toBe(true);
    expect(decodeURIComponent(href)).toContain('My login number: +91 98765 43210');

    writeText.mockRejectedValueOnce(new Error('denied'));
    await userEvent.click(screen.getByRole('button', { name: 'Copy address' }));
    await waitFor(() => expect(lastToastText()).toContain('Couldn’t copy. Please copy it by hand.'));
  });

  it('email without a login number sends an empty body', () => {
    renderWithProviders(<EmailModal loginPhone="" onClose={vi.fn()} />);
    expect(screen.getByRole('link', { name: /Open mail app/ }).getAttribute('href')).toMatch(/&body=$/);
  });
});

describe('ReportModal', () => {
  const renderReport = (props: Partial<React.ComponentProps<typeof ReportModal>> = {}) => {
    const onSent = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(<ReportModal loginPhone="" offline={false} onSent={onSent} onClose={onClose} {...props} />);
    const dialog = screen.getByRole('dialog', { name: 'Report a problem' });
    return { onSent, onClose, dialog };
  };
  const fill = async (dialog: HTMLElement) => {
    await userEvent.click(within(dialog).getByRole('button', { name: 'Login' }));
    await userEvent.type(within(dialog).getByLabelText('Tell us more'), 'It broke');
  };
  const user = () => userEvent.setup({ applyAccept: false });

  it('adds, checks and removes a screenshot, then sends it', async () => {
    const report = vi
      .spyOn(profileApi, 'reportProblem')
      .mockResolvedValue({ ...request, status: 'new', topic: 'Login' });
    const { dialog, onSent } = renderReport({ loginPhone: '+91 98765 43210' });
    expect(within(dialog).getByText(/on WhatsApp/)).toHaveTextContent('+91 98765 43210');
    const input = within(dialog).getByLabelText('Screenshot');
    const click = vi.spyOn(input, 'click');
    await userEvent.click(within(dialog).getByRole('button', { name: /Add a screenshot/ }));
    expect(click).toHaveBeenCalled();

    await user().upload(input, new File(['x'], 'notes.pdf', { type: 'application/pdf' }));
    expect(lastToastText()).toContain('Pick an image file');
    await user().upload(input, new File([new Uint8Array(6 * 1024 * 1024)], 'huge.png', { type: 'image/png' }));
    expect(lastToastText()).toContain('Pick a screenshot under 5 MB');

    await user().upload(input, new File(['x'], 'shot.png', { type: 'image/png' }));
    expect(within(dialog).getByText('shot.png')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(within(dialog).queryByText('shot.png')).not.toBeInTheDocument();
    await user().upload(input, new File(['x'], 'shot.png', { type: 'image/png' }));

    await fill(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    expect(report.mock.calls[0]![0]).toMatchObject({ topic: 'Login', description: 'It broke' });
    expect(report.mock.calls[0]![0].image?.name).toBe('shot.png');
  });

  it('shows the backend’s message for a 4xx and a generic one otherwise', async () => {
    server.use(http.post(`${API}/api/v4/student/help/requests`, () => fail(400, 'BAD_INPUT', 'Topic is not valid')));
    const { dialog } = renderReport();
    await fill(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(lastToastText()).toContain('Topic is not valid'));

    server.use(http.post(`${API}/api/v4/student/help/requests`, () => fail(503, 'DOWN')));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(lastToastText()).toContain('Couldn’t send. Please try again.'));
  });

  it('can’t send offline; Cancel closes', async () => {
    const { dialog, onClose } = renderReport({ offline: true });
    await fill(dialog);
    expect(within(dialog).getByRole('button', { name: 'Send' })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('sent and request sheets', () => {
  it('ReportSentModal shows the number only when there is one', () => {
    const { unmount } = renderWithProviders(<ReportSentModal request={request} onClose={vi.fn()} />);
    expect(screen.getByText('#SR-12')).toBeInTheDocument();
    unmount();
    renderWithProviders(<ReportSentModal request={{ ...request, id: 0 }} onClose={vi.fn()} />);
    expect(screen.queryByText('Request')).not.toBeInTheDocument();
  });

  it('RequestModal shows status, last update and the message', async () => {
    const onClose = vi.fn();
    renderWithProviders(<RequestModal request={request} onClose={onClose} />);
    expect(screen.getByText('3 Nov 2026')).toBeInTheDocument();
    expect(screen.getByText(/You: OTP never came/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Help screen contact options', () => {
  beforeEach(() => {
    server.use(
      http.get(`${API}/api/v4/student/help/requests`, () => ok({ requests: [] })),
      http.get(`${API}/api/v4/student/account`, () => ok(accountRow)),
    );
  });

  it('opens call and email sheets from Talk to us', async () => {
    renderWithProviders(<HelpScreen />, { exam: cbse });
    await userEvent.click((await screen.findAllByRole('button', { name: /Call us/ }))[0]!);
    expect(screen.getByRole('dialog', { name: 'Call Prepzy support' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getAllByRole('button', { name: /Email us/ })[0]!);
    expect(screen.getByRole('dialog', { name: 'Email Prepzy support' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Talk to us from an answer closes it and scrolls to the contact card; search can be cleared', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderWithProviders(<HelpScreen />, { exam: cbse });
    await userEvent.type(await screen.findByLabelText('Search help'), 'xyz');
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByLabelText('Search help')).toHaveValue('');

    await userEvent.type(screen.getByLabelText('Search help'), 'refund');
    await userEvent.click(screen.getByRole('button', { name: /Can I get a refund\?/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Talk to us' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Phones clear the search so the contact card shows.
    expect(screen.getByLabelText('Search help')).toHaveValue('');
    await waitFor(() => expect(scroll).toHaveBeenCalled());
  });

  it('shows the offline banner and retries when back online', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    let loads = 0;
    server.use(
      http.get(`${API}/api/v4/student/help/requests`, () => {
        loads += 1;
        return ok({ requests: [] });
      }),
    );
    renderWithProviders(<HelpScreen />, { exam: cbse });
    expect(
      await screen.findByText('You’re offline. Top answers are saved on this device. Report a problem needs internet.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(loads).toBe(1));
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(loads).toBe(1);
    onLine.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(loads).toBe(2));
  });
});
