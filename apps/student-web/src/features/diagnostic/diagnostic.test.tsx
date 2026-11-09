import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { getExam } from '@/shared/config/exams';
import { navigation } from '@/test/setup';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { attemptReducer, formatClock, formatDuration, hasAnswer, statusCounts, toBlueprint, toDiagnosticStatus, toQuestions, toResult } from './api';
import { overview, pickExtremes, thinkingReasonCopy } from './components/result-screen';
import { DiagnosticResultScreen } from './components/result-screen';
import { DiagnosticSetupScreen } from './components/setup-screen';
import { DiagnosticTestScreen } from './components/test-screen';

const cbse = getExam('cbse')!;

const activePlan = http.get(`${API}/api/v1/student/plans/active`, () =>
  HttpResponse.json({ success: true, data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 12', duration_months: 12, status: 'active' }] } }),
);

const rawQuestions = [
  { question_id: 1, question_order: 1, question_type: 'conceptual', subject_id: 1, subject_name: 'Physics', module_id: 4, question_text: '<p>What is charge?</p>', question_image: null, marks: 1, options: [{ option_index: 0, option_text: 'Mass' }, { option_index: 1, option_text: 'Property of matter' }] },
  {
    question_id: 2,
    question_order: 2,
    question_type: 'case_based',
    subject_id: 1,
    subject_name: 'Physics',
    module_id: 4,
    question_text: 'Read the case',
    marks: 2,
    options: [],
    sub_questions: [
      { sub_index: 0, sub_question_text: 'Part one', marks: 1, options: [{ option_index: 0, option_text: 'Yes' }, { option_index: 1, option_text: 'No' }] },
      { sub_index: 1, sub_question_text: 'Part two', marks: 1, options: [{ option_index: 0, option_text: 'Up' }, { option_index: 1, option_text: 'Down' }] },
    ],
    status: 'not_visited',
  },
];

const syllabus = [
  {
    subject_id: 1,
    subject_name: 'Physics',
    courses: [{ course_id: 3, course_name: 'Physics Part 1', modules: [{ module_id: 4, module_name: 'CHARGES', topic_count: 3, is_selectable: true }, { module_id: 5, module_name: 'Current', topic_count: 2, is_selectable: true }, { module_id: 6, module_name: 'Optics', topic_count: 2, is_selectable: true }] }],
  },
];

const resultRaw = {
  assessment_id: 3,
  status: 'expired',
  total_questions: 20,
  subject_strengths: [
    { subject_id: 1, name: 'Physics', pct: 80, correct: 8, questions: 10 },
    { subject_id: 2, name: 'Chemistry', pct: 40, correct: 4, questions: 10 },
  ],
  profiling_parameters: {
    overall_percentage: 60,
    academic_band: 'proficient',
    learning_pace: { band: 'careful', time_taken_seconds: 1500, total_time_seconds: 1200 },
    thinking_style: { label: 'Conceptual', leaning: 'conceptual', reason: 'clear_lead' },
  },
  ai_summary: null,
};

describe('diagnostic logic', () => {
  it('normalises backend payloads', () => {
    expect(toDiagnosticStatus({ state: 'in_progress', assessment_id: 3 })).toEqual({ state: 'in_progress', assessmentId: 3 });
    expect(toDiagnosticStatus(null).state).toBe('available');
    expect(toBlueprint({ is_valid: false, errors: ['Too few'], duration_minutes: 25 })).toMatchObject({ isValid: false, durationSeconds: 1500 });
    const qs = toQuestions(rawQuestions);
    expect(qs[0]).toMatchObject({ status: 'not_visited', selected_answer: null, sub_questions: [] });
    expect(qs[1]!.sub_questions).toHaveLength(2);
    const result = toResult({ ...resultRaw, ai_summary: { summary: ['Line'], strongest_subject: { subject_name: 'Physics', summary: 'Good' }, needs_time: null, how_you_learn: { tagline: 'T', suggestion: 'S' } } });
    expect(result).toMatchObject({ academicBand: 'proficient', pace: { band: 'careful' }, aiSummary: { strongest: { name: 'Physics' }, needsTime: null } });
  });

  it('tracks answers and statuses', () => {
    let qs = toQuestions(rawQuestions);
    qs = attemptReducer(qs, { type: 'select', questionId: 1, optionIndex: 1 });
    expect(qs[0]).toMatchObject({ status: 'answered', selected_answer: { option_index: 1 } });
    qs = attemptReducer(qs, { type: 'select', questionId: 2, optionIndex: 1 });
    expect(qs[1]!.selected_answer).toBeNull();
    qs = attemptReducer(qs, { type: 'select-sub', questionId: 2, subIndex: 1, optionIndex: 0 });
    expect(qs[1]!.status).toBe('not_visited');
    qs = attemptReducer(qs, { type: 'select-sub', questionId: 2, subIndex: 0, optionIndex: 1 });
    expect(qs[1]).toMatchObject({ status: 'answered', selected_answer: [{ sub_index: 0, option_index: 1 }, { sub_index: 1, option_index: 0 }] });
    qs = attemptReducer(qs, { type: 'select-sub', questionId: 2, subIndex: 0, optionIndex: 0 });
    qs = attemptReducer(qs, { type: 'select-sub', questionId: 2, subIndex: 0, optionIndex: 0 });
    expect(hasAnswer(qs[1]!)).toBe(false);
    qs = attemptReducer(qs, { type: 'select-sub', questionId: 1, subIndex: 0, optionIndex: 0 });
    qs = attemptReducer(qs, { type: 'leave', questionId: 2 });
    expect(qs[1]!.status).toBe('skipped');
    qs = attemptReducer(qs, { type: 'toggle-review', questionId: 2 });
    expect(qs[1]!.status).toBe('marked_for_review');
    qs = attemptReducer(qs, { type: 'leave', questionId: 2 });
    expect(qs[1]!.status).toBe('marked_for_review');
    qs = attemptReducer(qs, { type: 'toggle-review', questionId: 1 });
    qs = attemptReducer(qs, { type: 'toggle-review', questionId: 1 });
    expect(qs[0]!.status).toBe('answered');
    expect(statusCounts([...qs, toQuestions([{ question_id: 9, status: 'skipped' }])[0]!])).toEqual({ answered: 1, notAnswered: 1, marked: 1, notVisited: 0 });
    expect(formatDuration(1500)).toBe('25 Mins');
    expect(formatDuration(60)).toBe('1 Min');
    expect(formatDuration(750)).toBe('12:30 Mins');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(-3)).toBe('00:00');
  });

  it('builds the report overview', () => {
    const result = toResult(resultRaw);
    const { lines, cards } = overview(result);
    expect(lines[0]).toContain('Physics is clearly your strength');
    expect(cards.map((c) => c.label)).toEqual(['Strongest subject', 'Needs time', 'How you learn']);
    expect(pickExtremes([{ id: 1, name: 'A', pct: 0, correct: 0, questions: 1 }])).toMatchObject({ strongest: null });
    expect(pickExtremes([{ id: 1, name: 'A', pct: 10, correct: 0, questions: 1 }]).weakest).toBeNull();
    expect(thinkingReasonCopy('insufficient_coverage')).toContain("didn't cover");
    expect(thinkingReasonCopy(null)).toContain('evenly');
    const zero = toResult({ ...resultRaw, subject_strengths: [{ subject_id: 1, name: 'Bio', pct: 0 }], ai_summary: { summary: [], strongest_subject: { subject_name: 'Bio', summary: 'x' } } });
    expect(overview(zero).cards).toEqual([expect.objectContaining({ label: 'Needs time', title: 'Bio' })]);
  });
});

describe('DiagnosticSetupScreen', () => {
  it('selects chapters, reviews the blueprint and starts the test', async () => {
    let started: unknown = null;
    server.use(
      activePlan,
      http.get(`${API}/api/v1/diagnostic/status/12`, () => HttpResponse.json({ success: true, data: { state: 'available' } })),
      http.get(`${API}/api/v1/diagnostic/subject-chapter-list/12`, () =>
        HttpResponse.json({ success: true, data: { subject_chapter_list: syllabus, rules: { min_chapters_total: 2, max_chapters_per_subject: 2 } } }),
      ),
      http.post(`${API}/api/v1/diagnostic/blueprint-preview`, () =>
        HttpResponse.json({ success: true, data: { is_valid: true, subject_count: 1, chapter_count: 2, total_questions: 10, duration_seconds: 900 } }),
      ),
      http.post(`${API}/api/v1/diagnostic/start-test`, async ({ request }) => {
        started = await request.json();
        return HttpResponse.json({ success: true, data: { assessment_id: 77 } });
      }),
    );
    renderWithProviders(<DiagnosticSetupScreen />, { exam: cbse });
    expect((await screen.findAllByText('Which chapters have you studied?')).length).toBeGreaterThan(0);
    const desktop = screen.getByRole('heading', { name: 'Select a subject' }).closest('aside')!.parentElement!;
    await userEvent.click(within(desktop).getByRole('button', { name: /Charges/ }));
    expect(screen.getByText('Select 1 more to continue')).toBeInTheDocument();
    await userEvent.click(within(desktop).getByRole('button', { name: /Current/ }));
    expect(within(desktop).getByRole('button', { name: /Optics/ })).toBeDisabled();
    expect(within(desktop).getByText('Maximum chapter limit reached')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('15 Mins')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Current' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start Test' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/cbse/diagnostic-test/77'));
    expect(started).toEqual({ class_id: 12, module_ids: [4] });
  });

  it('resumes a running test', async () => {
    server.use(
      activePlan,
      http.get(`${API}/api/v1/diagnostic/status/12`, () => HttpResponse.json({ success: true, data: { state: 'in_progress', assessment_id: 5 } })),
      http.get(`${API}/api/v1/diagnostic/subject-chapter-list/12`, () => HttpResponse.json({ success: true, data: { subject_chapter_list: syllabus } })),
    );
    renderWithProviders(<DiagnosticSetupScreen />, { exam: cbse });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/cbse/diagnostic-test/5'));
  });

  it('shows an error state', async () => {
    server.use(activePlan, http.get(`${API}/api/v1/diagnostic/status/12`, () => HttpResponse.json({ message: 'Server down' }, { status: 400 })), http.get(`${API}/api/v1/diagnostic/subject-chapter-list/12`, () => HttpResponse.json({ success: true, data: {} })));
    renderWithProviders(<DiagnosticSetupScreen />, { exam: cbse });
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });
});

describe('DiagnosticTestScreen', () => {
  it('answers, saves, marks for review and submits', async () => {
    const saves: unknown[] = [];
    let submitted: { questions: { status: string }[] } | null = null;
    server.use(
      http.get(`${API}/api/v1/diagnostic/fetch-questions/7`, () => HttpResponse.json({ success: true, data: { questions: rawQuestions, time_left: 600 } })),
      http.put(`${API}/api/v1/diagnostic/update-questions/7`, async ({ request }) => {
        saves.push(await request.json());
        return HttpResponse.json({ success: true });
      }),
      http.post(`${API}/api/v1/diagnostic/submit`, async ({ request }) => {
        submitted = (await request.json()) as typeof submitted;
        return HttpResponse.json({ success: true });
      }),
    );
    renderWithProviders(<DiagnosticTestScreen assessmentId="7" />, { exam: cbse });
    expect(await screen.findByText('What is charge?')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('10:00');
    await userEvent.click(screen.getByRole('radio', { name: /Property of matter/ }));
    expect(screen.getByRole('radio', { name: /Property of matter/ })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('button', { name: /Save & Next/ }));
    expect(await screen.findByText('Read the case')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Part 1' })).getByRole('radio', { name: /Yes/ }));
    await userEvent.click(screen.getByRole('button', { name: /Mark for review/ }));
    expect(screen.getByRole('button', { name: /Unmark review/ })).toBeInTheDocument();
    await waitFor(() => expect(saves.length).toBeGreaterThan(0), { timeout: 3500 });
    await userEvent.click(screen.getAllByRole('button', { name: 'Submit Test' }).at(-1)!);
    expect(await screen.findByRole('dialog', { name: 'Evaluating your test' })).toBeInTheDocument();
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/cbse/diagnostic-result?assessment_id=7'), { timeout: 4000 });
    expect(submitted!.questions.map((q) => q.status)).toEqual(['answered', 'marked_for_review']);
  });

  it('goes to the report when the test is already over', async () => {
    server.use(http.get(`${API}/api/v1/diagnostic/fetch-questions/8`, () => HttpResponse.json({ message: 'Already submitted' }, { status: 400 })));
    renderWithProviders(<DiagnosticTestScreen assessmentId="8" />, { exam: cbse });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/cbse/diagnostic-result'));
  });

  it('auto-submits when time runs out', async () => {
    let submitted = false;
    server.use(
      http.get(`${API}/api/v1/diagnostic/fetch-questions/9`, () => HttpResponse.json({ success: true, data: { questions: rawQuestions, time_left: 1 } })),
      http.post(`${API}/api/v1/diagnostic/submit`, () => {
        submitted = true;
        return HttpResponse.json({ success: true });
      }),
    );
    renderWithProviders(<DiagnosticTestScreen assessmentId="9" />, { exam: cbse });
    await screen.findByText('What is charge?');
    await waitFor(() => expect(submitted).toBe(true), { timeout: 3000 });
    await act(async () => undefined);
  });
});

describe('DiagnosticResultScreen', () => {
  it('shows the learning profile and the plan CTA', async () => {
    navigation.searchParams = new URLSearchParams('assessment_id=3');
    server.use(
      activePlan,
      http.get(`${API}/api/v1/diagnostic/diagnostic-results/12`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('assessment_id')).toBe('3');
        return HttpResponse.json({ success: true, data: resultRaw });
      }),
      http.get(`${API}/api/v1/study-plan/status/12`, () => HttpResponse.json({ success: true, data: { can_create: true } })),
    );
    renderWithProviders(<DiagnosticResultScreen />, { exam: cbse });
    expect(await screen.findByText('Here is what I found')).toBeInTheDocument();
    expect(screen.getByText(/auto-submitted/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Build My Study Plan/ })).toHaveAttribute('href', '/cbse/study-plan/chapters');
    await userEvent.click(screen.getByRole('tab', { name: 'Subjects' }));
    expect(screen.getByText('Needs focus')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'How You Learn' }));
    expect(screen.getByText('25 min of 20 min')).toBeInTheDocument();
    navigation.searchParams = new URLSearchParams();
  });

  it('shows the empty state', async () => {
    server.use(
      activePlan,
      http.get(`${API}/api/v1/diagnostic/diagnostic-results/12`, () => HttpResponse.json({ success: true, data: null })),
      http.get(`${API}/api/v1/study-plan/status/12`, () => HttpResponse.json({ success: true, data: {} })),
    );
    renderWithProviders(<DiagnosticResultScreen />, { exam: cbse });
    expect(await screen.findByRole('link', { name: 'Take the diagnostic test' })).toHaveAttribute('href', '/cbse/diagnostic');
  });
});
