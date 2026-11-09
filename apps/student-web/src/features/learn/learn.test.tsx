import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { getExam } from '@/shared/config/exams';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { pyqSummary } from './components/module-screen';
import { filterQuestions, questionTypeLabel } from './components/question-screens';
import { LANGUAGE_KEY, pickVideo } from './components/lecture-screen';
import { toQuestion } from './api';
import {
  ChapterPyqsScreen,
  CourseDetailScreen,
  CourseEntry,
  CoursesScreen,
  LearnScreen,
  LectureScreen,
  ModuleScreen,
  NcertQuestionsScreen,
} from './ui';

const cbse = getExam('cbse')!;
const ok = (data: unknown) => HttpResponse.json({ success: true, data });

const plan = http.get(`${API}/api/v1/student/plans/active`, () =>
  ok({ plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 10', stream_name: '', duration_months: 12, expiry_date: '2099-03-31', status: 'active' }] }),
);

const outline = http.get(`${API}/api/v1/learn/module-outline/5`, () =>
  ok({
    finalList: [
      { category: 'module', id: 2, title: 'light reflection', module_order: 1 },
      { category: 'module', id: 3, title: 'the human eye', module_order: 2 },
      { category: 'assessment', id: 90, type: 'mid_term_exam', title: 'Mid' },
    ],
    courseDetail: { course_id: 5, course_name: 'Science Part 1', class_name: 'CLASS 10', subject_name: 'SCIENCE', class_id: 12 },
  }),
);

const questions = [
  {
    id: 1,
    type: 'mcq',
    year: 2020,
    marks: 1,
    question_text: '<p>Which mirror?</p>',
    options: [
      { id: 'a', option_text: 'Concave', is_correct: true },
      { id: 'b', option_text: 'Convex' },
    ],
    explanation: '<p>Because it converges.</p>',
  },
  { id: 2, type: 'long_answer', year: 2023, marks: 5, question_text: '<p>Explain refraction.</p>', sample_answer: '<p>Bending of light.</p>' },
];

beforeEach(() => {
  navigation.searchParams = new URLSearchParams();
  localStorage.clear();
});

describe('Learn page', () => {
  it('resumes courses and opens a subject’s books', async () => {
    server.use(
      plan,
      http.get(`${API}/api/v1/student/continue-dashboard-courses/12`, () =>
        ok({ courses: [{ course_id: 5, course_name: 'Science Part 1', class_name: 'CLASS 10', subject_name: 'SCIENCE', progress_percentage: 40, upcoming_learn_item: { category: 'lecture', id: 8, module: 2 } }] }),
      ),
      http.get(`${API}/api/v1/student/classes/12/subjects`, () =>
        ok({ subjects: [{ subject_id: 1, subject_name: 'SCIENCE', course_count: 2, subject_description: 'All about science' }, { subject_id: 4, subject_name: 'HINDI', course_count: 0 }] }),
      ),
      http.get(`${API}/api/v1/student/getCourselist-dashboard/12/1`, () =>
        ok({ result: [{ course_id: 5, title: 'Science Part 1', class: 'Class 10', unique_lecture: 12, assessment_count: 3 }] }),
      ),
      http.get(`${API}/api/v1/student/getCourselist-dashboard/12/4`, () => ok({ result: [] })),
    );
    renderWithProviders(<LearnScreen aside={<p>Aside</p>} />, { exam: cbse });

    expect(screen.getByRole('heading', { name: 'Learn', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Aside')).toBeInTheDocument();
    expect(screen.getByText(/speed of light/)).toBeInTheDocument();
    const learning = await screen.findByRole('region', { name: 'Continue Learning' });
    expect(within(learning).getByRole('link', { name: /Science Part 1/ })).toHaveAttribute('href', '/cbse/learn/5/2/lecture/8');

    await userEvent.click(await screen.findByRole('button', { name: /Science/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText('All about science').length).toBeGreaterThan(0);
    expect(await within(dialog).findByRole('link', { name: /Science Part 1/ })).toHaveAttribute('href', '/cbse/learn/5');
    expect(within(dialog).getByText('12 Lessons-3 Tests')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /Hindi/ }));
    expect(await screen.findByText('No books available yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows section errors and empty states', async () => {
    server.use(
      plan,
      http.get(`${API}/api/v1/student/continue-dashboard-courses/12`, () => HttpResponse.json({ message: 'down' }, { status: 500 })),
      http.get(`${API}/api/v1/student/classes/12/subjects`, () => ok({ subjects: [] })),
    );
    renderWithProviders(<LearnScreen />, { exam: cbse });
    expect(await screen.findByText('Failed to fetch Continue Learning')).toBeInTheDocument();
    expect(await screen.findByText('No Subjects Available')).toBeInTheDocument();
  });
});

describe('Course entry', () => {
  it('opens the first chapter', async () => {
    server.use(outline);
    renderWithProviders(<CourseEntry courseId="5" />, { exam: cbse });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/cbse/learn/5/2'));
  });

  it('reports a course without chapters', async () => {
    server.use(http.get(`${API}/api/v1/learn/module-outline/6`, () => ok({ finalList: [] })));
    renderWithProviders(<CourseEntry courseId="6" />, { exam: cbse });
    expect(await screen.findByText('Failed to fetch module outline')).toBeInTheDocument();
  });
});

describe('Chapter page', () => {
  const chapter = (finalList: unknown[], summaries: unknown[] = []) =>
    http.get(`${API}/api/v1/learn/module-details/2/5`, () =>
      ok({ finalList, module_data: { title: 'light reflection', orders: 1 }, summary_videos: summaries }),
    );

  it('lists lessons, notes and practice', async () => {
    server.use(
      outline,
      chapter(
        [
          { category: 'lecture', id: 8, title: 'mirrors and images', isCompleted: true },
          { category: 'assessment', id: 20, type: 'quiz', title: 'mirror quiz' },
          { category: 'assessment', id: 21, type: 'unit_test', title: 'unit test 1' },
        ],
        [
          { type: 'video', id: 31, student_side_active: 1 },
          { type: 'notes', id: 32, student_side_active: 1 },
        ],
      ),
      http.get(`${API}/api/v1/learn/chapter-pyqs/2`, () => ok({ questions })),
      http.get(`${API}/api/v1/learn/chapter-ncert-questions/2/count`, () => ok({ total: 1 })),
    );
    renderWithProviders(<ModuleScreen courseId="5" moduleId="2" />, { exam: cbse });

    expect(await screen.findByText('SCIENCE PART 1 · CHAPTER 1 OF 2', { exact: false, ignore: 'script' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Mirrors and Images/ })).toHaveAttribute('href', '/cbse/learn/5/2/lecture/8');
    expect(screen.getByLabelText('Completed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mirror Quiz/ })).toHaveAttribute('href', '/cbse/tests/quiz/20');
    expect(screen.getByRole('link', { name: /Chapter Notes/ })).toHaveAttribute('href', '/cbse/notes/5?module_id=2');
    expect(screen.getByRole('link', { name: /Summary Video/ })).toHaveAttribute('href', '/cbse/notes/video/31');
    expect(screen.queryByRole('link', { name: /Unit Test 1/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Practice' }));
    expect(screen.getByRole('link', { name: /Unit Test 1/ })).toHaveAttribute('href', '/cbse/tests/quiz/21');
    expect(await screen.findByRole('link', { name: /2 board questions, 2020 to 2023/ })).toHaveAttribute('href', '/cbse/learn/5/2/pyqs');
    expect(screen.getByRole('link', { name: /1 question with solutions/ })).toHaveAttribute('href', '/cbse/learn/5/2/ncert-questions');

    await userEvent.click(screen.getByRole('button', { name: 'Change chapter' }));
    const drawer = screen.getByRole('dialog', { name: 'Change chapter' });
    expect(within(drawer).getByRole('link', { name: /The Human Eye/ })).toHaveAttribute('href', '/cbse/learn/5/3');
    expect(within(drawer).getByRole('link', { name: 'Mid Term' })).toHaveAttribute('href', '/cbse/tests/mid/90');
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('opens on Practice from ?tab=practice and shows empty states', async () => {
    navigation.searchParams = new URLSearchParams('tab=practice');
    server.use(
      outline,
      chapter([]),
      http.get(`${API}/api/v1/learn/chapter-pyqs/2`, () => ok({ questions: [] })),
      http.get(`${API}/api/v1/learn/chapter-ncert-questions/2/count`, () => ok({ total: 0 })),
    );
    renderWithProviders(<ModuleScreen courseId="5" moduleId="2" />, { exam: cbse });
    expect(await screen.findByText('No practice available yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Learn' }));
    expect(screen.getByText('No lessons available yet.')).toBeInTheDocument();
  });

  it('shows an error when the chapter fails', async () => {
    server.use(
      outline,
      http.get(`${API}/api/v1/learn/module-details/2/5`, () => HttpResponse.json({ message: 'nope' }, { status: 500 })),
      http.get(`${API}/api/v1/learn/chapter-pyqs/2`, () => ok({ questions: [] })),
      http.get(`${API}/api/v1/learn/chapter-ncert-questions/2/count`, () => ok({ total: 0 })),
    );
    renderWithProviders(<ModuleScreen courseId="5" moduleId="2" />, { exam: cbse });
    expect(await screen.findByText('Failed To Fetch Modules')).toBeInTheDocument();
  });

  it('summarises PYQ years', () => {
    const q = (year: string | null) => toQuestion({ year }, 0);
    expect(pyqSummary([])).toBe("Chapter PYQ's");
    expect(pyqSummary([q(null)])).toBe('1 board question');
    expect(pyqSummary([q('2020'), q('2020')])).toBe('2 board questions, 2020');
  });
});

describe('Lecture page', () => {
  const lecture = (videos: unknown) =>
    http.get(`${API}/api/v1/learn/lectures/8`, () =>
      ok({ lecture: { lecture_id: 8, title: 'mirrors and images', description: 'About mirrors', course_id: 5, module_id: 2, videos } }),
    );
  const transcript = http.get(`${API}/api/v1/learn/transcript/8`, () => ok({ transcript: 'First line<br />' }));

  it('plays the chosen language and moves through the course', async () => {
    let completed = false;
    server.use(
      outline,
      transcript,
      lecture([
        { language: 'english', link: 'https://cdn.test/en.mp4' },
        { language: 'hindi', link: 'https://youtu.be/abcdefghijk' },
      ]),
      http.put(`${API}/api/v1/learn/progress-update/course/5/lecture/8/complete`, () => {
        completed = true;
        return ok({ activity: { category: 'assessment', id: 20, type: 'quiz', module: 2 } });
      }),
      http.post(`${API}/api/v1/learn/previousActivity`, () => ok({ activity: { category: 'lecture', id: 7, module: 2 } })),
    );
    renderWithProviders(<LectureScreen courseId="5" moduleId="2" lectureId="8" />, { exam: cbse });

    expect(await screen.findByLabelText('Mirrors And Images')).toHaveAttribute('src', 'https://cdn.test/en.mp4');
    expect(screen.getByText('About mirrors')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hindi' }));
    expect(screen.getByTitle('Mirrors And Images')).toHaveAttribute('src', expect.stringContaining('abcdefghijk'));
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('hindi');

    await userEvent.click(screen.getByRole('tab', { name: 'Transcript' }));
    expect(await screen.findByText('First line')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Ch 1: Light Reflection/ })).toHaveAttribute('href', '/cbse/learn/5/2?tab=learn');

    await userEvent.click(screen.getAllByRole('button', { name: /Next/ })[0]!);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/cbse/tests/quiz/20'));
    expect(completed).toBe(true);
    await userEvent.click(screen.getAllByRole('button', { name: /Previous/ })[0]!);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/cbse/learn/5/2/lecture/7'));
  });

  it('goes back to the chapter after the last step and refreshes broken videos', async () => {
    let refreshed = 0;
    localStorage.setItem(LANGUAGE_KEY, 'tamil');
    server.use(
      outline,
      transcript,
      lecture([{ language: 'english', link: 'old-id' }]),
      http.post(`${API}/api/lectures/8/refresh-videos`, () => {
        refreshed += 1;
        return HttpResponse.json({ success: true, data: { videos: [{ language: 'english', link: 'https://cdn.test/new.mp4' }] } });
      }),
      http.put(`${API}/api/v1/learn/progress-update/course/5/lecture/8/complete`, () => ok({ activity: null })),
      http.post(`${API}/api/v1/learn/previousActivity`, () => HttpResponse.json({ success: false, data: { activity: null } })),
    );
    renderWithProviders(<LectureScreen courseId="5" moduleId="2" lectureId="8" />, { exam: cbse });
    const video = await screen.findByLabelText('Mirrors And Images');
    expect(video).toHaveAttribute('src', 'https://resource2.heygen.ai/video/old-id/1280x720.mp4');
    fireEvent.error(video);
    fireEvent.error(video);
    await waitFor(() => expect(screen.getByLabelText('Mirrors And Images')).toHaveAttribute('src', 'https://cdn.test/new.mp4'));
    expect(refreshed).toBe(1);

    await userEvent.click(screen.getAllByRole('button', { name: /Previous/ })[0]!);
    await userEvent.click(screen.getAllByRole('button', { name: /Next/ })[0]!);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/cbse/learn/5/2'));
    expect(navigation.push).toHaveBeenCalledTimes(1);
  });

  it('shows the coming-soon state, and errors', async () => {
    server.use(
      outline,
      transcript,
      lecture([]),
      http.put(`${API}/api/v1/learn/progress-update/course/5/lecture/8/complete`, () => HttpResponse.json({ message: 'Server down' }, { status: 500 })),
    );
    renderWithProviders(<LectureScreen courseId="5" moduleId="2" lectureId="8" />, { exam: cbse });
    expect(await screen.findByText(/finishing touches/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /Next/ })[0]!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('reports a lecture that fails to load', async () => {
    server.use(outline, transcript, http.get(`${API}/api/v1/learn/lectures/8`, () => HttpResponse.json({ message: 'x' }, { status: 404 })));
    renderWithProviders(<LectureScreen courseId="5" moduleId="2" lectureId="8" />, { exam: cbse });
    expect(await screen.findByText('Failed To Fetch Lecture Data')).toBeInTheDocument();
  });

  it('picks the remembered language, else the first video', () => {
    const videos = [
      { language: 'english', link: 'a' },
      { language: 'hindi', link: 'b' },
    ];
    expect(pickVideo(videos, 'hindi')?.link).toBe('b');
    expect(pickVideo(videos, null)?.link).toBe('a');
    expect(pickVideo([], 'x')).toBeNull();
  });
});

describe('Chapter questions', () => {
  it('opens "Your attempts" with past chapter tests, review links and a retake', async () => {
    let calls = 0;
    server.use(
      outline,
      http.get(`${API}/api/v1/learn/chapter-pyqs/2`, () => ok({ questions })),
      http.get(`${API}/api/v1/exams/chapter-pyqs/previous-attempts/2`, () => {
        calls += 1;
        return HttpResponse.json({
          success: true,
          submissions: [
            { attempt_id: 91, attempt_number: 2, grade: '72.4', date: '2026-10-05T10:30:00Z' },
            { attempt_id: 90, attempt_number: 1, grade: 'B', date: '2026-10-01T10:30:00Z' },
          ],
        });
      }),
    );
    renderWithProviders(<ChapterPyqsScreen courseId="5" moduleId="2" />, { exam: cbse });
    await screen.findByText(/CBSE 2020 to 2023/);
    expect(calls).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Your attempts' }));
    const drawer = await screen.findByRole('dialog', { name: 'Your attempts' });
    expect(await within(drawer).findByText('72%')).toBeInTheDocument();
    expect(within(drawer).getByText('B')).toBeInTheDocument();
    expect(within(drawer).getByText('Latest')).toBeInTheDocument();
    expect(within(drawer).getByText('5 Oct 2026')).toBeInTheDocument();
    expect(within(drawer).getAllByRole('link', { name: 'Review attempt' })[0]).toHaveAttribute('href', '/cbse/tests/chapter-pyq/result/91');
    expect(within(drawer).getByRole('link', { name: 'Attempt again as a test' })).toHaveAttribute('href', '/cbse/tests/chapter-pyq/2');
  });

  it('explains an empty attempts list', async () => {
    server.use(
      outline,
      http.get(`${API}/api/v1/learn/chapter-pyqs/2`, () => ok({ questions })),
      http.get(`${API}/api/v1/exams/chapter-pyqs/previous-attempts/2`, () => HttpResponse.json({ success: true, submissions: [] })),
    );
    renderWithProviders(<ChapterPyqsScreen courseId="5" moduleId="2" />, { exam: cbse });
    await screen.findByText(/CBSE 2020 to 2023/);
    await userEvent.click(screen.getByRole('button', { name: 'Your attempts' }));
    expect(await screen.findByText('No attempts yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Attempt as a test' })).toHaveAttribute('href', '/cbse/tests/chapter-pyq/2');
  });

  it('filters PYQs by type and year, and links to the test', async () => {
    server.use(outline, http.get(`${API}/api/v1/learn/chapter-pyqs/2`, () => ok({ questions })));
    renderWithProviders(<ChapterPyqsScreen courseId="5" moduleId="2" />, { exam: cbse });

    expect(await screen.findByText(/CBSE 2020 to 2023/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Attempt as a test' })).toHaveAttribute('href', '/cbse/tests/chapter-pyq/2');
    expect(screen.getByText(/Stuck on a question/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /See how it works/ }));
    const video = await screen.findByRole('dialog', { name: 'How Socrates works' });
    expect(video.querySelector('video')).toHaveAttribute('src', '/media/socrates-how-it-works.mp4');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText(/Stuck on a question/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'MCQ' }));
    expect(screen.getAllByText('Which mirror?').length).toBeGreaterThan(0);
    expect(screen.queryByText('Explain refraction.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    await userEvent.selectOptions(screen.getAllByLabelText('Filter by year')[0]!, '2023');
    expect(screen.queryByText('Which mirror?')).not.toBeInTheDocument();
    expect(screen.getAllByText('Explain refraction.').length).toBeGreaterThan(0);
  });

  it('shows PYQ empty and error states', async () => {
    server.use(outline, http.get(`${API}/api/v1/learn/chapter-pyqs/2`, () => ok({ questions: [] })));
    renderWithProviders(<ChapterPyqsScreen courseId="5" moduleId="2" />, { exam: cbse });
    expect(await screen.findByText('No PYQs available yet.')).toBeInTheDocument();
  });

  it('reports a PYQ failure', async () => {
    server.use(outline, http.get(`${API}/api/v1/learn/chapter-pyqs/2`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<ChapterPyqsScreen courseId="5" moduleId="2" />, { exam: cbse });
    expect(await screen.findByText('Failed To Fetch PYQs')).toBeInTheDocument();
  });

  it('reveals NCERT solutions', async () => {
    server.use(outline, http.get(`${API}/api/v1/learn/chapter-ncert-questions/2`, () => ok({ questions })));
    renderWithProviders(<NcertQuestionsScreen courseId="5" moduleId="2" />, { exam: cbse });
    const [first] = await screen.findAllByRole('article');
    expect(within(first!).getByText(/Q1 · MCQ · 1 mark/)).toBeInTheDocument();
    await userEvent.click(within(first!).getByRole('button', { name: 'View solution' }));
    expect(within(first!).getByLabelText('Correct answer')).toBeInTheDocument();
    expect(within(first!).getByText('Because it converges.')).toBeInTheDocument();
    // "Solve step by step" hands the question (with the course's subject) to Socrates.
    await userEvent.click(within(first!).getByRole('button', { name: /Solve step by step/ }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/doubt-solver?step=chat');
    const handed = JSON.parse(sessionStorage.getItem('prepzy-doubt-solver') ?? '{}') as { state?: { problem?: { display?: string } } };
    expect(handed.state?.problem?.display).toBeTruthy();
    await userEvent.click(screen.getAllByRole('button', { name: 'Long' })[0]!);
    expect(screen.getAllByRole('article')).toHaveLength(2); // mobile + desktop layouts of one card
  });

  it('labels and filters question types', () => {
    expect(questionTypeLabel('long_answer_type-i')).toBe('Long Answer Type I');
    expect(questionTypeLabel('fill_in-blank')).toBe('Fill In Blank');
    const list = questions.map(toQuestion);
    expect(filterQuestions(list, 'long')).toHaveLength(1);
    expect(filterQuestions(list, 'all', '2020')).toHaveLength(1);
  });
});

describe('Courses', () => {
  const catalogue = [
    http.get(`${API}/api/class-list`, () => ok([{ class_id: 1, title: 'Class 10' }])),
    http.get(`${API}/api/v2/get-textbooks`, ({ request }) => {
      const classId = new URL(request.url).searchParams.get('class_id');
      return HttpResponse.json({
        subject_courses: [
          { subject_id: 3, subject_name: 'Science', textbooks: [{ id: 7, class_id: 1, class_name: 'Class 10', textbook_name: 'Part 1', description: 'Light' }] },
          { subject_id: 4, subject_name: 'Maths', textbooks: classId ? [] : [{ id: 8, class_id: 1, textbook_name: 'Algebra', description: 'x' }] },
        ],
      });
    }),
  ];

  it('filters books by class and subject', async () => {
    server.use(...catalogue);
    renderWithProviders(<CoursesScreen />, { exam: cbse });
    expect(await screen.findByRole('link', { name: /Science - Part 1/ })).toHaveAttribute('href', '/cbse/courses/7?class_id=1');
    expect(screen.getByRole('link', { name: /Maths - Algebra/ })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Maths' })[0]!);
    expect(screen.queryByRole('link', { name: /Science - Part 1/ })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Class 10' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Maths' }));
    expect(await screen.findByText('No courses found for the selected class and subject.')).toBeInTheDocument();
  });

  it('shows a course and enrolment state', async () => {
    server.use(
      http.get(`${API}/api/courses/7`, () =>
        ok({ course_id: 7, class: 1, title: 'Part 1', className: 'CLASS 10', subjectName: 'SCIENCE', outcomes: ['Waves'], lectureCount: 9, assessCounts: { quiz: 2 } }),
      ),
      http.get(`${API}/api/course_outline_overview/7`, () =>
        HttpResponse.json({ finalList: [{ category: 'module', id: 1, module_order: 1, title: 'light', lectures: [{ category: 'lecture', lecture_order: 1, title: 'intro' }] }] }),
      ),
      http.get(`${API}/api/subscribed-class`, () => ok({ classIds: [1] })),
    );
    renderWithProviders(<CourseDetailScreen courseId="7" />, { exam: cbse });
    expect(await screen.findByRole('heading', { name: 'Part 1' })).toBeInTheDocument();
    expect(screen.getByText('Waves')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Resume Course' })).toHaveAttribute('href', '/cbse/learn/7');
    await userEvent.click(await screen.findByRole('button', { name: 'Chapter 1 - Light' }));
    expect(screen.getByText(/Intro/)).toBeInTheDocument();
  });

  it('offers enrolment when the class isn’t subscribed, and reports failures', async () => {
    server.use(
      http.get(`${API}/api/courses/7`, () => ok({ course_id: 7, class: 2, title: 'Part 1' })),
      http.get(`${API}/api/course_outline_overview/7`, () => HttpResponse.json({ finalList: [] })),
      http.get(`${API}/api/subscribed-class`, () => HttpResponse.json({}, { status: 500 })),
    );
    renderWithProviders(<CourseDetailScreen courseId="7" />, { exam: cbse });
    expect(await screen.findByRole('link', { name: 'Enroll Now' })).toHaveAttribute('href', '/cbse/plans');

    server.use(http.get(`${API}/api/courses/9`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<CourseDetailScreen courseId="9" />, { exam: cbse });
    expect(await screen.findByText('Failed to fetch course')).toBeInTheDocument();
  });
});
