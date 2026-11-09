import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { competitiveChrome } from '@/shared/config/navigation';
import { competitiveSuggestionHref } from '@/shared/layout/shell-api';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import {
  bestAttempt,
  chapterProgress,
  learnApi,
  toAttempts,
  toChapterInfo,
  toCourseOverview,
  toNotesChapters,
  toNotesSubjects,
  toStudyNotes,
  toSummaryVideo,
  toVideoParts,
  youTubeId,
} from './api';
import { ChapterScreen } from './components/chapter-screen';
import { CourseScreen } from './components/course-screen';
import { NotesLibrary } from './components/notes-library';
import { isYouTubeEnded } from './components/video-player';
import { adjacentSteps, isChapterStep } from './steps';
import { testExam } from '@/test/exams';

const neet = testExam('neet');

const ok = (body: Record<string, unknown>) => HttpResponse.json({ success: true, ...body });

const plan = http.get(`${API}/api/v4/student/plans/active`, () =>
  ok({ data: { plans: [{ plan_id: 1, class_id: 20, class_name: 'NEET', duration_months: 12, expiry_date: '2099-01-01', status: 'active' }] } }),
);

const sidebarRow = {
  module_id: 341,
  module_title: 'Laws of Motion',
  course_id: 214,
  course_title: 'Physics Class 11',
  subject_id: 7,
  subject_title: 'NEET-PHYSICS',
  total_videos: 1,
  completed_videos: 1,
  total_notes: 1,
  completed_notes: 0,
  total_tests: 1,
  completed_tests: 0,
  total_pyqs: 1,
  completed_pyqs: 0,
  pyq_question_count: 14,
};
const sidebar = http.get(`${API}/api/neet/ChapterSidebar/:id`, () => ok({ data: [sidebarRow] }));

describe('competitive learn normalisers', () => {
  it('derives chapter progress from the four counters', () => {
    expect(chapterProgress({})).toEqual({ status: 'not_started', percent: 0 });
    expect(chapterProgress({ total_videos: 1, total_notes: '1', completed_videos: '1' })).toEqual({ status: 'in_progress', percent: 50 });
    expect(chapterProgress({ total_videos: 1, completed_videos: 1 })).toEqual({ status: 'completed', percent: 100 });
  });

  it('reads notes subjects and chapters', () => {
    expect(toNotesSubjects([{ subject_id: 7, subject_name: 'NEET-PHYSICS', total_chapters: '16', completed_chapters: 7 }])).toEqual([
      { id: '7', name: 'Physics', total: 16, completed: 7 },
    ]);
    expect(toNotesSubjects(null)).toEqual([]);
    const notes = toNotesChapters({
      data: [
        { module_id: 1, course_id: 2, module_order: 3, module_title: 'A', lock_content: 1, notes_status: 'completed' },
        { module_id: 4, course_id: 2, module_order: 4, module_title: 'B', lock_content: null, notes_status: 'pending' },
        { module_id: 5, course_id: 2, module_order: 5, module_title: 'C', notes_status: 'in_progress' },
      ],
    });
    expect(notes.chapters.map((c) => [c.locked, c.status])).toEqual([
      [true, 'completed'],
      [false, 'not_started'],
      [false, 'in_progress'],
    ]);
    expect(notes).toMatchObject({ total: 3, completed: 1 });
    expect(toNotesChapters({ data: [], summary: { total_chapters: 9, completed_chapters: '2' } })).toMatchObject({ total: 9, completed: 2 });
  });

  it('sorts course chapters and reads the summary', () => {
    const course = toCourseOverview({
      data: [
        { module_id: 2, title: 'Second', orders: 2, tag: 'NEW' },
        { module_id: 1, title: 'First', orders: 1, total_videos: 1, completed_videos: 1 },
      ],
      summary: { videos: { completed: 1 }, notes: { completed: '2' } },
    });
    expect(course.chapters.map((c) => c.title)).toEqual(['First', 'Second']);
    expect(course.chapters[1]!.tag).toBe('NEW');
    expect(course.done).toEqual({ videos: 1, notes: 2, tests: 0, pyqs: 0 });
    expect(toCourseOverview({}).chapters).toEqual([]);
  });

  it('reads the chapter sidebar row', () => {
    expect(toChapterInfo([])).toBeNull();
    expect(toChapterInfo([sidebarRow])).toMatchObject({ subject: 'Physics', title: 'Laws of Motion', percent: 25, pyqQuestionCount: 14 });
  });

  it('turns new_video_link into parts with their languages', () => {
    const parts = toVideoParts({
      english: { 'Part 1': { title: 'Intro', video_link: 'https://x/1.mp4' }, 'Part 2': { title: 'More', video_link: 'https://x/2.mp4' } },
      hindi: { 'Part 1': { title: 'Parichay', video_link: 'https://x/1h.mp4' }, 'Part 3': { video_link: '' } },
    });
    expect(parts.map((p) => [p.label, p.sources.map((s) => s.language)])).toEqual([
      ['Part 1', ['english', 'hindi']],
      ['Part 2', ['english']],
    ]);
    expect(toVideoParts('{"en":{"P":{"video_link":"https://y"}}}')[0]!.sources[0]!.url).toBe('https://y');
    expect(toVideoParts('https://cdn/v.mp4', 'Physics')).toEqual([
      { label: 'Part 1', sources: [{ language: 'default', title: 'Physics', url: 'https://cdn/v.mp4' }] },
    ]);
    expect(toVideoParts('not json')).toEqual([]);
    expect(toVideoParts(null)).toEqual([]);
  });

  it('never shows a video as completed when nothing is uploaded', () => {
    expect(toSummaryVideo([{ title: 'Physics', new_video_link: {}, summary_video_status: 'completed' }])).toMatchObject({ completed: false, parts: [] });
    expect(toSummaryVideo([])).toBeNull();
    expect(toSummaryVideo({ new_video_link: { en: { P: { video_link: 'https://v' } } }, summary_video_status: 'completed' })?.completed).toBe(true);
  });

  it('detects YouTube links and their end event', () => {
    expect(youTubeId('https://www.youtube.com/watch?v=abcdef12345')).toBe('abcdef12345');
    expect(youTubeId('https://youtu.be/abcdef12345?t=1')).toBe('abcdef12345');
    expect(youTubeId('https://cdn.example.com/v.mp4')).toBeNull();
    expect(isYouTubeEnded('{"event":"onStateChange","info":0}')).toBe(true);
    expect(isYouTubeEnded({ event: 'infoDelivery', info: { playerState: 0 } })).toBe(true);
    expect(isYouTubeEnded({ event: 'onStateChange', info: 1 })).toBe(false);
    expect(isYouTubeEnded('nope')).toBe(false);
  });

  it('reads study notes and attempts', () => {
    expect(toStudyNotes(null)).toBeNull();
    expect(toStudyNotes({ module_name: 'M', module_order: 3, notes_text: '<p>x</p>', is_completed: true })).toMatchObject({
      moduleName: 'M',
      order: 3,
      completed: true,
      pdf: null,
    });
    const attempts = toAttempts([
      { attempt_id: 1, attempt_number: 1, total_marks_obtained: 12, total_marks: 40, is_latest: true, date: '2026-01-02' },
      { attempt_id: 2, attempt_number: 2, total_marks_obtained: 30, total_marks: 40 },
    ]);
    expect(bestAttempt(attempts)?.attemptId).toBe('2');
    expect(bestAttempt([])).toBeNull();
  });

  it('treats a missing practice assessment or notes (404) as none', async () => {
    server.use(
      http.get(`${API}/api/neet/unit-test-assessment/:id`, () => HttpResponse.json({ success: false }, { status: 404 })),
      http.get(`${API}/api/neet/get-summar-notes/:id`, () => HttpResponse.json({ success: false }, { status: 404 })),
    );
    await expect(learnApi.practiceAssessment('1')).resolves.toBeNull();
    await expect(learnApi.studyNotes('1')).resolves.toBeNull();
  });

  it('knows the chapter steps and shell layout', () => {
    expect(isChapterStep('study-notes')).toBe(true);
    expect(isChapterStep('lecture')).toBe(false);
    expect(adjacentSteps('video-lectures')).toEqual({ prev: null, next: 'study-notes' });
    expect(adjacentSteps('chapter-pyq')).toEqual({ prev: 'practice-questions', next: null });
    expect(competitiveChrome('/neet/dashboard')).toEqual({ rail: true, padded: true });
    expect(competitiveChrome('/neet/learn/214')).toEqual({ rail: true, padded: false });
    expect(competitiveChrome('/neet/learn/214/341/study-notes')).toEqual({ rail: false, padded: false });
  });

  it('builds search result links like the previous app', () => {
    expect(competitiveSuggestionHref('neet', { result_type: 'course', course_id: 2 })).toBe('/neet/learn/2');
    expect(competitiveSuggestionHref('neet', { result_type: 'topic', course_id: 2, module_id: 3, anchor_id: 'newton' })).toBe(
      '/neet/learn/2/3/study-notes#newton',
    );
    expect(competitiveSuggestionHref('neet', { result_type: 'module', course_id: 2, module_id: 3 })).toBe('/neet/learn/2/3/video-lectures');
    expect(competitiveSuggestionHref('neet', {})).toBeNull();
  });
});

describe('NotesLibrary', () => {
  const subjects = http.get(`${API}/api/neet/summary-notes/subjects`, ({ request }) => {
    expect(new URL(request.url).searchParams.get('class_id')).toBe('20');
    return ok({
      data: [
        { subject_id: 7, subject_name: 'NEET-PHYSICS', total_chapters: 2, completed_chapters: 1 },
        { subject_id: 8, subject_name: 'NEET-BOTANY', total_chapters: 0, completed_chapters: 0 },
      ],
    });
  });
  const chapters = http.get(`${API}/api/neet/summary-notes/chapters`, ({ request }) => {
    const subject = new URL(request.url).searchParams.get('subject_id');
    if (subject === '8') return ok({ data: [], summary: { total_chapters: 0, completed_chapters: 0 } });
    return ok({
      summary: { total_chapters: 2, completed_chapters: 1 },
      data: [
        { module_id: 341, course_id: 214, module_order: 1, module_title: 'Laws of Motion', notes_status: 'completed', lock_content: 0 },
        { module_id: 342, course_id: 214, module_order: 2, module_title: 'Gravitation', notes_status: 'pending', lock_content: 1 },
      ],
    });
  });

  it('lists the first subject’s chapters and switches subjects', async () => {
    server.use(plan, subjects, chapters);
    renderWithProviders(<NotesLibrary />, { exam: neet });
    const row = await screen.findByRole('link', { name: /Laws of Motion/ });
    expect(row).toHaveAttribute('href', '/neet/learn/214/341/study-notes?from=notes');
    expect(screen.queryByRole('link', { name: /Gravitation/ })).not.toBeInTheDocument();
    expect(screen.getByText('Gravitation')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'NEET UG Notes Library' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Botany' }));
    expect(await screen.findByText('No chapters found for this subject.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Botany' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows an error when subjects fail and "No subjects found" when empty', async () => {
    server.use(plan, http.get(`${API}/api/neet/summary-notes/subjects`, () => HttpResponse.json({ message: 'Down' }, { status: 500 })));
    const { unmount } = renderWithProviders(<NotesLibrary />, { exam: neet });
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load subjects');
    unmount();

    server.use(http.get(`${API}/api/neet/summary-notes/subjects`, () => ok({ data: [] })));
    renderWithProviders(<NotesLibrary />, { exam: neet });
    expect(await screen.findByText('No subjects found')).toBeInTheDocument();
  });
});

describe('CourseScreen', () => {
  it('shows totals and chapter rows linking to their first step', async () => {
    server.use(
      sidebar,
      http.get(`${API}/api/neet/module-list/214`, () =>
        ok({
          summary: { videos: { completed: 1 }, notes: { completed: 0 }, tests: { completed: 0 }, pyqs: { completed: 0 } },
          data: [{ module_id: 341, title: 'Laws of Motion', orders: 1, total_videos: 1, completed_videos: 1 }],
        }),
      ),
    );
    renderWithProviders(<CourseScreen courseId="214" />, { exam: neet });
    expect(await screen.findByRole('link', { name: /Laws of Motion/ })).toHaveAttribute('href', '/neet/learn/214/341/video-lectures');
    expect(screen.getByText('1/1 completed')).toBeInTheDocument();
    expect(await screen.findByText('Physics')).toBeInTheDocument();
  });

  it('shows the empty and error states', async () => {
    server.use(http.get(`${API}/api/neet/module-list/1`, () => ok({ data: [] })));
    const { unmount } = renderWithProviders(<CourseScreen courseId="1" />, { exam: neet });
    expect(await screen.findByText('No chapters yet')).toBeInTheDocument();
    unmount();
    server.use(http.get(`${API}/api/neet/module-list/2`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<CourseScreen courseId="2" />, { exam: neet });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('ChapterScreen', () => {
  const video = (link: unknown, status: string | null = null) =>
    http.get(`${API}/api/neet/sumamry-video/341`, () => ok({ data: [{ module_id: 341, title: 'Physics', new_video_link: link, summary_video_status: status }] }));

  it('links the sidebar steps and Prev / Next', async () => {
    server.use(sidebar, video({}));
    renderWithProviders(<ChapterScreen courseId="214" moduleId="341" step="study-notes" />, { exam: neet });
    server.use(http.get(`${API}/api/neet/get-summar-notes/341`, () => ok({ data: { module_name: 'Laws of Motion', notes_text: null } })));
    const steps = await screen.findByRole('navigation', { name: 'Chapter steps' });
    expect(within(steps).getByRole('link', { name: /Study Notes/ })).toHaveAttribute('aria-current', 'page');
    expect(within(steps).getByRole('link', { name: /Previous Year Questions/ })).toHaveAttribute('href', '/neet/learn/214/341/chapter-pyq');
    expect(screen.getAllByRole('link', { name: 'Previous step' })[0]).toHaveAttribute('href', '/neet/learn/214/341/video-lectures');
    expect(screen.getAllByRole('link', { name: 'Next step' })[0]).toHaveAttribute('href', '/neet/learn/214/341/practice-questions');
    expect(screen.getByRole('progressbar', { name: 'Overall progress' })).toHaveAttribute('aria-valuenow', '25');
  });

  it('plays a video, switches language and marks it completed', async () => {
    let posted: unknown = null;
    server.use(
      sidebar,
      video({
        english: { 'Part 1': { title: 'Intro', video_link: 'https://cdn/en.mp4' } },
        hindi: { 'Part 1': { title: 'Intro', video_link: 'https://cdn/hi.mp4' } },
      }),
      http.post(`${API}/api/neet/summary-video-completed`, async ({ request }) => {
        posted = await request.json();
        return ok({ message: 'Summary video marked as completed.' });
      }),
    );
    const { container } = renderWithProviders(<ChapterScreen courseId="214" moduleId="341" step="video-lectures" />, { exam: neet });
    await userEvent.click(await screen.findByRole('button', { name: 'Play video' }));
    expect(container.querySelector('video')).toHaveAttribute('src', 'https://cdn/en.mp4');

    await userEvent.click(screen.getByRole('button', { name: 'Choose language' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Hindi' }));
    expect(container.querySelector('video')).toHaveAttribute('src', 'https://cdn/hi.mp4');

    await userEvent.click(screen.getAllByRole('button', { name: 'Mark As Completed' })[0]!);
    await waitFor(() => expect(posted).toEqual({ course_id: 214, module_id: 341 }));
    expect((await screen.findAllByRole('button', { name: 'Completed' }))[0]).toBeDisabled();
  });

  it('shows "Video Coming Soon!" without a video', async () => {
    server.use(sidebar, video(null, 'completed'));
    renderWithProviders(<ChapterScreen courseId="214" moduleId="341" step="video-lectures" />, { exam: neet });
    expect(await screen.findByText('Video Coming Soon!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Completed' })).not.toBeInTheDocument();
  });

  it('renders study notes, goes back to the library and marks them completed', async () => {
    let posted = false;
    navigation.searchParams = new URLSearchParams('from=notes');
    server.use(
      sidebar,
      http.get(`${API}/api/neet/get-summar-notes/341`, () =>
        ok({ data: { module_name: 'Laws of Motion', module_order: 3, notes_text: '<h2>Newton</h2>', notes_pdf: 'https://cdn/n.pdf', is_completed: false } }),
      ),
      http.post(`${API}/api/neet/summary-notes-completed`, () => {
        posted = true;
        return ok({});
      }),
    );
    renderWithProviders(<ChapterScreen courseId="214" moduleId="341" step="study-notes" />, { exam: neet });
    expect(await screen.findByRole('heading', { name: 'Newton' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/neet/notes');
    expect(screen.getAllByRole('link', { name: 'Download' })[0]).toHaveAttribute('href', 'https://cdn/n.pdf?fl_attachment=true');
    await userEvent.click(screen.getAllByRole('button', { name: 'Mark As Completed' })[0]!);
    await waitFor(() => expect(posted).toBe(true));
    expect((await screen.findAllByText('Completed')).length).toBeGreaterThan(0);
    navigation.searchParams = new URLSearchParams();
  });

  it('shows "Notes Coming Soon!" and a notes error', async () => {
    server.use(sidebar, http.get(`${API}/api/neet/get-summar-notes/341`, () => HttpResponse.json({}, { status: 404 })));
    const { unmount } = renderWithProviders(<ChapterScreen courseId="214" moduleId="341" step="study-notes" />, { exam: neet });
    expect(await screen.findByText('Notes Coming Soon!')).toBeInTheDocument();
    unmount();
    server.use(http.get(`${API}/api/neet/get-summar-notes/341`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<ChapterScreen courseId="214" moduleId="341" step="study-notes" />, { exam: neet });
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed To Fetch Notes');
  });

  it('starts the practice assessment and reviews past attempts', async () => {
    server.use(
      sidebar,
      http.get(`${API}/api/neet/unit-test-assessment/341`, () => ok({ data: { assessment_id: 5231 } })),
      http.get(`${API}/api/neet/quiz-exam/previous-attempts/5231`, () =>
        ok({
          submissions: [
            { attempt_id: 9, attempt_number: 2, date: '2026-09-10T09:00:00Z', total_marks: 80, total_marks_obtained: 40, is_latest: true },
            { attempt_id: 8, attempt_number: 1, date: '2026-09-01T09:00:00Z', total_marks: 80, total_marks_obtained: 60, is_latest: false },
          ],
        }),
      ),
    );
    renderWithProviders(<ChapterScreen courseId="214" moduleId="341" step="practice-questions" />, { exam: neet });
    expect(await screen.findByRole('link', { name: 'Start Assessment' })).toHaveAttribute('href', '/neet/tests/practice/5231');
    expect((await screen.findAllByText('60/80')).length).toBe(2); // best score + the attempt card
    expect(screen.getAllByRole('link', { name: 'Review Solutions' })[0]).toHaveAttribute('href', '/neet/tests/practice/result/9');
  });

  it('explains when a chapter has no practice assessment', async () => {
    server.use(sidebar, http.get(`${API}/api/neet/unit-test-assessment/341`, () => HttpResponse.json({}, { status: 404 })));
    renderWithProviders(<ChapterScreen courseId="214" moduleId="341" step="practice-questions" />, { exam: neet });
    expect(await screen.findByText('No assessment available for this chapter yet')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Start Assessment' })).not.toBeInTheDocument();
  });

  it('starts the chapter PYQ test with at most 10 questions', async () => {
    server.use(
      sidebar,
      http.get(`${API}/api/neet/chapter-pyq-exam/previous-attempts/341`, () =>
        ok({ submissions: [{ attempt_id: 77, attempt_number: 1, date: 'x', total_marks: 40, total_marks_obtained: 28, is_latest: true }] }),
      ),
    );
    renderWithProviders(<ChapterScreen courseId="214" moduleId="341" step="chapter-pyq" />, { exam: neet });
    expect(screen.getByRole('link', { name: 'Start Test' })).toHaveAttribute('href', '/neet/tests/chapter-pyq/341');
    expect(await screen.findByText('20 Mins')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Review Solutions' })).toHaveAttribute('href', '/neet/tests/chapter-pyq/result/77');
  });

  it('opens the chapter menu on mobile', async () => {
    server.use(sidebar, http.get(`${API}/api/neet/chapter-pyq-exam/previous-attempts/341`, () => ok({ submissions: [] })));
    renderWithProviders(<ChapterScreen courseId="214" moduleId="341" step="chapter-pyq" />, { exam: neet });
    await userEvent.click(screen.getByRole('button', { name: 'Chapter Menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Chapter menu' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close chapter menu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
