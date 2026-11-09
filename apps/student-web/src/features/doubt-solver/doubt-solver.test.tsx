import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { getExam } from '@/shared/config/exams';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import {
  buildSolvePayload,
  formatSubject,
  htmlToText,
  parseStoredImages,
  removeLatexTables,
  shortSubject,
  stripDiagrams,
  toBankQuestions,
  toBooks,
  toChapters,
  toConceptCards,
  toDoubtHistory,
  toSolverMessages,
  toTutorReply,
} from './api';
import { DoubtSolverScreen, resolveStep } from './components/doubt-solver-screen';
import { matchesSearch } from './components/question-bank';
import { bookTransform, wrapOffset } from './components/subject-picker';
import { useSolver } from './store';

const cbse = getExam('cbse')!;
const neet = getExam('neet')!;

const plan = (classId = 12) =>
  http.get(`${API}/api/v1/student/plans/active`, () =>
    HttpResponse.json({
      success: true,
      data: { plans: [{ plan_id: 1, class_id: classId, class_name: 'CLASS 12', stream_name: 'PCB', duration_months: 12, expiry_date: '2099-01-01', status: 'active' }] },
    }),
  );

const textbooks = {
  subject_courses: [
    { subject_id: 1, subject_name: 'PHYSICS', textbooks: [{ id: 11, class_name: 'CLASS 12', textbook_name: 'Physics Part 1', textbook_image: null }] },
    { subject_id: 2, subject_name: 'HINDI', textbooks: [{ id: 21, class_name: 'CLASS 12', textbook_name: 'Aroh', textbook_image: null }] },
    { subject_id: 3, subject_name: 'MATHEMATICS', textbooks: [{ id: 31, class_name: 'CLASS 12', textbook_name: 'Maths Part 1', textbook_image: null }] },
  ],
};

const physicsBook = { bookId: 11, title: 'Physics Part 1', image: null, subjectId: 1, subjectName: 'PHYSICS', className: 'CLASS 12' };

beforeEach(() => {
  useSolver.setState({ subject: null, book: null, problem: null, chatId: null, className: null });
  navigation.searchParams = new URLSearchParams();
  navigation.pathname = '/cbse/doubt-solver';
});

describe('doubt solver api', () => {
  it('lists solvable board textbooks (all for NEET) and formats subject names', () => {
    expect(toBooks(textbooks, false).map((b) => b.title)).toEqual(['Physics Part 1', 'Maths Part 1']);
    expect(toBooks(textbooks, true)).toHaveLength(3);
    expect(toBooks({}, false)).toEqual([]);
    expect(formatSubject('NEET-PHYSICS')).toBe('NEET Physics');
    expect(formatSubject('SOCIAL SCIENCE')).toBe('Social Science');
    expect(shortSubject('NEET-BIOLOGY')).toBe('Biology');
  });

  it('normalises chapters, bank questions, concept cards and tutor replies', () => {
    expect(
      toChapters({ data: { finalList: [{ category: 'module', id: 2, title: 'B', module_order: 2 }, { category: 'test', id: 9 }, { category: 'module', id: 1, title: 'A', module_order: 1 }] } }),
    ).toEqual([
      { id: 1, title: 'A', order: 1 },
      { id: 2, title: 'B', order: 2 },
    ]);
    const [end, pyq] = toBankQuestions({
      data: {
        questions: [
          { id: 1, type: 'short', question_text: '<p>Q</p>', question_level: 2, marks: '3' },
          { id: 2, type: 'mcq', question_text: '<p>R</p>', difficulty_level: 'hard', set_name: 'Set A', year: 2024, options: [{ option_text: 'x' }] },
        ],
      },
    });
    expect(end).toMatchObject({ level: 'Medium', marks: 3, label: null });
    expect(pyq).toMatchObject({ level: 'Hard', label: 'Set A · 2024', options: ['x'] });
    expect(
      toConceptCards({ concept_cards: [{ card_no: 2, title: 'B' }, { card_no: 1, title: 'A', explanation: 'e' }, { card_no: 3 }], sources: { Book: 'NCERT' } }),
    ).toMatchObject({ cards: [{ cardNo: 1 }, { cardNo: 2 }], sources: { book: 'NCERT', chapter: null } });
    expect(toConceptCards({ sources: {} }).sources).toBeNull();
    expect(toTutorReply({ llm_responses: 'Hi', chat_id: 4, is_first_query: true, current_card_no: 1 })).toMatchObject({ chatId: 4, isFirst: true, cardNo: 1 });
    expect(() => toTutorReply({ llm_responses: '' })).toThrow(/couldn't reply/);
  });

  it('restores messages and history, hiding the diagram notes the tutor got', () => {
    expect(stripDiagrams('Find x\n\nDiagrams:\nDiagram 1: a triangle')).toBe('Find x');
    expect(parseStoredImages('["a.png","b.png"]')).toEqual(['a.png', 'b.png']);
    expect(parseStoredImages('a.png')).toEqual(['a.png']);
    expect(parseStoredImages('[bad')).toEqual([]);
    expect(
      toSolverMessages({ conversations: [{ message_id: 1, is_student: 1, text: 'Q\n\nDiagrams:\nDiagram 1: d', image: '["u"]' }, { message_id: 2, is_student: 0, text: 'A' }] }),
    ).toEqual([
      { id: '1', fromStudent: true, text: 'Q', images: ['u'] },
      { id: '2', fromStudent: false, text: 'A', images: [] },
    ]);
    expect(toDoubtHistory({ data: { chats: [{ chat_id: 5, title: 'T', subject_id: 1, subject_name: 'PHYSICS', first_message: 'F' }] } })).toEqual([
      { chatId: 5, title: 'T', lastMessageAt: null, subjectId: 1, subjectName: 'PHYSICS', firstMessage: 'F' },
    ]);
  });

  it('builds what Socrates is asked from a question', () => {
    expect(htmlToText('<p>Find $x^2$ &amp; y</p><p>Next</p>')).toBe('Find $x^2$ & y\nNext');
    expect(buildSolvePayload({ html: '<p>Pick one</p>', options: ['<p>1</p>', '2'], image: 'd.png', imageDescription: 'A circle' })).toEqual({
      problem: 'Pick one\n(A) 1\n(B) 2\n\nDiagrams:\nDiagram 1: A circle',
      display: 'Pick one\n(A) 1\n(B) 2',
      images: ['d.png'],
      imagesRead: true,
    });
    expect(buildSolvePayload({ html: 'Case', subQuestions: ['a', 'b'] }).display).toBe('Case\n(1) a\n(2) b');
    expect(removeLatexTables('Before \\begin{tabular}{cc} a \\begin{tabular}{c} b \\end{tabular} \\end{tabular} after')).toBe('Before  after');
  });

  it('decides the step from the URL and the stored selection', () => {
    const none = { hasSubject: false, hasBook: false, hasProblem: false };
    expect(resolveStep('ask', none)).toBe('subject');
    expect(resolveStep('ask', { ...none, hasSubject: true })).toBe('ask');
    expect(resolveStep('start', { ...none, hasSubject: true })).toBe('start');
    expect(resolveStep('question-bank', { hasSubject: true, hasBook: true, hasProblem: true })).toBe('question-bank');
    expect(resolveStep(null, { ...none, hasProblem: true })).toBe('chat');
  });

  it('places carousel books around the centre, wrapping the list', () => {
    expect(wrapOffset(0, 4, 5)).toBe(1);
    expect(wrapOffset(3, 0, 5)).toBe(-2);
    expect(bookTransform(0, false)).toBe('translateX(calc(-50% + 0px)) rotate(0deg) scale(1)');
    expect(bookTransform(-1, true)).toBe('translateX(calc(-50% + -95px)) rotate(-4deg) scale(0.7)');
  });
});

describe('Ask Socrates flow', () => {
  it('picks a subject, then goes to the start options', async () => {
    server.use(plan(), http.get(`${API}/api/v2/get-textbooks`, ({ request }) => {
      expect(new URL(request.url).searchParams.get('class_id')).toBe('12');
      return HttpResponse.json(textbooks);
    }));
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    const next = screen.getByRole('button', { name: 'Next' });
    // Question Bank before choosing a book asks to pick one.
    await userEvent.click(screen.getByRole('button', { name: 'Question Bank' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please select a subject first');
    const center = await screen.findByRole('button', { name: 'Physics, Physics Part 1', pressed: false });
    expect(next).toBeDisabled();
    await userEvent.click(center);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(useSolver.getState().subject).toEqual({ id: 1, title: 'PHYSICS' });
    expect(navigation.push).toHaveBeenCalledWith('/cbse/doubt-solver?step=start');
    await userEvent.click(screen.getByRole('button', { name: 'Next subject' }));
    expect(screen.getByText('Maths Part 1')).toBeInTheDocument();
  });

  it('uses the NEET subject list', async () => {
    server.use(plan(20), http.get(`${API}/api/neet/doubt-solver-subjects`, () => HttpResponse.json(textbooks)));
    renderWithProviders(<DoubtSolverScreen />, { exam: neet });
    expect(await screen.findByRole('button', { name: 'Hindi, Aroh' })).toBeInTheDocument();
  });

  it('start options lead to asking or the question bank', async () => {
    server.use(plan());
    useSolver.getState().chooseBook(physicsBook);
    navigation.searchParams = new URLSearchParams('step=start');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    expect(screen.getByRole('heading', { name: 'How do you want to start?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Ask your own doubt/ }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/doubt-solver?step=ask');
    await userEvent.click(screen.getByRole('button', { name: /Solve from Question Bank/ }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/doubt-solver?step=question-bank');
    await userEvent.click(screen.getByRole('button', { name: 'Change subject' }));
    expect(navigation.replace).toHaveBeenCalledWith('/cbse/doubt-solver');
  });

  it('asks a typed question: checks it, then solves step by step with concept cards', async () => {
    let created: unknown = null;
    let tutorText: FormDataEntryValue | null = null;
    server.use(
      plan(),
      http.post(`${API}/api/chat/check-valid-subject-query`, async ({ request }) => {
        const body = (await request.json()) as { query: string };
        return HttpResponse.json({ result: body.query.includes('force') ? 'true' : 'false' });
      }),
      http.post(`${API}/api/chat/step_solver_chat/create`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json({ chat_id: 90 });
      }),
      http.post(`${API}/api/chat/step_solver_concept_card/v1`, () =>
        HttpResponse.json({ concept_cards: [{ card_no: 1, title: 'Second law', explanation: '$F=ma$' }, { card_no: 2, title: 'Units' }], sources: { Chapter: 'Laws of Motion' } }),
      ),
      http.post(`${API}/api/chat/step_solver_chat_interaction/v2`, async ({ request }) => {
        const form = await request.formData();
        tutorText = form.get('text');
        return HttpResponse.json({ chat_id: 90, llm_responses: 'What is the mass?', is_first_query: form.get('text') !== '2 kg', current_card_no: form.get('text') === '2 kg' ? 2 : 1 });
      }),
    );
    useSolver.getState().chooseBook(physicsBook);
    navigation.searchParams = new URLSearchParams('step=ask');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    expect(screen.getByRole('heading', { name: "What's your Physics doubt?" })).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'What is love{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent("This doesn't look like a valid Physics problem");

    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), 'A force of 10 N acts on 2 kg{Enter}');
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/cbse/doubt-solver?step=chat'));
    expect(useSolver.getState().problem?.display).toBe('A force of 10 N acts on 2 kg');

    // With a question in the store the screen switches to the chat.
    const conversation = await screen.findByRole('list', { name: 'Conversation' });
    expect(await within(conversation).findByText('What is the mass?')).toBeInTheDocument();
    expect(created).toEqual({ subject_id: 1, class_id: 12, exam_id: 1 });
    expect(tutorText).toBe('A force of 10 N acts on 2 kg');
    expect(useSolver.getState().chatId).toBe(90);
    const decks = await screen.findAllByRole('region', { name: 'Concept cards' });
    expect(within(decks[1]!).getByRole('button', { name: 'Concept 1: Second law' })).toBeInTheDocument();
    expect(within(decks[1]!).getByRole('button', { name: 'Concept 2 (locked)' })).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'Type your answer' }), '2 kg{Enter}');
    await waitFor(() => expect(within(decks[1]!).getByRole('button', { name: 'Concept 2: Units' })).toBeInTheDocument());
    await userEvent.click(within(decks[1]!).getByRole('button', { name: 'Hint' }));

    await userEvent.click(screen.getAllByRole('button', { name: 'Go back' })[0]!);
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Leave' }));
    expect(useSolver.getState().problem).toBeNull();
    expect(navigation.replace).toHaveBeenCalledWith('/cbse/doubt-solver?step=start');
  });

  it('reads a photo of the question (maths checker) before solving', async () => {
    let checked = '';
    server.use(
      plan(),
      http.post(`${API}/api/chat/extract-question-from-image`, () =>
        HttpResponse.json({ final_string: 'Solve $x^2=4$', diagrams: [{ description: 'A parabola', base64: 'AAA' }] }),
      ),
      http.post(`${API}/api/chat/check_valid_maths_query`, async ({ request }) => {
        checked = ((await request.json()) as { query: string }).query;
        return HttpResponse.json({ result: 'true' });
      }),
    );
    URL.createObjectURL = vi.fn(() => 'blob:q');
    URL.revokeObjectURL = vi.fn();
    useSolver.getState().chooseBook({ ...physicsBook, subjectId: 3, subjectName: 'MATHEMATICS' });
    navigation.searchParams = new URLSearchParams('step=ask');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.upload(screen.getByTestId('composer-file'), new File(['img'], 'q.png', { type: 'image/png' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(useSolver.getState().problem).not.toBeNull());
    expect(checked).toBe('Solve $x^2=4$\n\nDiagrams:\nDiagram 1: A parabola');
    expect(useSolver.getState().problem).toMatchObject({ display: 'Solve $x^2=4$', images: ['data:image/png;base64,AAA'] });
  });

  it('shows a retry card when Socrates fails, and retries', async () => {
    let calls = 0;
    server.use(
      plan(),
      http.post(`${API}/api/chat/step_solver_chat/create`, () => HttpResponse.json({ chat_id: 5 })),
      http.post(`${API}/api/chat/step_solver_concept_card/v1`, () => HttpResponse.json({ concept_cards: [] })),
      http.post(`${API}/api/chat/step_solver_chat_interaction/v2`, () => {
        calls += 1;
        return calls === 1 ? HttpResponse.json({ message: 'down' }, { status: 500 }) : HttpResponse.json({ llm_responses: 'Back now.' });
      }),
    );
    useSolver.setState({ subject: { id: 1, title: 'PHYSICS' }, problem: { problem: 'Q', display: 'Q', images: [] } });
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    expect(await screen.findByText("Couldn't reply")).toBeInTheDocument();
    expect((await screen.findAllByText("Concept cards can't be generated")).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Back now.')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Ask Atlas instead' })[0]!);
    expect(navigation.push).toHaveBeenCalledWith('/cbse/dashboard?atlas=1');
  });

  it('reopens a previous doubt from history', async () => {
    server.use(
      plan(),
      http.get(`${API}/api/chat/step_solver_chat/history`, () =>
        HttpResponse.json({ success: true, data: { chats: [{ chat_id: 33, title: 'Old doubt', subject_id: 3, subject_name: 'MATHEMATICS', first_message: 'Integrate x' }] } }),
      ),
      http.get(`${API}/api/chat/step_solver_chat/33/messages`, () =>
        HttpResponse.json({ conversations: [{ message_id: 1, is_student: 1, text: 'Integrate x' }, { message_id: 2, is_student: 0, text: 'Recall the power rule.' }] }),
      ),
      http.post(`${API}/api/chat/step_solver_concept_card/v1`, () => HttpResponse.json({ concept_cards: [{ card_no: 1, title: 'Power rule' }] })),
    );
    useSolver.getState().chooseBook(physicsBook);
    navigation.searchParams = new URLSearchParams('step=ask');
    const view = renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.click(screen.getByRole('button', { name: 'Previous doubts' }));
    await userEvent.click(await screen.findByRole('button', { name: /Old doubt/ }));
    expect(useSolver.getState()).toMatchObject({ chatId: 33, subject: { id: 3, title: 'MATHEMATICS' }, book: null });
    expect(navigation.push).toHaveBeenCalledWith('/cbse/doubt-solver?step=chat');
    view.unmount();
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    expect(await screen.findByText('Recall the power rule.')).toBeInTheDocument();
  });

  it('question bank: choose a chapter, switch tabs, search and solve a question', async () => {
    server.use(
      plan(),
      http.get(`${API}/api/v1/learn/module-outline/11`, () =>
        HttpResponse.json({ data: { finalList: [{ category: 'module', id: 401, title: 'ELECTRIC CHARGES', module_order: 1 }] } }),
      ),
      http.get(`${API}/api/v1/learn/chapter-unsolved/401`, () =>
        HttpResponse.json({ data: { questions: [{ id: 1, question_text: '<p>State Coulomb law</p>' }, { id: 2, question_text: '<p>Define $\\epsilon_0$</p>' }] } }),
      ),
      http.get(`${API}/api/v1/learn/chapter-pyqs/401`, () => HttpResponse.json({ data: { questions: [] } })),
    );
    useSolver.getState().chooseBook(physicsBook);
    navigation.searchParams = new URLSearchParams('step=question-bank');
    renderWithProviders(<DoubtSolverScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: /Electric Charges/ }));
    const list = await screen.findByRole('list', { name: 'Questions' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search questions' }), 'coulomb');
    expect(within(screen.getByRole('list', { name: 'Questions' })).getAllByRole('listitem')).toHaveLength(1);
    await userEvent.click(screen.getByRole('tab', { name: "PYQ's" }));
    expect(await screen.findByText(/No questions match/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'End of chapter' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Solve' }));
    expect(useSolver.getState().problem).toMatchObject({ display: 'State Coulomb law' });
    expect(navigation.push).toHaveBeenCalledWith('/cbse/doubt-solver?step=chat');
    expect(matchesSearch({ html: 'Find $x$', options: [], subQuestions: [] } as never, '')).toBe(true);
  });
});
