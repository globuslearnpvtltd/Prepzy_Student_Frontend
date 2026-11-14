import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { resetHistory, simulateHistory } from '@/test/history';
import { navigation } from '@/test/setup';
import { doubtsApiBase } from '../api';
import { useSolver } from '../store';
import { DoubtSolverScreen } from './doubt-solver-screen';
import { BOOK_PLACEHOLDER, SubjectPicker } from './subject-picker';
import { testExam } from '@/test/exams';
import { learnApiBase } from '@/shared/config/exams';

const cbse = testExam('cbse');

const plan = http.get(`${API}/api/v4/student/plans/active`, () =>
  HttpResponse.json({
    success: true,
    data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 12', stream_name: 'PCB', duration_months: 12, expiry_date: '2099-01-01', status: 'active' }] },
  }),
);
const book = (id: number, subject: string, title: string, image: string | null = null) => ({
  subject_id: id,
  subject_name: subject,
  textbooks: [{ id: id * 10 + 1, class_name: 'CLASS 12', textbook_name: title, textbook_image: image }],
});
const textbooks = (subjects: ReturnType<typeof book>[]) =>
  http.get(`${API}${learnApiBase(cbse)}/textbooks`, () => HttpResponse.json({ success: true, data: { class_id: 12, subject_courses: subjects } }));
const sixBooks = [
  book(1, 'PHYSICS', 'Physics Part 1', 'https://cdn.test/phy.png'),
  book(2, 'CHEMISTRY', 'Chemistry Part 1'),
  book(3, 'MATHEMATICS', 'Maths Part 1'),
  book(4, 'BIOLOGY', 'Biology'),
  book(5, 'ENGLISH', 'Flamingo'),
  book(6, 'ECONOMICS', 'Macroeconomics'),
];

const physicsBook = { bookId: 11, title: 'Physics Part 1', image: null, subjectId: 1, subjectName: 'PHYSICS', className: 'CLASS 12' };
const question = { problem: 'Q', display: 'Q', images: [] };

/** An existing chat: restored messages and no concept cards (so the "Ask a new question" card shows). */
const existingChat = (id: number) => [
  http.get(`${API}${doubtsApiBase(cbse)}/chats/${id}/messages`, () =>
    HttpResponse.json({ success: true, data: { conversations: [{ message_id: 1, is_student: 1, text: 'Q' }, { message_id: 2, is_student: 0, text: 'Think about forces.' }] } }),
  ),
  http.post(`${API}${doubtsApiBase(cbse)}/chats/${id}/concept-cards`, () => HttpResponse.json({ success: true, data: { concept_cards: [], sources: null } })),
];

beforeEach(() => {
  useSolver.setState({ subject: null, book: null, problem: null, chatId: null, className: null });
  navigation.searchParams = new URLSearchParams();
  navigation.pathname = '/cbse/doubt-solver';
  simulateHistory();
});
afterEach(resetHistory);

describe('DoubtSolverScreen navigation', () => {
  it('goes back to the dashboard from the subject step', async () => {
    server.use(plan, textbooks([]));
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    expect(await screen.findByText('No subjects available right now.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to dashboard' })).toHaveTextContent('Dashboard');
    await userEvent.click(screen.getByRole('button', { name: 'Back to dashboard' }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/dashboard');
  });

  it('steps back from start and ask to the step above when opened directly', async () => {
    server.use(plan);
    useSolver.getState().chooseBook(physicsBook);
    navigation.searchParams = new URLSearchParams('step=start');
    const { unmount } = renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.replace).toHaveBeenLastCalledWith('/cbse/doubt-solver');
    navigation.searchParams = new URLSearchParams('step=start');
    await userEvent.click(screen.getByRole('button', { name: 'Question Bank' }));
    expect(navigation.push).toHaveBeenLastCalledWith('/cbse/doubt-solver?step=question-bank&from=start');
    unmount();

    navigation.searchParams = new URLSearchParams('step=ask');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(navigation.replace).toHaveBeenLastCalledWith('/cbse/doubt-solver?step=start');
    expect(navigation.back).not.toHaveBeenCalled();
    // Only the textbook selection offers the dashboard.
    expect(screen.queryByRole('button', { name: 'Back to dashboard' })).not.toBeInTheDocument();
  });

  it('back buttons return to the step they were opened from', async () => {
    server.use(plan);
    useSolver.getState().chooseBook(physicsBook);
    navigation.searchParams = new URLSearchParams('step=start&from=subject');
    const { unmount } = renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.back).toHaveBeenCalledTimes(1);
    unmount();

    // "Change subject" goes back too when the subject step is right behind, instead of stacking a new one.
    navigation.searchParams = new URLSearchParams('step=start&from=subject');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.click(screen.getByRole('button', { name: 'Change subject' }));
    expect(navigation.back).toHaveBeenCalledTimes(2);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('leaves the question bank to where it was opened from, or to the start, or to change the subject', async () => {
    server.use(plan, http.get(`${API}/api/v4/learn/courses/11/outline`, () => HttpResponse.json({ success: true, data: { finalList: [] } })));
    useSolver.getState().chooseBook(physicsBook);
    navigation.searchParams = new URLSearchParams('step=question-bank&from=ask');
    const { unmount } = renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(navigation.back).toHaveBeenCalledTimes(1);
    unmount();

    // Opened directly (a shared link): no history to go back to, so the start options.
    navigation.searchParams = new URLSearchParams('step=question-bank');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(navigation.replace).toHaveBeenLastCalledWith('/cbse/doubt-solver?step=start');
    await userEvent.click(screen.getByTitle('Change subject'));
    expect(navigation.replace).toHaveBeenLastCalledWith('/cbse/doubt-solver');
  });

  it('stays on, or leaves, a problem without a subject', async () => {
    server.use(plan, ...existingChat(8));
    useSolver.setState({ problem: question, chatId: 8 });
    navigation.searchParams = new URLSearchParams('step=chat');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    expect(await screen.findByText('Think about forces.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Question Bank' })).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Go back' })[0]!);
    await userEvent.click(within(screen.getByRole('alertdialog', { name: 'Leave this problem?' })).getByRole('button', { name: 'Stay' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(useSolver.getState().problem).not.toBeNull();

    await userEvent.click(screen.getAllByRole('button', { name: 'Go back' })[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(useSolver.getState().problem).toBeNull();
    expect(navigation.replace).toHaveBeenCalledWith('/cbse/doubt-solver');
  });

  it('leaving a chat handed over by another page goes back to that page', async () => {
    server.use(plan, ...existingChat(8));
    useSolver.setState({ subject: { id: 0, title: 'PHYSICS' }, problem: question, chatId: 8 });
    navigation.searchParams = new URLSearchParams('step=chat');
    vi.stubGlobal('navigation', { canGoBack: true });
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await screen.findByText('Think about forces.');
    await userEvent.click(screen.getAllByRole('button', { name: 'Go back' })[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.replace).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('the back gesture leaves the chat, keeping it for the forward gesture', async () => {
    server.use(plan, ...existingChat(8));
    useSolver.getState().chooseBook(physicsBook);
    useSolver.setState({ problem: question, chatId: 8 });
    navigation.searchParams = new URLSearchParams('step=ask&from=start');
    const view = renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    expect(screen.getByRole('heading', { name: "What's your Physics doubt?" })).toBeInTheDocument();
    navigation.searchParams = new URLSearchParams('step=chat&from=ask');
    view.rerender(<DoubtSolverScreen />);
    expect(await screen.findByText('Think about forces.')).toBeInTheDocument();
  });

  it('asks a new question or starts a new problem from the chat', async () => {
    server.use(plan, ...existingChat(8));
    useSolver.getState().chooseBook(physicsBook);
    useSolver.setState({ problem: question, chatId: 8 });
    navigation.searchParams = new URLSearchParams('step=chat&from=ask');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Ask a new question' }))[0]!);
    expect(useSolver.getState()).toMatchObject({ problem: null, chatId: null, subject: { id: 1 } });
    // The chat came from the ask step: back there rather than stacking another one.
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('asking a new question from a chat opened elsewhere replaces the chat', async () => {
    server.use(plan, ...existingChat(8));
    useSolver.getState().chooseBook(physicsBook);
    useSolver.setState({ problem: question, chatId: 8 });
    navigation.searchParams = new URLSearchParams('step=chat&from=question-bank');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Ask a new question' }))[0]!);
    expect(navigation.replace).toHaveBeenLastCalledWith('/cbse/doubt-solver?step=ask&from=question-bank');
  });

  it('opens the bank and starts over from the chat header', async () => {
    server.use(plan, ...existingChat(8));
    useSolver.getState().chooseBook(physicsBook);
    useSolver.setState({ problem: question, chatId: 8 });
    navigation.searchParams = new URLSearchParams('step=chat&from=ask');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await screen.findByText('Think about forces.');
    await userEvent.click(screen.getByRole('button', { name: 'Question Bank' }));
    expect(navigation.push).toHaveBeenLastCalledWith('/cbse/doubt-solver?step=question-bank&from=chat');
    navigation.searchParams = new URLSearchParams('step=chat&from=ask');
    await userEvent.click(screen.getAllByRole('button', { name: 'New problem' })[0]!);
    expect(useSolver.getState()).toMatchObject({ subject: null, book: null, problem: null });
    // Everything chosen is gone: a fresh subject step (its back goes to the dashboard).
    expect(navigation.replace).toHaveBeenLastCalledWith('/cbse/doubt-solver');
  });

  it('history: retries after an error, ignores the open chat and starts a new doubt', async () => {
    let calls = 0;
    server.use(
      plan,
      ...existingChat(8),
      http.get(`${API}${doubtsApiBase(cbse)}/chats`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ message: 'down' }, { status: 500 })
          : HttpResponse.json({ success: true, data: { chats: [{ chat_id: 8, title: 'This doubt', first_message: 'Q' }] } });
      }),
    );
    useSolver.setState({ subject: { id: 1, title: 'PHYSICS' }, problem: question, chatId: 8 });
    navigation.searchParams = new URLSearchParams('step=chat');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await screen.findByText('Think about forces.');

    await userEvent.click(screen.getByRole('button', { name: 'Previous doubts' }));
    const drawer = await screen.findByRole('dialog', { name: 'Previous doubts' });
    expect(await within(drawer).findByText("Couldn't load your doubts.")).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Retry' }));
    const current = await within(drawer).findByRole('button', { name: /This doubt/ });
    expect(current).toHaveAttribute('aria-current', 'true');
    await userEvent.click(current);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(useSolver.getState().chatId).toBe(8);

    await userEvent.click(screen.getByRole('button', { name: 'Previous doubts' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Previous doubts' })).getByRole('button', { name: 'New doubt' }));
    expect(useSolver.getState().problem).toBeNull();
    expect(navigation.replace).toHaveBeenCalledWith('/cbse/doubt-solver');
  });

  it('switches to another past doubt while in a chat, keeping the subject when it has none', async () => {
    server.use(
      plan,
      ...existingChat(8),
      ...existingChat(9),
      http.get(`${API}${doubtsApiBase(cbse)}/chats`, () =>
        HttpResponse.json({ success: true, data: { chats: [{ chat_id: 9, title: 'Older', first_message: 'Find g\n\nDiagrams:\nDiagram 1: a pendulum' }] } }),
      ),
    );
    useSolver.getState().chooseBook(physicsBook);
    useSolver.setState({ problem: question, chatId: 8 });
    navigation.searchParams = new URLSearchParams('step=chat');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await screen.findByText('Think about forces.');
    await userEvent.click(screen.getByRole('button', { name: 'Previous doubts' }));
    await userEvent.click(await screen.findByRole('button', { name: /Older/ }));
    expect(useSolver.getState()).toMatchObject({ chatId: 9, subject: { id: 1 }, book: { bookId: 11 }, problem: { display: 'Find g' } });
    expect(navigation.push).not.toHaveBeenCalled();
  });
});

describe('Concept cards on phones', () => {
  it('opens a raised card in a popover under the strip, and closes it by tap or Escape', async () => {
    server.use(
      plan,
      http.get(`${API}${doubtsApiBase(cbse)}/chats/8/messages`, () =>
        HttpResponse.json({ success: true, data: { conversations: [{ message_id: 1, is_student: 1, text: 'Q' }, { message_id: 2, is_student: 0, text: 'Think.' }] } }),
      ),
      http.post(`${API}${doubtsApiBase(cbse)}/chats/8/concept-cards`, () =>
        HttpResponse.json({
          success: true,
          data: { concept_cards: [{ card_no: 1, title: 'Second law', explanation: 'F equals ma', image_url: 'https://cdn.test/d.png' }, { card_no: 2, title: 'Units', explanation: 'Newtons' }], sources: null },
        }),
      ),
    );
    useSolver.setState({ subject: { id: 1, title: 'PHYSICS' }, problem: question, chatId: 8 });
    navigation.searchParams = new URLSearchParams('step=chat');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    const strip = (await screen.findAllByRole('region', { name: 'Concept cards' }))[0]!;
    const first = await within(strip).findByRole('button', { name: 'Concept 1: Second law' });
    expect(within(strip).getByText('Tap the concept cards for help')).toBeInTheDocument();

    await userEvent.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(first.className).toContain('mt-0');
    // The header line makes room; the explanation floats under the strip, pointing at the card.
    expect(within(strip).queryByText('Tap the concept cards for help')).not.toBeInTheDocument();
    expect(within(strip).getByText('Concept 1 of 2')).toBeInTheDocument();
    expect(within(strip).getByText('F equals ma')).toBeInTheDocument();
    expect(within(strip).getByRole('img', { name: 'Diagram' })).toHaveAttribute('src', 'https://cdn.test/d.png');

    await userEvent.click(within(strip).getByRole('button', { name: 'Close concept 1' }));
    expect(within(strip).queryByText('F equals ma')).not.toBeInTheDocument();

    // A locked card unlocks and opens.
    await userEvent.click(within(strip).getByRole('button', { name: 'Concept 2 (locked)' }));
    expect(within(strip).getByText('Newtons')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(within(strip).queryByText('Newtons')).not.toBeInTheDocument();
    await userEvent.click(within(strip).getByRole('button', { name: 'Concept 2: Units' }));
    await userEvent.click(within(strip).getByRole('button', { name: 'Concept 2: Units' }));
    expect(within(strip).queryByText('Newtons')).not.toBeInTheDocument();
  });
});

describe('SubjectPicker', () => {
  const picker = (request = 0, handlers = { onNext: vi.fn(), onQuestionBank: vi.fn() }) => (
    <SubjectPicker onNext={handlers.onNext} onQuestionBank={handlers.onQuestionBank} questionBankRequest={request} />
  );

  it('opens the question bank for the selected book when asked from the header', async () => {
    server.use(plan, textbooks(sixBooks));
    const handlers = { onNext: vi.fn(), onQuestionBank: vi.fn() };
    const { rerender } = renderWithProviders(picker(0, handlers), { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Physics, Physics Part 1', pressed: false }));
    expect(screen.getByText('Class 12 PCB')).toBeInTheDocument();
    rerender(picker(1, handlers));
    expect(handlers.onQuestionBank).toHaveBeenCalledTimes(1);
    expect(useSolver.getState().book).toMatchObject({ bookId: 11 });
  });

  it('starts on the stored book, moves by arrows, side books and swipes, and falls back to a placeholder cover', async () => {
    server.use(plan, textbooks(sixBooks));
    useSolver.setState({ book: { bookId: 51, title: 'Flamingo', image: null, className: 'CLASS 12' } });
    const { container } = renderWithProviders(picker(), { exam: cbse });
    expect(await screen.findByRole('button', { name: 'English, Flamingo', pressed: false })).toBeInTheDocument();
    // the book three places away wraps out of view
    expect(screen.queryByRole('button', { name: /Chemistry Part 1/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Biology, Biology' }));
    expect(screen.getByRole('button', { name: 'Biology, Biology', pressed: false })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Previous subject' }));
    expect(screen.getByRole('button', { name: 'Mathematics, Maths Part 1', pressed: false })).toBeInTheDocument();

    const track = container.querySelector('.overflow-hidden') as HTMLElement;
    const swipe = (from: [number, number], to: [number, number]) => {
      fireEvent.touchStart(track, { touches: [{ clientX: from[0], clientY: from[1] }] });
      fireEvent.touchEnd(track, { changedTouches: [{ clientX: to[0], clientY: to[1] }] });
    };
    swipe([200, 100], [100, 100]); // left: next book
    expect(screen.getByRole('button', { name: 'Biology, Biology', pressed: false })).toBeInTheDocument();
    swipe([100, 100], [200, 100]); // right: previous book
    expect(screen.getByRole('button', { name: 'Mathematics, Maths Part 1', pressed: false })).toBeInTheDocument();
    swipe([100, 100], [120, 100]); // too short
    swipe([100, 100], [150, 300]); // mostly vertical
    fireEvent.touchEnd(track, { changedTouches: [{ clientX: 0, clientY: 0 }] }); // no start
    expect(screen.getByRole('button', { name: 'Mathematics, Maths Part 1', pressed: false })).toBeInTheDocument();

    const cover = screen.getByRole('img', { name: 'Physics Part 1' }) as HTMLImageElement;
    expect(cover.src).toBe('https://cdn.test/phy.png');
    fireEvent.error(cover);
    expect(cover.getAttribute('src')).toBe(BOOK_PLACEHOLDER);
  });

  it('says when the subjects fail to load', async () => {
    server.use(plan, http.get(`${API}${learnApiBase(cbse)}/textbooks`, () => HttpResponse.json({ message: 'down' }, { status: 500 })));
    renderWithProviders(picker(), { exam: cbse });
    expect(await screen.findByText("Couldn't load your subjects.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('uses the compact carousel on small screens and follows screen changes', async () => {
    let listener: (() => void) | null = null;
    const query = {
      matches: true,
      addEventListener: (_: string, fn: () => void) => {
        listener = fn;
      },
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => query));
    server.use(plan, textbooks(sixBooks.slice(0, 2)));
    const { unmount } = renderWithProviders(picker(), { exam: cbse });
    const side = await screen.findByRole('button', { name: 'Chemistry, Chemistry Part 1' });
    expect(side.style.transform).toContain('95px');
    query.matches = false;
    act(() => listener!());
    await waitFor(() => expect(side.style.transform).toContain('155px'));
    unmount();
    expect(query.removeEventListener).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('solver store', () => {
  it('clears the book, keeps the subject when resuming without one, and stores the chat id', () => {
    const store = useSolver.getState();
    store.chooseBook(physicsBook);
    store.clearBook();
    expect(useSolver.getState()).toMatchObject({ subject: null, book: null });

    store.chooseBook(physicsBook);
    store.solve(question, { id: 2, title: 'CHEMISTRY' }, 'CLASS 11');
    expect(useSolver.getState()).toMatchObject({ subject: { id: 2 }, className: 'CLASS 11', chatId: null });
    store.setChatId(4);
    expect(useSolver.getState().chatId).toBe(4);
    store.resume(7, question, null);
    expect(useSolver.getState()).toMatchObject({ chatId: 7, subject: { id: 2 }, book: { bookId: 11 } });
    store.resume(8, question, { id: 2, title: 'CHEMISTRY' });
    expect(useSolver.getState().book).toMatchObject({ bookId: 11 });
  });
});
