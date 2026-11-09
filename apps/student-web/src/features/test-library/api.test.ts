import { http, HttpResponse } from 'msw';
import { notFound } from 'next/navigation';
import { getExam } from '@/shared/config/exams';
import { API, server } from '@/test/server';
import { libraryApi, subjectName } from './api';
import { boardCustomApi } from './board-custom-api';
import { examForCategory } from './route-guard';

const neet = getExam('neet')!;
const ok = (body: Record<string, unknown> = {}) => HttpResponse.json({ success: true, ...body });

describe('examForCategory', () => {
  it('returns the exam of the right category and 404s otherwise', () => {
    expect(examForCategory('neet', 'competitive')).toBe(neet);
    expect(notFound).not.toHaveBeenCalled();
    examForCategory('cbse', 'competitive');
    examForCategory('gate', 'board');
    expect(notFound).toHaveBeenCalledTimes(2);
  });
});

describe('libraryApi with sparse backend payloads', () => {
  it('board subjects and papers fall back to empty lists and computed stats', async () => {
    server.use(
      http.get(`${API}/api/v4/assessments/board/subjects`, () => ok()),
      http.get(`${API}/api/mock-exams/fetch-mock-sets`, () => ok()),
    );
    expect(await libraryApi.boardSubjects(12, 'pyq')).toEqual([]);
    expect(await libraryApi.boardPapers('mock', '3', 12)).toEqual({
      papers: [],
      stats: { total: 0, completed: 0, inProgress: 0, pending: 0 },
      subjects: [],
    });
  });

  it('board papers: counts statuses locally and maps the subject filter', async () => {
    server.use(
      http.get(`${API}/api/pyq-exams/fetch-pyq-sets`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('status')).toBe('completed');
        return ok({
          data: {
            papers: [
              { set_id: 1, status: 'completed', latest_mark: '40', total_marks: '70', duration: '3 hrs', current_progress: '50' },
              { set_id: 2, status: 'in_progress' },
              { set_id: 3 },
            ],
            filterOptions: { subjectOptions: [{ subjectId: 3, subject: 'Physics' }] },
          },
        });
      }),
    );
    const list = await libraryApi.boardPapers('pyq', '3', 12, 'completed');
    expect(list.stats).toEqual({ total: 3, completed: 1, inProgress: 1, pending: 1 });
    expect(list.subjects).toEqual([{ id: '3', title: 'Physics', count: 0 }]);
    expect(list.papers[0]).toMatchObject({ setNumber: '1', lastScore: 40, maxScore: 70, durationLabel: '3 hrs', progress: 50 });
    expect(list.papers[2]).toMatchObject({ lastScore: null, progress: null, year: null });
  });

  it('library sets, best score and attempts tolerate missing fields', async () => {
    server.use(
      http.get(`${API}/api/neet/pyq-exam/fetch-pyq-exams`, () =>
        ok({ data: { pyqExams: [{ set_id: 4, name: 'By name', subjectName: 'neet-physics' }, { set_id: 5 }] } }),
      ),
      http.get(`${API}/api/neet/mock-exam/fetch-subject-mock-exams`, () => ok({ data: {} })),
      http.get(`${API}/api/neet/mock-exam/fetch-mock-subject-best-score`, () => ok({ data: { bestScore: null } })),
      http.get(`${API}/api/neet/mock-exam/fetch-recent-subject-mock-attempts`, () =>
        ok({ data: { attempts: [{ attempt_id: 1, set_id: 2, title: 'Subject mock' }] } }),
      ),
      http.get(`${API}/api/neet/pyq-exam/fetch-pyq-attempts`, () =>
        ok({ data: { title: 'PYQ 2024', attempts: [{ attempt_id: 3, attempt_number: 2 }] } }),
      ),
      http.get(`${API}/api/neet/pyq-exam/fetch-recent-pyq-attempts`, () => ok()),
    );
    const sets = await libraryApi.librarySets(neet, 20, 'pyq', 'full');
    expect(sets.map((s) => [s.name, s.subjectName, s.status, s.remainingSeconds])).toEqual([
      ['By name', 'Physics', 'pending', null],
      ['Paper 5', null, 'pending', null],
    ]);
    expect(await libraryApi.librarySets(neet, 20, 'mock', 'subject')).toEqual([]);
    expect(await libraryApi.bestScore(neet, 20, 'mock', 'subject')).toBeNull();
    expect(await libraryApi.recentAttempts(neet, 20, 'mock', 'subject')).toEqual([
      { attemptId: '1', setId: '2', name: 'Subject mock', obtained: 0, total: 0, date: null },
    ]);
    expect(await libraryApi.recentAttempts(neet, 20, 'pyq', 'subject')).toEqual([]);
    expect(await libraryApi.setAttempts('pyq', '7')).toEqual([
      { attemptId: '3', setId: '7', name: 'PYQ 2024 · Attempt 2', obtained: 0, total: 0, date: null },
    ]);
  });

  it('custom tests: defaults for untitled sets and attempts', async () => {
    server.use(
      http.get(`${API}/api/neet/custom-exam/saved-tests`, () =>
        ok({ sets: [{ set_id: 1, set_number: 4, subject_name: 'neet-biology', in_progress: 1 }] }),
      ),
      http.get(`${API}/api/neet/custom-exam/past-attempts`, () => ok({ attempts: [{ attempt_id: 2, subject_name: 'CHEMISTRY' }] })),
    );
    expect((await libraryApi.savedCustomTests())[0]).toMatchObject({
      title: 'Custom test 4',
      subject: 'Biology',
      topics: [],
      difficulty: 'medium',
      inProgress: true,
      createdAt: null,
    });
    expect((await libraryApi.pastCustomAttempts())[0]).toMatchObject({ title: 'Custom test', subject: 'Chemistry', difficulty: 'medium' });

    server.use(
      http.get(`${API}/api/neet/custom-exam/saved-tests`, () => ok()),
      http.get(`${API}/api/neet/custom-exam/past-attempts`, () => ok()),
    );
    expect(await libraryApi.savedCustomTests()).toEqual([]);
    expect(await libraryApi.pastCustomAttempts()).toEqual([]);
  });

  it('custom subjects accept course ids as a list or a comma string', async () => {
    server.use(
      http.get(`${API}/api/v4/dashboard/neet/subject-progress`, () =>
        ok({
          data: [
            { subject_name: 'neet-physics', course_ids: '11,12', total_chapters: 20 },
            { subject_name: 'Biology', course_ids: [13] },
            { subject_name: 'Chemistry', course_ids: null },
          ],
        }),
      ),
    );
    expect(await libraryApi.customSubjects()).toEqual([
      { name: 'Physics', courseIds: ['11', '12'], chapterCount: 20 },
      { name: 'Biology', courseIds: ['13'], chapterCount: 0 },
      { name: 'Chemistry', courseIds: [], chapterCount: 0 },
    ]);
    server.use(http.get(`${API}/api/v4/dashboard/neet/subject-progress`, () => ok()));
    expect(await libraryApi.customSubjects()).toEqual([]);
  });

  it('custom chapters, topics and generation handle empty answers', async () => {
    server.use(
      http.get(`${API}/api/neet/custom-exam/chapters/:id`, () => ok()),
      http.get(`${API}/api/neet/custom-exam/topics/:id`, () => ok()),
      http.post(`${API}/api/neet/custom-exam/generate`, () => ok({ set_id: null })),
    );
    expect(await libraryApi.customChapters(['1', '2'])).toEqual([]);
    expect(await libraryApi.customTopics('5')).toEqual([]);
    expect(await libraryApi.generateCustomTest({ moduleId: '5', lectureIds: ['1'], difficulty: 'easy' })).toEqual({
      setId: null,
      message: null,
    });
  });

  it('DPP months and lists handle empty answers and unattempted papers', async () => {
    server.use(
      http.get(`${API}/api/neet/get-dpp-months`, () => ok()),
      http.get(`${API}/api/neet/get-dpp-list`, () => ok({ data: { list: [{ dpp_id: 1, attempted: 0, attempt_id: 9 }] } })),
    );
    expect(await libraryApi.dppMonths(neet)).toEqual([]);
    expect(await libraryApi.dppList(neet, 11, 2026)).toEqual([{ dppId: '1', name: 'Daily practice', date: null, attemptId: null }]);
    server.use(http.get(`${API}/api/neet/get-dpp-list`, () => ok()));
    expect(await libraryApi.dppList(neet, 11, 2026)).toEqual([]);
  });

  it('subjectName strips the NEET prefix and title-cases', () => {
    expect(subjectName('NEET-PHYSICS ')).toBe('Physics');
  });
});

describe('boardCustomApi with sparse payloads', () => {
  it('maps empty and partial answers', async () => {
    let search: string | null = 'unset';
    server.use(
      http.get(`${API}/api/custom-exams/get-custom-exam-course-list/:classId`, ({ request }) => {
        search = new URL(request.url).searchParams.get('search');
        return ok();
      }),
      http.get(`${API}/api/custom-exams/get-custom-exam-module-list/:courseId`, () =>
        ok({ modules: [{ module_id: '4', module_name: 'Optics', topics: null }] }),
      ),
      http.get(`${API}/api/custom-exams/get-custom-exam-set-list/:classId`, () =>
        ok({ sets: [{ set_id: 1, set_number: 3, total_questions: 'x' }, { set_id: 2, course_name: 'Physics', created_at: '2026-01-01' }] }),
      ),
      http.get(`${API}/api/custom-exams/custom-exam-submissions-list/:setId`, () =>
        ok({ submissions: [{ id: 1, created_at: '2026-01-02' }, { id: 2 }] }),
      ),
    );
    expect(await boardCustomApi.courses(12)).toEqual([]);
    expect(search).toBeNull();
    await boardCustomApi.courses(12, 'phy');
    expect(search).toBe('phy');
    expect(await boardCustomApi.chapters(5)).toEqual([{ id: 4, name: 'Optics', topics: [] }]);
    expect(await boardCustomApi.savedSets(12)).toEqual([
      { setId: '1', title: 'Custom test 3', questionCount: 0, difficulty: '', totalMarks: 0, createdAt: null },
      { setId: '2', title: 'Physics', questionCount: 0, difficulty: '', totalMarks: 0, createdAt: '2026-01-01' },
    ]);
    expect((await boardCustomApi.submissions('1')).map((s) => s.date)).toEqual(['2026-01-02', null]);

    server.use(
      http.get(`${API}/api/custom-exams/get-custom-exam-module-list/:courseId`, () => ok()),
      http.get(`${API}/api/custom-exams/get-custom-exam-set-list/:classId`, () => ok()),
      http.get(`${API}/api/custom-exams/custom-exam-submissions-list/:setId`, () => ok()),
    );
    expect(await boardCustomApi.chapters(5)).toEqual([]);
    expect(await boardCustomApi.savedSets(12)).toEqual([]);
    expect(await boardCustomApi.submissions('1')).toEqual([]);
  });

  it('generate returns null when no set was made', async () => {
    const chapter = { id: 4, name: 'Optics', topics: [{ id: 1, name: 'Lenses' }] };
    server.use(http.post(`${API}/api/custom-exams/generate-custom-exam`, () => ok({ set_id: 9, total: 0 })));
    expect(await boardCustomApi.generate({ courseId: 1, chapter, topicIds: [1], difficulty: 'easy' })).toBeNull();
    server.use(http.post(`${API}/api/custom-exams/generate-custom-exam`, () => ok()));
    expect(await boardCustomApi.generate({ courseId: 1, chapter, topicIds: [1], difficulty: 'easy' })).toBeNull();
  });
});
