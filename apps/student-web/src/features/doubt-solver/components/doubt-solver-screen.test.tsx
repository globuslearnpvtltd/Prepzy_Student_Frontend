import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { useSolver } from '../store';
import { DoubtSolverScreen } from './doubt-solver-screen';
import { BOOK_PLACEHOLDER, SubjectPicker } from './subject-picker';
import { testExam } from '@/test/exams';

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
const textbooks = (subjects: ReturnType<typeof book>[]) => http.get(`${API}/api/v2/get-textbooks`, () => HttpResponse.json({ subject_courses: subjects }));
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
  http.get(`${API}/api/chat/step_solver_chat/${id}/messages`, () =>
    HttpResponse.json({ conversations: [{ message_id: 1, is_student: 1, text: 'Q' }, { message_id: 2, is_student: 0, text: 'Think about forces.' }] }),
  ),
  http.post(`${API}/api/chat/step_solver_concept_card/v1`, () => HttpResponse.json({ concept_cards: [] })),
];

beforeEach(() => {
  useSolver.setState({ subject: null, book: null, problem: null, chatId: null, className: null });
  navigation.searchParams = new URLSearchParams();
});

describe('DoubtSolverScreen navigation', () => {
  it('goes back to the dashboard from the subject step', async () => {
    server.use(plan, textbooks([]));
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    expect(await screen.findByText('No subjects available right now.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/dashboard');
  });

  it('steps back from start and ask', async () => {
    server.use(plan);
    useSolver.getState().chooseBook(physicsBook);
    navigation.searchParams = new URLSearchParams('step=start');
    const { unmount } = renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.replace).toHaveBeenLastCalledWith('/cbse/doubt-solver');
    await userEvent.click(screen.getByRole('button', { name: 'Question Bank' }));
    expect(navigation.push).toHaveBeenLastCalledWith('/cbse/doubt-solver?step=question-bank');
    unmount();

    navigation.searchParams = new URLSearchParams('step=ask');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(navigation.replace).toHaveBeenLastCalledWith('/cbse/doubt-solver?step=start');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.replace).toHaveBeenCalledTimes(3);
  });

  it('leaves the question bank with the browser back, or to change the subject', async () => {
    server.use(plan, http.get(`${API}/api/v1/learn/module-outline/11`, () => HttpResponse.json({ data: { finalList: [] } })));
    useSolver.getState().chooseBook(physicsBook);
    navigation.searchParams = new URLSearchParams('step=question-bank');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(navigation.back).toHaveBeenCalled();
    await userEvent.click(screen.getByTitle('Change subject'));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/doubt-solver');
  });

  it('stays on, or leaves, a problem without a subject', async () => {
    server.use(plan, ...existingChat(8));
    useSolver.setState({ problem: question, chatId: 8 });
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

  it('asks a new question or starts a new problem from the chat', async () => {
    server.use(plan, ...existingChat(8));
    useSolver.getState().chooseBook(physicsBook);
    useSolver.setState({ problem: question, chatId: 8 });
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Ask a new question' }))[0]!);
    expect(useSolver.getState()).toMatchObject({ problem: null, chatId: null, subject: { id: 1 } });
    expect(navigation.push).toHaveBeenLastCalledWith('/cbse/doubt-solver?step=ask');
  });

  it('opens the bank and starts over from the chat header', async () => {
    server.use(plan, ...existingChat(8));
    useSolver.getState().chooseBook(physicsBook);
    useSolver.setState({ problem: question, chatId: 8 });
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await screen.findByText('Think about forces.');
    await userEvent.click(screen.getByRole('button', { name: 'Question Bank' }));
    expect(navigation.push).toHaveBeenLastCalledWith('/cbse/doubt-solver?step=question-bank');
    await userEvent.click(screen.getAllByRole('button', { name: 'New problem' })[0]!);
    expect(useSolver.getState()).toMatchObject({ subject: null, book: null, problem: null });
    expect(navigation.push).toHaveBeenLastCalledWith('/cbse/doubt-solver');
  });

  it('history: retries after an error, ignores the open chat and starts a new doubt', async () => {
    let calls = 0;
    server.use(
      plan,
      ...existingChat(8),
      http.get(`${API}/api/chat/step_solver_chat/history`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ message: 'down' }, { status: 500 })
          : HttpResponse.json({ success: true, data: { chats: [{ chat_id: 8, title: 'This doubt', first_message: 'Q' }] } });
      }),
    );
    useSolver.setState({ subject: { id: 1, title: 'PHYSICS' }, problem: question, chatId: 8 });
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
    expect(navigation.push).toHaveBeenCalledWith('/cbse/doubt-solver');
  });

  it('switches to another past doubt while in a chat, keeping the subject when it has none', async () => {
    server.use(
      plan,
      ...existingChat(8),
      ...existingChat(9),
      http.get(`${API}/api/chat/step_solver_chat/history`, () =>
        HttpResponse.json({ success: true, data: { chats: [{ chat_id: 9, title: 'Older', first_message: 'Find g\n\nDiagrams:\nDiagram 1: a pendulum' }] } }),
      ),
    );
    useSolver.getState().chooseBook(physicsBook);
    useSolver.setState({ problem: question, chatId: 8 });
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await screen.findByText('Think about forces.');
    await userEvent.click(screen.getByRole('button', { name: 'Previous doubts' }));
    await userEvent.click(await screen.findByRole('button', { name: /Older/ }));
    expect(useSolver.getState()).toMatchObject({ chatId: 9, subject: { id: 1 }, book: { bookId: 11 }, problem: { display: 'Find g' } });
    expect(navigation.push).not.toHaveBeenCalled();
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
    server.use(plan, http.get(`${API}/api/v2/get-textbooks`, () => HttpResponse.json({ message: 'down' }, { status: 500 })));
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
