import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { testExam } from '@/test/exams';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { learnApi } from '../api';
import { ChapterAttemptsDrawer } from './attempts-drawer';
import { ChapterSelector } from './chapter-selector';
import { COURSE_FALLBACK, CoverImage } from './kit';
import { CoursesScreen, LearnScreen, LectureScreen, NcertQuestionsScreen } from '../ui';

// Branches the main learn.test.tsx flows don't reach: toggles, drawers' close controls, image fallbacks,
// failure paths and case-based questions.

const cbse = testExam('cbse');
const ok = (data: unknown) => HttpResponse.json({ success: true, data });

const plan = http.get(`${API}/api/v4/student/plans/active`, () =>
  ok({ plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 10', stream_name: '', duration_months: 12, expiry_date: '2099-03-31', status: 'active' }] }),
);
const outline = http.get(`${API}/api/v4/learn/courses/5/outline`, () =>
  ok({
    finalList: [
      { category: 'module', id: 2, title: 'light reflection', module_order: 1 },
      { category: 'module', id: 3, title: 'the human eye', module_order: 2 },
    ],
    courseDetail: { course_id: 5, course_name: 'Science Part 1', class_name: 'CLASS 10', subject_name: 'SCIENCE', class_id: 12 },
  }),
);

beforeEach(() => {
  navigation.searchParams = new URLSearchParams();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('Learn page toggles and the subject dialog', () => {
  const subjects = ['SCIENCE', 'MATHS', 'HINDI', 'ENGLISH'].map((name, i) => ({
    subject_id: i + 1,
    subject_name: name,
    course_count: 1,
    image: i === 0 ? 'https://cdn.test/science.png' : null,
  }));

  it('expands courses and subjects, shows a banner, and retries books that failed to load', async () => {
    let bookCalls = 0;
    server.use(
      plan,
      http.get(`${API}/api/v4/dashboard/board/1/classes/12/continue-courses`, () =>
        ok({ courses: [{ course_id: 5, course_name: 'Science Part 1', subject_name: 'SCIENCE', progress_percentage: 40 }] }),
      ),
      http.get(`${API}/api/v4/dashboard/board/1/classes/12/subjects`, () => ok({ subjects })),
      http.get(`${API}/api/v4/learn/classes/12/subjects/1/courses`, () => {
        bookCalls += 1;
        return HttpResponse.json({ message: 'down' }, { status: 500 });
      }),
    );
    renderWithProviders(<LearnScreen />, { exam: cbse });

    const learning = await screen.findByRole('region', { name: 'Continue Learning' });
    await userEvent.click(within(learning).getByRole('button', { name: 'View All' }));
    expect(within(learning).getByRole('button', { name: 'Show Less' })).toBeInTheDocument();

    const more = await screen.findByRole('button', { name: 'View All Subjects' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    expect(screen.getByRole('button', { name: 'Show Less', expanded: true })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Science/ }));
    const dialog = await screen.findByRole('dialog');
    const banner = dialog.querySelector('img[src="https://cdn.test/science.png"]')!;
    expect(banner).toHaveClass('opacity-0');
    fireEvent.load(banner);
    expect(banner).toHaveClass('opacity-100');
    fireEvent.error(banner);

    expect(await within(dialog).findByText("Couldn't load the books", {}, { timeout: 4000 })).toBeInTheDocument();
    const before = bookCalls;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(bookCalls).toBeGreaterThan(before));

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Chapter selector', () => {
  it('opens the drawer and closes it from the backdrop, the close button, and a chapter link', async () => {
    server.use(outline);
    renderWithProviders(<ChapterSelector courseId="5" moduleId="2" />, { exam: cbse });
    const toggle = await screen.findByRole('button', { name: 'Change chapter' });
    const drawer = screen.getByRole('dialog', { name: 'Change chapter', hidden: true });
    const layer = drawer.parentElement!;
    const isOpen = () => layer.getAttribute('aria-hidden') === 'false';

    await userEvent.click(toggle);
    expect(isOpen()).toBe(true);
    fireEvent.click(layer.firstElementChild!); // backdrop
    expect(isOpen()).toBe(false);

    await userEvent.click(toggle);
    fireEvent.click(within(drawer).getByRole('button', { name: 'Close', hidden: true }));
    expect(isOpen()).toBe(false);

    await userEvent.click(toggle);
    fireEvent.click(within(drawer).getByRole('link', { name: /The Human Eye/, hidden: true }));
    expect(isOpen()).toBe(false);
  });

  it('renders nothing when the course has no details', async () => {
    server.use(http.get(`${API}/api/v4/learn/courses/6/outline`, () => ok({ finalList: [] })));
    const { container } = renderWithProviders(<ChapterSelector courseId="6" moduleId="2" />, { exam: cbse });
    await waitFor(() => expect(container.querySelector('[aria-busy]')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Change chapter' })).not.toBeInTheDocument();
  });
});

describe('Attempts drawer', () => {
  it('closes from its close button and leaves an unreadable date blank', async () => {
    server.use(
      http.get(`${API}/api/v4/learn/modules/2/pyq-attempts`, () =>
        ok({ attempts: [{ attempt_id: 9, attempt_number: 1, percentage: 40, date: 'not a date' }] }),
      ),
    );
    const onOpenChange = vi.fn();
    renderWithProviders(<ChapterAttemptsDrawer moduleId="2" subtitle="" open onOpenChange={onOpenChange} canAttempt={false} />, {
      exam: cbse,
    });
    const drawer = await screen.findByRole('dialog', { name: 'Your attempts' });
    expect(await within(drawer).findByText('40%')).toBeInTheDocument();
    expect(within(drawer).getByText('1 attempt')).toBeInTheDocument();
    await userEvent.click(within(drawer).getAllByRole('button', { name: 'Close' })[0]!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('Cover image', () => {
  it('falls back to the local cover when the image is missing or broken', () => {
    const { rerender } = renderWithProviders(<CoverImage src={null} alt="none" />, { exam: cbse });
    expect(screen.getByAltText('none')).toHaveAttribute('src', COURSE_FALLBACK);
    rerender(<CoverImage src="https://cdn.test/broken.png" alt="broken" />);
    const img = screen.getByAltText('broken');
    expect(img).toHaveAttribute('src', 'https://cdn.test/broken.png');
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', COURSE_FALLBACK);
  });
});

describe('Lecture page edge cases', () => {
  it('works without storage, blocks the video menu, survives a failed refresh, and uses the mobile buttons', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    let completed = 0;
    let previous = 0;
    server.use(
      outline,
      http.get(`${API}/api/v4/learn/lectures/8/transcript`, () => HttpResponse.json({}, { status: 500 })),
      http.get(`${API}/api/v4/learn/lectures/8`, () =>
        ok({ lecture: { lecture_id: 8, title: 'mirrors', course_id: 5, module_id: 2, videos: [{ language: 'english', link: 'https://cdn.test/a.mp4' }] } }),
      ),
      http.post(`${API}/api/v4/learn/lectures/8/refresh-videos`, () => HttpResponse.json({}, { status: 500 })),
      http.put(`${API}/api/v4/learn/courses/5/lectures/8/complete`, () => {
        completed += 1;
        return ok({ activity: { category: 'lecture', id: 9, module: 2 } });
      }),
      http.get(`${API}/api/v4/learn/courses/5/previous-activity`, () => {
        previous += 1;
        return ok({ activity: { category: 'lecture', id: 7, module: 2 } });
      }),
    );
    renderWithProviders(<LectureScreen courseId="5" moduleId="2" lectureId="8" />, { exam: cbse });
    const video = await screen.findByLabelText('Mirrors');
    expect(fireEvent.contextMenu(video)).toBe(false);
    fireEvent.error(video);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByLabelText('Mirrors')).toHaveAttribute('src', 'https://cdn.test/a.mp4');

    await userEvent.click(screen.getByRole('tab', { name: 'Transcript' }));
    expect(await screen.findByText('No transcript currently available')).toBeInTheDocument();

    const nexts = screen.getAllByRole('button', { name: /Next/ });
    await userEvent.click(nexts[nexts.length - 1]!);
    await waitFor(() => expect(completed).toBe(1));
    const prevs = screen.getAllByRole('button', { name: /Previous/ });
    await userEvent.click(prevs[prevs.length - 1]!);
    await waitFor(() => expect(previous).toBe(1));
  });
});

describe('Case-based NCERT questions', () => {
  const caseBased = {
    id: 5,
    type: 'case_based',
    marks: 4,
    difficulty: 'medium',
    question_text: '<p>Read the passage.</p>',
    sub_questions: [
      { id: 51, sub_question_text: 'Part one?', marks: 1, sub_question_image: 'https://cdn.test/sub.png', sample_answer: 'Answer one' },
      { id: 52, sub_question_text: 'Part two?', marks: 2, sample_answer_image: 'https://cdn.test/ans.png' },
      { id: 53, sub_question_text: 'Part three?', marks: 0 },
    ],
  };

  it('shows the parts with marks and difficulty, then each part’s answer', async () => {
    server.use(outline, http.get(`${API}/api/v4/learn/modules/2/ncert-questions`, () => ok({ questions: [caseBased] })));
    renderWithProviders(<NcertQuestionsScreen courseId="5" moduleId="2" />, { exam: cbse });
    const [card] = await screen.findAllByRole('article');
    expect(within(card!).getByText('Medium')).toBeInTheDocument();
    expect(within(card!).getByText('[1 mark]')).toBeInTheDocument();
    expect(within(card!).getByText('[2 marks]')).toBeInTheDocument();
    expect(within(card!).getByAltText('Sub-question illustration')).toHaveAttribute('src', 'https://cdn.test/sub.png');
    await userEvent.click(within(card!).getByRole('button', { name: 'View solution' }));
    expect(within(card!).getByText('Answer one')).toBeInTheDocument();
    expect(within(card!).getByAltText('Answer illustration')).toHaveAttribute('src', 'https://cdn.test/ans.png');

    await userEvent.click(within(card!).getByRole('button', { name: /Solve step by step/ }));
    const handed = JSON.parse(sessionStorage.getItem('prepzy-doubt-solver') ?? '{}') as { state?: { problem?: { display?: string } } };
    expect(handed.state?.problem?.display).toContain('Part one?');
  });

  it('reports NCERT questions that fail to load', async () => {
    server.use(outline, http.get(`${API}/api/v4/learn/modules/2/ncert-questions`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<NcertQuestionsScreen courseId="5" moduleId="2" />, { exam: cbse });
    expect(await screen.findByText('Failed To Fetch NCERT Chapter Questions')).toBeInTheDocument();
  });
});

describe('Courses on mobile', () => {
  it('filters with the class and subject selects', async () => {
    server.use(
      http.get(`${API}/api/v4/learn/board/${cbse.examId}/classes`, () => ok({ classes: [{ class_id: 1, title: 'Class 10' }] })),
      http.get(`${API}/api/v4/learn/board/${cbse.examId}/textbooks`, () =>
        ok({
          subject_courses: [
            { subject_id: 3, subject_name: 'Science', textbooks: [{ id: 7, class_id: 1, textbook_name: 'Part 1' }] },
            { subject_id: 4, subject_name: 'Maths', textbooks: [{ id: 8, class_id: 1, textbook_name: 'Algebra' }] },
          ],
        }),
      ),
    );
    renderWithProviders(<CoursesScreen />, { exam: cbse });
    await screen.findByRole('link', { name: /Science - Part 1/ });
    fireEvent.change(screen.getByRole('combobox', { name: 'Subject' }), { target: { value: '4' } });
    expect(screen.queryByRole('link', { name: /Science - Part 1/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Maths - Algebra/ })).toBeInTheDocument();
    await screen.findByRole('option', { name: 'Class 10' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Class' }), { target: { value: '1' } });
    expect(screen.getByRole('combobox', { name: 'Class' })).toHaveValue('1');
  });
});

describe('learnApi edge cases', () => {
  it('keeps a plain-text outcome and returns an empty transcript on failure', async () => {
    server.use(
      http.get(`${API}/api/v4/learn/courses/7`, () => ok({ course_id: 7, title: 'Part 1', outcomes: 'Understand waves' })),
      http.get(`${API}/api/v4/learn/lectures/8/transcript`, () => HttpResponse.json({}, { status: 500 })),
    );
    expect((await learnApi.course('7')).outcomes).toEqual(['Understand waves']);
    expect(await learnApi.transcript('8')).toBe('');
  });
});
