import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { testExam } from '@/test/exams';
import { improvementOf } from './components/course-assessment-screen';
import { CourseAssessmentScreen, LearnScreen } from './ui';
import type { CourseAttempt } from './api';

const cbse = testExam('cbse');
const ok = (data: unknown) => HttpResponse.json({ success: true, data });
const overviewUrl = (id: number) => `${API}/api/v4/assessments/board/1/course-assessments/${id}`;

const outline = http.get(`${API}/api/v4/learn/courses/5/outline`, () =>
  ok({
    finalList: [
      { category: 'module', id: 2, title: 'light reflection', module_order: 1 },
      { category: 'module', id: 3, title: 'the human eye', module_order: 2 },
    ],
    courseDetail: { course_id: 5, course_name: 'Science Part 1', class_name: 'CLASS 10', subject_name: 'SCIENCE', class_id: 12 },
  }),
);

const attempt = (id: number, n: number, obtained: number, total = 10, date = `2026-11-${10 + n}T10:00:00.000Z`) => ({
  attempt_id: id,
  attempt_number: n,
  attempt_date: date,
  total_questions: 5,
  total_marks: total,
  total_marks_obtained: obtained,
});

const assessment = (type: string, extra: Record<string, unknown> = {}) => ({
  assessment_id: 40,
  assessment_type: type,
  title: 'mirror formula',
  instructions: 'Read every question carefully.',
  course_id: 5,
  course_name: 'Science Part 1',
  subject_name: 'SCIENCE',
  module_id: 2,
  lecture_id: 8,
  ...extra,
});

const set = (id: number, n: number, extra: Record<string, unknown> = {}) => ({
  set_id: id,
  set_number: String(n),
  duration: '3 Hours',
  time_limit_minutes: 180,
  total_questions: 7,
  question_sections: 3,
  sections: [
    { question_type: 'mcq', marks_per_question: 1, questions_count: 4 },
    { question_type: 'short_answer', marks_per_question: 3, questions_count: 2 },
    { question_type: 'long_answer', marks_per_question: 5, questions_count: 1 },
  ],
  in_progress: false,
  attempt_count: 0,
  last_attempt: null,
  attempts: [],
  ...extra,
});

beforeEach(() => {
  navigation.searchParams = new URLSearchParams();
});

describe('Course assessment page: mid-term / final', () => {
  it('lists the sets and starts, resumes or reviews the chosen set', async () => {
    server.use(
      outline,
      http.get(overviewUrl(90), () =>
        ok({
          assessment: assessment('final_exam', { assessment_id: 90, module_id: null, lecture_id: null }),
          test_type: 'final',
          previous: { order: 7, category: 'assessment', id: 41, module: 3, type: 'mid_term_exam' },
          next: null,
          sets: [
            set(11, 1, { attempts: [attempt(201, 2, 18, 20), attempt(200, 1, 9, 20)], attempt_count: 2 }),
            set(12, 2, { in_progress: true, duration: null, sections: [] }),
          ],
        }),
      ),
    );
    renderWithProviders(<CourseAssessmentScreen courseId="5" assessmentId="90" />, { exam: cbse });

    expect(await screen.findByRole('heading', { name: 'Science', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText('Final Exam').length).toBeGreaterThan(0);
    expect(screen.getByText(/Question Paper contains 7 Questions/)).toHaveTextContent('comprises 3 Sections');
    const details = screen.getByRole('region', { name: 'Exam Details' });
    expect(within(details).getByText('3 Hours')).toBeInTheDocument();
    expect(within(details).getByText('Unlimited')).toBeInTheDocument();
    expect(within(details).getByText('12 Nov 2026')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Your Marks' })).getByText('18', { exact: false })).toHaveTextContent('18/20');
    expect(screen.getByRole('link', { name: /Start Again/ })).toHaveAttribute('href', '/cbse/tests/final/11');

    // two sections per page, with arrows
    expect(screen.getByRole('region', { name: 'Section 1' })).toHaveTextContent('mcq');
    expect(screen.getByRole('region', { name: 'Section 2' })).toHaveTextContent('3 Mark');
    expect(screen.queryByRole('region', { name: 'Section 3' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous sections' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next sections' }));
    expect(screen.getByRole('region', { name: 'Section 3' })).toHaveTextContent('long_answer');
    expect(screen.getByRole('button', { name: 'Next sections' })).toBeDisabled();

    // the set's submissions open their result pages
    await userEvent.click(screen.getByRole('button', { name: /View Submissions/ }));
    const drawer = await screen.findByRole('dialog', { name: 'Your attempts' });
    expect(within(drawer).getByText('Set 1 · 2 attempts')).toBeInTheDocument();
    expect(within(drawer).getByText('90%')).toBeInTheDocument();
    const reviews = within(drawer).getAllByRole('link', { name: 'Review attempt' });
    expect(reviews.map((link) => link.getAttribute('href'))).toEqual(['/cbse/tests/final/result/201', '/cbse/tests/final/result/200']);
    await userEvent.click(within(drawer).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // set 2 has an open session and no time of its own
    await userEvent.click(screen.getByRole('tab', { name: 'Set 2' }));
    expect(screen.getByRole('tab', { name: 'Set 2' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: /Resume/ })).toHaveAttribute('href', '/cbse/tests/final/12');
    expect(within(screen.getByRole('region', { name: 'Exam Details' })).getByText('180 mins')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your Marks' })).toHaveTextContent('--/--');

    // course-level crumbs; Previous goes to the step before, Next is off at the end of the course
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('href', '/cbse/learn');
    expect(screen.getByRole('link', { name: /Back/ })).toHaveAttribute('href', '/cbse/learn/5');
    expect(screen.getAllByRole('button', { name: /^Next$/ })[0]).toBeDisabled();
    await userEvent.click(screen.getAllByRole('button', { name: /^Previous$/ })[0]!);
    expect(navigation.push).toHaveBeenCalledWith('/cbse/learn/5/assessments/mid_term_exam/41');
  });

  it('offers a first start, and says when the paper has no sets yet', async () => {
    server.use(
      outline,
      http.get(overviewUrl(41), () =>
        ok({ assessment: assessment('mid_term_exam', { assessment_id: 41 }), test_type: 'mid', previous: null, next: null, sets: [set(5, 1)] }),
      ),
      http.get(overviewUrl(42), () =>
        ok({ assessment: assessment('mid_term_exam', { assessment_id: 42 }), test_type: 'mid', previous: null, next: null, sets: [] }),
      ),
    );
    const { unmount } = renderWithProviders(<CourseAssessmentScreen courseId="5" assessmentId="41" />, { exam: cbse });
    expect(await screen.findByRole('link', { name: /Start Exam/ })).toHaveAttribute('href', '/cbse/tests/mid/5');
    expect(within(screen.getByRole('region', { name: 'Exam Details' })).getByText('---------')).toBeInTheDocument();
    unmount();

    renderWithProviders(<CourseAssessmentScreen courseId="5" assessmentId="42" />, { exam: cbse });
    expect(
      await screen.findByText("Our academic experts are putting the finishing touches on this Mid Term Exam. It'll be live very soon!"),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Sets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Start/ })).not.toBeInTheDocument();
  });

  it('shows an error when the assessment cannot be loaded', async () => {
    server.use(outline, http.get(overviewUrl(77), () => HttpResponse.json({ success: false, message: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' }, { status: 404 })));
    renderWithProviders(<CourseAssessmentScreen courseId="5" assessmentId="77" />, { exam: cbse });
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed To Fetch Assessment');
  });
});

describe('Course assessment page: quiz / unit test', () => {
  it('shows the details, starts the quiz player and lists the submissions', async () => {
    server.use(
      outline,
      http.get(overviewUrl(40), () =>
        ok({
          assessment: assessment('quiz'),
          test_type: 'quiz',
          previous: { order: 1, category: 'lecture', id: 8, module: 2, type: null },
          next: { order: 3, category: 'assessment', id: 41, module: 2, type: 'unit_test' },
          total_questions: 8,
          time_limit_minutes: 30,
          in_progress: false,
          submissions: [attempt(71, 2, 8), attempt(70, 1, 4)],
        }),
      ),
    );
    renderWithProviders(<CourseAssessmentScreen courseId="5" assessmentId="40" />, { exam: cbse });

    expect(await screen.findByRole('heading', { name: 'Quiz on mirror formula!' })).toBeInTheDocument();
    expect(screen.getByText('Read every question carefully.')).toBeInTheDocument();
    const details = screen.getByRole('region', { name: 'Assignment Details' });
    expect(within(details).getByText('8')).toBeInTheDocument();
    expect(within(details).getByText('12 Nov 2026')).toBeInTheDocument();
    expect(within(details).getByRole('link', { name: /Get Started/ })).toHaveAttribute('href', '/cbse/tests/quiz/40');
    const grade = screen.getByRole('region', { name: 'Your Grade' });
    expect(within(grade).getByText('8 Marks')).toBeInTheDocument();
    expect(grade).toHaveTextContent('Your performance in your latest test is 100.0% better than the previous test.');

    // breadcrumb down to the chapter
    expect(await screen.findByRole('link', { name: /Ch 1: Light Reflection/ })).toHaveAttribute('href', '/cbse/learn/5/2?tab=learn');

    await userEvent.click(within(grade).getByRole('button', { name: 'View Submissions' }));
    const drawer = await screen.findByRole('dialog', { name: 'Your attempts' });
    expect(within(drawer).getByText('2 attempts')).toBeInTheDocument();
    expect(within(drawer).getByText('Latest')).toBeInTheDocument();
    const reviews = within(drawer).getAllByRole('link', { name: 'Review attempt' });
    expect(reviews.map((link) => link.getAttribute('href'))).toEqual(['/cbse/tests/quiz/result/71', '/cbse/tests/quiz/result/70']);
    await userEvent.click(within(drawer).getByRole('button', { name: 'Close' }));

    await userEvent.click(screen.getAllByRole('button', { name: /^Next$/ })[0]!);
    expect(navigation.push).toHaveBeenCalledWith('/cbse/learn/5/assessments/unit_test/41');
    await userEvent.click(screen.getAllByRole('button', { name: /^Previous$/ })[0]!);
    expect(navigation.push).toHaveBeenCalledWith('/cbse/learn/5/2/lecture/8');
  });

  it('a unit test in progress continues; with no submissions the grade is blank', async () => {
    server.use(
      outline,
      http.get(overviewUrl(41), () =>
        ok({
          assessment: assessment('unit_test', { assessment_id: 41, title: 'chapter test', instructions: null }),
          test_type: 'quiz',
          previous: null,
          next: null,
          total_questions: 10,
          in_progress: true,
          submissions: [],
        }),
      ),
    );
    renderWithProviders(<CourseAssessmentScreen courseId="5" assessmentId="41" />, { exam: cbse });

    expect(await screen.findByRole('heading', { name: 'Unit Test on chapter test!' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Continue/ })).toHaveAttribute('href', '/cbse/tests/quiz/41');
    expect(within(screen.getByRole('region', { name: 'Your Grade' })).getByText('_ _ _ _ _')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Ch 1: Light Reflection/ })).toHaveAttribute('href', '/cbse/learn/5/2?tab=practice');

    await userEvent.click(screen.getByRole('button', { name: 'View Submissions' }));
    const drawer = await screen.findByRole('dialog', { name: 'Your attempts' });
    expect(within(drawer).getByText('No attempts yet')).toBeInTheDocument();
  });

  it('works out the change from the previous attempt', () => {
    const a = (n: number, obtained: number, total = 10): CourseAttempt => ({
      attemptId: String(n),
      attemptNumber: n,
      date: null,
      totalQuestions: 5,
      totalMarks: total,
      marksObtained: obtained,
    });
    expect(improvementOf(undefined, [])).toBeNull();
    expect(improvementOf(a(1, 5), [a(1, 5)])).toBeNull();
    expect(improvementOf(a(3, 5), [a(3, 5), a(1, 4)])).toBeNull();
    expect(improvementOf(a(2, 4), [a(2, 4), a(1, 8)])).toBe(-50);
    expect(improvementOf(a(2, 4), [a(2, 4), a(1, 0)])).toBe(40);
  });
});

describe('Continue Learning', () => {
  it('opens a course whose next step is an assessment on its page before the test', async () => {
    server.use(
      http.get(`${API}/api/v4/student/plans/active`, () =>
        ok({ plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 10', stream_name: '', duration_months: 12, expiry_date: '2099-03-31', status: 'active' }] }),
      ),
      http.get(`${API}/api/v4/dashboard/board/1/classes/12/continue-courses`, () =>
        ok({
          courses: [
            { course_id: 5, course_name: 'Science Part 1', class_name: 'CLASS 10', subject_name: 'SCIENCE', progress_percentage: 60, upcoming_learn_item: { category: 'assessment', id: 90, module: null, type: 'final_exam' } },
          ],
        }),
      ),
      http.get(`${API}/api/v4/dashboard/board/1/classes/12/subjects`, () => ok({ subjects: [] })),
    );
    renderWithProviders(<LearnScreen aside={null} />, { exam: cbse });

    const learning = await screen.findByRole('region', { name: 'Continue Learning' });
    expect(within(learning).getByRole('link', { name: /Science Part 1/ })).toHaveAttribute('href', '/cbse/learn/5/assessments/final_exam/90');
  });
});
