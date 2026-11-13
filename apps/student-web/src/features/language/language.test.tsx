import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { authKeys, type Student } from '@/features/auth';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { EXAMS, type ExamConfig } from '@/shared/config/exams';
import { ExamProvider } from '@/shared/hooks/use-exam';
import { languageApi } from './api';
import { ChangeMediumDialog, MediumDialogHost } from './components/change-medium-dialog';
import { ExamLanguageSync } from './components/exam-language-sync';
import { effectiveLanguage, isContentQuery, languageKeys, useMediumDialog } from './hooks';
import { mediumLabel } from './names';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn(), custom: vi.fn(), dismiss: vi.fn() } }));

const LANGUAGES = [
  { id: 1, name: 'english' },
  { id: 2, name: 'hindi' },
];

const account = (language: unknown = { id: 1, name: 'english' }) =>
  http.get(`${API}/api/v4/student/account`, () =>
    HttpResponse.json({ success: true, data: { account_id: 7, first_name: 'Asha', phone: '+919876543210', language } }),
  );
const languages = (rows: unknown = LANGUAGES) =>
  http.get(`${API}/api/v4/languages`, () => HttpResponse.json({ success: true, data: rows }));

let saved: unknown[] = [];
const change = (respond: () => Response = () => HttpResponse.json({ success: true, data: { language: { id: 2, name: 'hindi' } } })) =>
  http.put(`${API}/api/v4/student/account/language`, async ({ request }) => {
    saved.push(await request.json());
    return respond();
  });

// CBSE (exam 1) has both mediums; JAC (exam 4) only Hindi.
const CBSE: ExamConfig = { ...EXAMS.cbse, examId: 1 };
const JAC: ExamConfig = { ...EXAMS.jac, examId: 4 };
const examLanguages = (examId: number, rows: unknown) =>
  http.get(`${API}/api/v4/languages/board/${examId}`, () => HttpResponse.json({ success: true, data: rows }));
const HINDI_ONLY = [{ id: 2, name: 'hindi' }];

beforeEach(() => {
  saved = [];
  vi.mocked(toast.info).mockClear();
  vi.mocked(toast.success).mockClear();
  useMediumDialog.setState({ open: false });
});

const openDialog = async (onClose = vi.fn()) => {
  const view = renderWithProviders(<ChangeMediumDialog onClose={onClose} />);
  const dialog = screen.getByRole('dialog', { name: 'Change course medium' });
  await within(dialog).findByRole('radio', { name: /English/ });
  return { ...view, dialog, onClose };
};

describe('mediumLabel', () => {
  it('names known mediums in their own script, by name (never by id)', () => {
    expect(mediumLabel('english')).toEqual({ native: 'English', english: 'English', letter: 'A' });
    expect(mediumLabel(' HINDI ')).toEqual({ native: 'हिन्दी', english: 'Hindi', letter: 'अ' });
  });

  it('shows unknown mediums capitalised, with their first letter', () => {
    expect(mediumLabel('tamil')).toEqual({ native: 'Tamil', english: 'Tamil', letter: 'T' });
  });
});

describe('isContentQuery', () => {
  it('keeps the session, the account and the language list; everything else is content', () => {
    expect(isContentQuery({ queryKey: ['auth', 'me'] })).toBe(false);
    expect(isContentQuery({ queryKey: ['profile', 'account'] })).toBe(false);
    expect(isContentQuery({ queryKey: languageKeys.all })).toBe(false);
    expect(isContentQuery({ queryKey: ['learn', 'textbooks', 1] })).toBe(true);
    expect(isContentQuery({ queryKey: ['dashboard'] })).toBe(true);
  });
});

describe('effectiveLanguage', () => {
  const english = { id: 1, name: 'english' };
  const hindi = { id: 2, name: 'hindi' };

  it("is the saved medium when the exam offers it, else the exam's first", () => {
    expect(effectiveLanguage(hindi, [english, hindi])).toEqual(hindi);
    expect(effectiveLanguage(english, [hindi])).toEqual(hindi);
  });

  it('is the saved medium while the list loads, for an exam without books, and null without an account', () => {
    expect(effectiveLanguage(english, undefined)).toEqual(english);
    expect(effectiveLanguage(english, [])).toEqual(english);
    expect(effectiveLanguage(null, [hindi])).toBeNull();
  });
});

describe('languageApi', () => {
  it('drops malformed rows from the list', async () => {
    server.use(languages([{ id: 1, name: 'english' }, { id: 'x' }, null]));
    await expect(languageApi.list()).resolves.toEqual([{ id: 1, name: 'english' }]);
  });

  it("lists an exam's mediums and sends the exam with a change", async () => {
    server.use(examLanguages(4, [...HINDI_ONLY, { id: 'x' }]), change());
    await expect(languageApi.forExam({ category: 'board', examId: 4 })).resolves.toEqual(HINDI_ONLY);
    await languageApi.change(2, 4);
    await languageApi.change(2);
    expect(saved).toEqual([{ language_id: 2, exam_id: 4 }, { language_id: 2 }]);
  });

  it('rejects a change answer without the language', async () => {
    server.use(change(() => HttpResponse.json({ success: true, data: {} })));
    await expect(languageApi.change(2)).rejects.toMatchObject({ code: 'EMPTY_RESPONSE' });
  });
});

describe('ChangeMediumDialog', () => {
  it('lists the mediums from the API and marks the current one; Switch is off until another is picked', async () => {
    server.use(account(), languages());
    const { dialog } = await openDialog();

    expect(within(dialog).getByText('Books, videos and notes will show in the medium you pick.')).toBeInTheDocument();
    const english = within(dialog).getByRole('radio', { name: 'English (current medium)' });
    await waitFor(() => expect(english).toHaveAttribute('aria-checked', 'true'));
    expect(within(english).getByText('Current medium')).toBeInTheDocument();
    const hindi = within(dialog).getByRole('radio', { name: 'हिन्दी' });
    expect(within(hindi).getByText('Hindi')).toBeInTheDocument();
    expect(within(hindi).getByText('अ')).toBeInTheDocument();
    expect(within(dialog).getByText('More mediums are on the way.')).toBeInTheDocument();
    expect(within(dialog).getByText('Your plan, progress and doubts stay the same.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Switch' })).toBeDisabled();

    await userEvent.click(hindi);
    expect(hindi).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByRole('button', { name: 'Switch to हिन्दी' })).toBeEnabled();

    // Back to the current one: nothing to switch.
    await userEvent.click(english);
    expect(within(dialog).getByRole('button', { name: 'Switch' })).toBeDisabled();
  });

  it('switches: saves, updates the cached student, refetches content (not the account) and closes with a toast', async () => {
    server.use(account(), languages(), change());
    const { dialog, onClose, queryClient } = await openDialog();
    queryClient.setQueryData(['learn', 'textbooks'], ['physics']);
    queryClient.setQueryData(['profile', 'account'], { accountId: 7 });
    await waitFor(() => expect(queryClient.getQueryData<Student>(authKeys.me)?.language).toEqual({ id: 1, name: 'english' }));

    await userEvent.click(within(dialog).getByRole('radio', { name: 'हिन्दी' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Switch to हिन्दी' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saved).toEqual([{ language_id: 2 }]);
    expect(toast.success).toHaveBeenCalledWith('Switched to हिन्दी');
    expect(queryClient.getQueryData<Student>(authKeys.me)?.language).toEqual({ id: 2, name: 'hindi' });
    expect(queryClient.getQueryState(['learn', 'textbooks'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['profile', 'account'])?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(authKeys.me)?.isInvalidated).toBe(false);
  });

  it('keeps the dialog open with the error when saving fails, and clears it on a new pick', async () => {
    server.use(
      account(),
      languages(),
      change(() => HttpResponse.json({ success: false, message: 'This language is not available', code: 'LANGUAGE_NOT_FOUND' }, { status: 404 })),
    );
    const { dialog, onClose } = await openDialog();

    await userEvent.click(within(dialog).getByRole('radio', { name: 'हिन्दी' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Switch to हिन्दी' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This language is not available');
    expect(onClose).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('radio', { name: /English/ }));
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers a retry when the mediums do not load', async () => {
    let calls = 0;
    server.use(
      account(),
      http.get(`${API}/api/v4/languages`, () => {
        calls += 1;
        return calls === 1 ? HttpResponse.json({ success: false }, { status: 500 }) : HttpResponse.json({ success: true, data: LANGUAGES });
      }),
    );
    renderWithProviders(<ChangeMediumDialog onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Change course medium' });

    await userEvent.click(await within(dialog).findByRole('button', { name: 'Try again' }));
    expect(await within(dialog).findByRole('radio', { name: 'हिन्दी' })).toBeInTheDocument();
  });

  it('closes with Cancel, Escape and the backdrop', async () => {
    server.use(account(), languages());
    const { dialog, onClose } = await openDialog();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('MediumDialogHost', () => {
  it('shows the dialog while it is open', async () => {
    server.use(account(), languages());
    renderWithProviders(<MediumDialogHost />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => useMediumDialog.getState().show());
    const dialog = await screen.findByRole('dialog', { name: 'Change course medium' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ChangeMediumDialog on an exam page', () => {
  it("lists only the exam's mediums", async () => {
    server.use(account({ id: 2, name: 'hindi' }), languages(), examLanguages(1, LANGUAGES));
    renderWithProviders(<ChangeMediumDialog onClose={vi.fn()} />, { exam: CBSE });
    const dialog = screen.getByRole('dialog', { name: 'Change course medium' });

    expect(await within(dialog).findByRole('radio', { name: 'हिन्दी (current medium)' })).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: 'English' })).toBeInTheDocument();
    expect(within(dialog).getByText('More mediums are on the way.')).toBeInTheDocument();
  });

  it('an exam with one medium: shows it as the current one, says so, nothing to switch', async () => {
    // Saved English, but JAC only has Hindi books: the dialog shows what the student actually sees.
    server.use(account(), languages(), examLanguages(4, HINDI_ONLY));
    renderWithProviders(<ChangeMediumDialog onClose={vi.fn()} />, { exam: JAC });
    const dialog = screen.getByRole('dialog', { name: 'Change course medium' });

    expect(await within(dialog).findByRole('radio', { name: 'हिन्दी (current medium)' })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getAllByRole('radio')).toHaveLength(1);
    expect(within(dialog).getByText('Only हिन्दी is available for Jharkhand Board.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Switch' })).toBeDisabled();
  });

  it('an exam without books yet offers every medium', async () => {
    server.use(account(), languages(), examLanguages(4, []));
    renderWithProviders(<ChangeMediumDialog onClose={vi.fn()} />, { exam: JAC });
    const dialog = screen.getByRole('dialog', { name: 'Change course medium' });

    expect(await within(dialog).findByRole('radio', { name: 'हिन्दी' })).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: 'English (current medium)' })).toBeInTheDocument();
  });
});

describe('ExamLanguageSync (entering or switching exams)', () => {
  function Frame({ exam }: { exam: ExamConfig }) {
    return (
      <ExamProvider value={exam}>
        <ExamLanguageSync exam={exam} />
      </ExamProvider>
    );
  }

  it("saves the exam's medium when the exam doesn't offer the student's, refetches content and says so", async () => {
    server.use(account(), examLanguages(4, HINDI_ONLY), examLanguages(1, LANGUAGES), change());
    const { queryClient, rerender } = renderWithProviders(<Frame exam={JAC} />);
    queryClient.setQueryData(['learn', 'subjects', 12], ['science']);

    await waitFor(() => expect(saved).toEqual([{ language_id: 2, exam_id: 4 }]));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Showing Jharkhand Board in हिन्दी'));
    expect(queryClient.getQueryData<Student>(authKeys.me)?.language).toEqual({ id: 2, name: 'hindi' });
    expect(queryClient.getQueryState(['learn', 'subjects', 12])?.isInvalidated).toBe(true);

    // Back to CBSE: it offers Hindi too, so Hindi stays (account.language is one value per student).
    rerender(<Frame exam={CBSE} />);
    await waitFor(() => expect(queryClient.getQueryData(languageKeys.exam(1))).toEqual(LANGUAGES));
    expect(saved).toHaveLength(1);
  });

  it('does nothing when the exam offers the saved medium, or has no books yet', async () => {
    server.use(account(), examLanguages(1, LANGUAGES), examLanguages(4, []), change());
    const { queryClient, rerender } = renderWithProviders(<Frame exam={CBSE} />);
    await waitFor(() => expect(queryClient.getQueryData(languageKeys.exam(1))).toEqual(LANGUAGES));

    rerender(<Frame exam={JAC} />);
    await waitFor(() => expect(queryClient.getQueryData(languageKeys.exam(4))).toEqual([]));
    expect(saved).toEqual([]);
  });

  it('waits for the mediums to load, and tries once when saving fails (no loop)', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      account(),
      http.get(`${API}/api/v4/languages/board/4`, async () => {
        await gate;
        return HttpResponse.json({ success: true, data: HINDI_ONLY });
      }),
      change(() => HttpResponse.json({ success: false, message: 'No', code: 'LANGUAGE_NOT_AVAILABLE' }, { status: 400 })),
    );
    const { queryClient } = renderWithProviders(<Frame exam={JAC} />);
    await waitFor(() => expect(queryClient.getQueryData(authKeys.me)).toBeDefined());
    expect(saved).toEqual([]);

    release();
    await waitFor(() => expect(saved).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(saved).toHaveLength(1);
    expect(toast.info).not.toHaveBeenCalled();
  });
});
