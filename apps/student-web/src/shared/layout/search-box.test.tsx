import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { track } from '@/shared/analytics/track';
import { routes } from '@/shared/config/routes';
import { ApiError } from '@/shared/lib/errors';
import { testExam } from '@/test/exams';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { SearchBox, searchErrorText } from './search-box';
import { resultLinks } from './search-results';
import type { LectureSearchResult } from './shell-api';

vi.mock('@/shared/analytics/track', () => ({ track: vi.fn() }));

const cbse = testExam('cbse');
const neet = testExam('neet');
const tracked = vi.mocked(track);

const plans = http.get(`${API}/api/v4/student/plans/active`, () =>
  HttpResponse.json({
    success: true,
    data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 12', duration_months: 12, status: 'active', expiry_date: '2027-05-01' }] },
  }),
);

const suggestionsFor = (exam: typeof cbse, rows: Record<string, unknown>[]) =>
  http.get(`${API}/api/v4/search/${exam.category}/${exam.examId}/suggestions`, () =>
    HttpResponse.json({ success: true, data: { suggestions: rows } }),
  );

const boardTopic = {
  result_id: 4,
  result_name: 'COULOMB LAW',
  result_type: 'topic',
  subject_name: 'PHYSICS',
  class_name: 'CLASS 12',
  course_id: 7,
  module_id: 8,
  module_name: null,
  anchor_id: null,
};

const competitiveRows = [
  { result_name: 'Cell cycle', result_type: 'topic', module_name: 'Cell Division', subject_name: 'NEET-BOTANY', course_id: 3, module_id: 9, anchor_id: 'cell-cycle' },
  { result_name: 'Cell Division', result_type: 'module', module_name: null, subject_name: 'NEET-BOTANY', course_id: 3, module_id: 9 },
  { result_name: 'Cell Biology', result_type: 'course', module_name: null, subject_name: 'NEET-BOTANY', course_id: 3, module_id: null },
];

const found = {
  lecture_id: 41,
  lecture_name: 'COULOMB LAW EXPLAINED',
  course_id: 7,
  module_id: 8,
  module_name: 'Electric Charges',
  subject_name: 'PHYSICS',
  score: 0.873,
  assessments: [
    { assessment_id: 90, title: 'CHARGES QUIZ', assessment_type: 'quiz' },
    { assessment_id: 91, title: 'Unit test 1', assessment_type: 'unit_test' },
    { assessment_id: 92, title: 'Recap', assessment_type: null },
  ],
};

/** Answers the lecture search with `result` (or an error) and records each request body. */
function lectureSearch(exam: typeof cbse, reply: () => Response) {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${API}/api/v4/search/${exam.category}/${exam.examId}/lectures`, async ({ request }) => {
      bodies.push(await request.json());
      return reply();
    }),
  );
  return bodies;
}
const ok = (result: unknown) => () => HttpResponse.json({ success: true, data: { result } });

function renderBox(exam = cbse, onNavigate = vi.fn()) {
  renderWithProviders(<SearchBox exam={exam} onNavigate={onNavigate} />, { exam });
  return { box: screen.getByRole('combobox', { name: 'Search topics' }), onNavigate };
}

// jsdom can't follow links; the app's click handlers still run.
const stopLinkNavigation = (event: MouseEvent) => {
  if ((event.target as Element | null)?.closest?.('a')) event.preventDefault();
};

beforeEach(() => {
  server.use(plans, suggestionsFor(cbse, []), suggestionsFor(neet, []));
  window.addEventListener('click', stopLinkNavigation);
});

afterEach(() => window.removeEventListener('click', stopLinkNavigation));

describe('suggestions', () => {
  it('shows each suggestion with its type (topic, chapter, course)', async () => {
    server.use(suggestionsFor(neet, competitiveRows));
    const { box } = renderBox(neet);
    await userEvent.type(box, 'cell');
    const list = await screen.findByRole('listbox', { name: 'Suggestions' }, { timeout: 2000 });
    const options = within(list).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'cell cycleTopic · in cell divisionBotany',
      'cell divisionChapterBotany',
      'cell biologyCourseBotany',
    ]);
    expect(box).toHaveAttribute('aria-expanded', 'true');
  });

  it.each([
    [0, `${routes.learnModule('neet', 3, 9, 'study-notes')}#cell-cycle`],
    [1, routes.learnModule('neet', 3, 9, 'video-lectures')],
    [2, routes.learnCourse('neet', 3)],
  ])('competitive: suggestion %i opens its page', async (index, href) => {
    server.use(suggestionsFor(neet, competitiveRows));
    const { box, onNavigate } = renderBox(neet);
    await userEvent.type(box, 'cell');
    const options = await screen.findAllByRole('option', {}, { timeout: 2000 });
    await userEvent.click(options[index]!);
    expect(navigation.push).toHaveBeenCalledWith(href);
    expect(onNavigate).toHaveBeenCalled();
    expect(box).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it("board: a topic runs the lecture search for it with its subject and the student's class (as before)", async () => {
    server.use(suggestionsFor(cbse, [boardTopic]));
    const bodies = lectureSearch(cbse, ok(found));
    const { box } = renderBox(cbse);
    await userEvent.type(box, 'coul');
    await userEvent.click(await screen.findByRole('option', { name: /coulomb law/i }, { timeout: 2000 }));

    expect(await screen.findByRole('region', { name: 'Search results' })).toBeInTheDocument();
    expect(bodies).toEqual([{ query: 'COULOMB LAW', subject_name: 'PHYSICS', class_id: 12 }]);
    expect(box).toHaveValue('COULOMB LAW');
    expect(navigation.push).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('keyboard: arrows move through the options, Enter picks one, Escape closes the list', async () => {
    server.use(suggestionsFor(neet, competitiveRows));
    const { box } = renderBox(neet);
    await userEvent.type(box, 'cell');
    const options = await screen.findAllByRole('option', {}, { timeout: 2000 });

    await userEvent.keyboard('{ArrowDown}');
    expect(box).toHaveAttribute('aria-activedescendant', options[0]!.id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}');
    expect(box).toHaveAttribute('aria-activedescendant', options[2]!.id);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(box).toHaveAttribute('aria-activedescendant', options[1]!.id);

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(box).toHaveAttribute('aria-expanded', 'false');

    await userEvent.keyboard('{ArrowDown}');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(navigation.push).toHaveBeenCalledWith(`${routes.learnModule('neet', 3, 9, 'study-notes')}#cell-cycle`);
  });

  it('a click outside the box closes the list', async () => {
    server.use(suggestionsFor(neet, competitiveRows));
    const { box } = renderBox(neet);
    await userEvent.type(box, 'cell');
    await screen.findByRole('listbox', {}, { timeout: 2000 });
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });
});

describe('search button: results panel', () => {
  it('board: recommended video and the lecture assessments with their types, each linked to its page', async () => {
    const bodies = lectureSearch(cbse, ok(found));
    const { box, onNavigate } = renderBox(cbse);
    await userEvent.type(box, 'coulomb{Enter}');

    const panel = await screen.findByRole('region', { name: 'Search results' });
    expect(bodies).toEqual([{ query: 'coulomb', class_id: 12 }]);
    expect(within(panel).getByText('Recommended video')).toBeInTheDocument();
    const video = within(panel).getByRole('link', { name: /coulomb law explained/i });
    expect(video).toHaveTextContent('Video lesson • Match Score 87%');
    expect(video).toHaveAttribute('href', routes.lecture('cbse', 7, 8, 41));

    expect(within(panel).getByText('Practice & assess')).toBeInTheDocument();
    const quizzes = within(panel).getAllByRole('link').slice(1);
    expect(quizzes.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['charges quizquiz', routes.testPlayer('cbse', 'quiz', 90)],
      ['unit test 1unit test', routes.testPlayer('cbse', 'quiz', 91)],
      ['recapQuiz', routes.testPlayer('cbse', 'quiz', 92)],
    ]);
    expect(tracked).toHaveBeenCalledWith('search_performed', {
      exam_id: 'cbse',
      search_query: 'coulomb',
      results_count: 1,
      has_results: true,
    });

    fireEvent.click(quizzes[1]!);
    expect(tracked).toHaveBeenCalledWith('search_result_clicked', {
      exam_id: 'cbse',
      result_type: 'assessment',
      subject: null,
      chapter_name: 'Electric Charges',
      result_position: 3,
    });
    expect(onNavigate).toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument();
    expect(box).toHaveValue('');
  });

  it('competitive: the chapter with its video lesson, study notes and practice questions', async () => {
    const bodies = lectureSearch(neet, ok({ ...found, assessments: [] }));
    const { box } = renderBox(neet);
    await userEvent.type(box, 'cell cycle');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    const panel = await screen.findByRole('region', { name: 'Search results' });
    expect(bodies).toEqual([{ query: 'cell cycle', class_id: 12 }]);
    expect(within(panel).getByText('Chapter')).toBeInTheDocument();
    expect(within(panel).getByText('electric charges')).toBeInTheDocument();
    const links = within(panel).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Video LessonMatch Score 87%', routes.learnModule('neet', 7, 8, 'video-lectures')],
      ['Study NotesChapter notes & summary', routes.learnModule('neet', 7, 8, 'study-notes')],
      ['Practice QuestionsChapter assessment', routes.learnModule('neet', 7, 8, 'practice-questions')],
    ]);
    expect(within(panel).queryByText('Practice & assess')).not.toBeInTheDocument();

    fireEvent.click(links[1]!);
    expect(tracked).toHaveBeenCalledWith('search_result_clicked', expect.objectContaining({ exam_id: 'neet-ug', result_type: 'study_notes', result_position: 2 }));
  });

  it('shows a loading state, then an empty state when nothing matched', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.post(`${API}/api/v4/search/board/${cbse.examId}/lectures`, async () => {
        await gate;
        return HttpResponse.json({ success: true, data: { result: null } });
      }),
    );
    const { box } = renderBox(cbse);
    await userEvent.type(box, 'zzz{Enter}');
    expect(await screen.findByText('Finding relevant search results for you...')).toBeInTheDocument();
    release();
    expect(await screen.findByText('No matching lesson found')).toBeInTheDocument();
    expect(tracked).toHaveBeenCalledWith('search_performed', expect.objectContaining({ results_count: 0, has_results: false }));

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss search results' }));
    expect(screen.queryByText('No matching lesson found')).not.toBeInTheDocument();
    expect(box).toHaveValue('zzz');
  });

  it("shows the backend's message for a rejected search, and Try again searches again", async () => {
    let calls = 0;
    lectureSearch(cbse, () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ success: false, code: 'TOO_MANY_REQUESTS', message: 'Too many searches.' }, { status: 429 })
        : HttpResponse.json({ success: true, data: { result: found } });
    });
    const { box } = renderBox(cbse);
    await userEvent.type(box, 'coulomb{Enter}');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Search couldn't finish");
    expect(alert).toHaveTextContent('Too many searches.');

    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Search results' })).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('a failing search service shows a generic error', async () => {
    lectureSearch(cbse, () => HttpResponse.json({ success: false, code: 'SEARCH_UNAVAILABLE', message: 'agent down' }, { status: 502 }));
    const { box } = renderBox(cbse);
    await userEvent.type(box, 'coulomb{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent("Search couldn't finish right now. Please try again.");
  });

  it('typing again or Escape closes the results', async () => {
    lectureSearch(cbse, ok(found));
    const { box } = renderBox(cbse);
    await userEvent.type(box, 'coulomb{Enter}');
    await screen.findByRole('region', { name: 'Search results' });
    expect(box).toHaveAttribute('aria-expanded', 'true');

    await userEvent.type(box, 's');
    expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument();

    await userEvent.type(box, '{Enter}');
    await screen.findByRole('region', { name: 'Search results' });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument();
  });

  it('the arrow button is disabled while the box is empty, and blank text never searches', async () => {
    const bodies = lectureSearch(cbse, ok(found));
    const { box } = renderBox(cbse);
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    await userEvent.type(box, '   {Enter}');
    expect(bodies).toEqual([]);
  });
});

describe('result links and errors', () => {
  const result: LectureSearchResult = {
    lectureId: 41,
    lectureName: null,
    courseId: 7,
    moduleId: 8,
    moduleName: 'Charges',
    subjectName: null,
    scorePercent: null,
    assessments: [{ assessmentId: 90, title: 'Quiz', type: 'quiz' }],
  };

  it('numbers assessments after the other results; exams without quizzes list none', () => {
    expect(resultLinks(cbse, result).map((l) => [l.type, l.position])).toEqual([
      ['video_lesson', 1],
      ['assessment', 2],
    ]);
    expect(resultLinks(neet, result).map((l) => [l.type, l.position])).toEqual([
      ['video_lesson', 1],
      ['study_notes', 2],
      ['practice_question', 3],
    ]);
  });

  it('falls back to the chapter name and no score when the agent sent neither', async () => {
    lectureSearch(cbse, ok({ ...found, lecture_name: null, score: null, assessments: undefined }));
    const { box } = renderBox(cbse);
    await userEvent.type(box, 'x{Enter}');
    const video = await screen.findByRole('link', { name: /electric charges/i });
    expect(video).toHaveTextContent(/^electric chargesVideo lesson$/);
  });

  it('only 4xx messages are shown as they are', () => {
    expect(searchErrorText(new ApiError({ status: 404, code: 'CLASS_NOT_FOUND', message: 'Choose a class' }))).toBe('Choose a class');
    expect(searchErrorText(new ApiError({ status: 0, code: 'TIMEOUT', message: 'slow' }))).toMatch(/couldn't finish/);
    expect(searchErrorText(new Error('boom'))).toMatch(/couldn't finish/);
  });
});
