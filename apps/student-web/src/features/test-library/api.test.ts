import { http, HttpResponse } from 'msw';
import { notFound } from 'next/navigation';
import { getExam } from '@/shared/config/exams';
import { API, server } from '@/test/server';
import { libraryApi, subjectName } from './api';
import { boardCustomApi } from './board-custom-api';
import { examForCategory } from './route-guard';
import { testExam } from '@/test/exams';

const COMPETITIVE = { category: 'competitive', examId: 2 } as const;

const neet = testExam('neet');
const cbse = testExam('cbse');
const NEET_V4 = `${API}/api/v4/assessments/competitive/${neet.examId}`;
const CBSE_V4 = `${API}/api/v4/assessments/board/${cbse.examId}`;
const ok = (body: Record<string, unknown> = {}) => HttpResponse.json({ success: true, ...body });

describe('examForCategory', () => {
  it('returns the exam of the right category and 404s otherwise', () => {
    expect(examForCategory('neet', 'competitive')).toBe(getExam('neet'));
    expect(notFound).not.toHaveBeenCalled();
    examForCategory('cbse', 'competitive');
    examForCategory('gate', 'board');
    expect(notFound).toHaveBeenCalledTimes(2);
  });
});

describe('libraryApi with sparse backend payloads', () => {
  it('board subjects and papers fall back to empty lists and computed stats', async () => {
    server.use(
      http.get(`${CBSE_V4}/pyq/subjects`, () => ok()),
      http.get(`${CBSE_V4}/mock/sets`, () => ok()),
    );
    expect(await libraryApi.boardSubjects(cbse, 12, 'pyq')).toEqual([]);
    expect(await libraryApi.boardPapers(cbse, 'mock', '3', 12)).toEqual({
      papers: [],
      stats: { total: 0, completed: 0, inProgress: 0, pending: 0 },
      subjects: [],
    });
  });

  it('board papers: counts statuses locally and maps the subject filter', async () => {
    server.use(
      http.get(`${CBSE_V4}/pyq/sets`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect([query.get('status'), query.get('subject_id'), query.get('class_id')]).toEqual(['completed', '3', '12']);
        return ok({
          data: {
            papers: [
              { set_id: 1, status: 'completed', latest_marks: '40', total_marks: '70', duration: '3 hrs', current_progress: '50' },
              { set_id: 2, status: 'in_progress' },
              { set_id: 3 },
            ],
            subjects: [{ subject_id: 3, subject_title: 'Physics' }],
          },
        });
      }),
    );
    const list = await libraryApi.boardPapers(cbse, 'pyq', '3', 12, 'completed');
    expect(list.stats).toEqual({ total: 3, completed: 1, inProgress: 1, pending: 1 });
    expect(list.subjects).toEqual([{ id: '3', title: 'Physics', count: 0 }]);
    expect(list.papers[0]).toMatchObject({ setNumber: '1', lastScore: 40, maxScore: 70, durationLabel: '3 hrs', progress: 50 });
    expect(list.papers[2]).toMatchObject({ lastScore: null, progress: null, year: null });
  });

  it('library sets, best score and attempts tolerate missing fields', async () => {
    server.use(
      http.get(`${NEET_V4}/pyq/sets`, ({ request }) => {
        expect(new URL(request.url).search).toBe('');
        return ok({ data: { sets: [{ set_id: 4, name: 'By name', subject_name: 'neet-physics' }, { set_id: 5 }] } });
      }),
      http.get(`${NEET_V4}/mock/sets`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect([query.get('class_id'), query.get('variant')]).toEqual(['20', 'subject']);
        return ok({ data: {} });
      }),
      http.get(`${NEET_V4}/mock/best-score`, () => ok({ data: null })),
      http.get(`${NEET_V4}/mock/attempts`, () => ok({ data: [{ attempt_id: 1, set_id: 2, name: 'Subject mock' }] })),
      http.get(`${NEET_V4}/pyq/sets/:setId/attempts`, () =>
        ok({ data: { name: 'PYQ 2024', attempts: [{ attempt_id: 3, attempt_number: 2 }] } }),
      ),
      http.get(`${NEET_V4}/pyq/attempts`, () => ok()),
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
    expect(await libraryApi.setAttempts(neet, 'pyq', '7')).toEqual([
      { attemptId: '3', setId: '7', name: 'PYQ 2024 · Attempt 2', obtained: 0, total: 0, date: null },
    ]);
  });

  it('custom tests: defaults for untitled sets and attempts', async () => {
    server.use(
      http.get(`${NEET_V4}/custom/sets`, () =>
        ok({ data: { sets: [{ set_id: 1, set_number: 4, subject_name: 'neet-biology', in_progress: true }] } }),
      ),
      http.get(`${NEET_V4}/custom/attempts`, () => ok({ data: [{ attempt_id: 2, subject_name: 'CHEMISTRY' }] })),
    );
    expect((await libraryApi.savedCustomTests(neet))[0]).toMatchObject({
      title: 'Custom test 4',
      subject: 'Biology',
      topics: [],
      difficulty: 'medium',
      inProgress: true,
      createdAt: null,
    });
    expect((await libraryApi.pastCustomAttempts(neet))[0]).toMatchObject({ title: 'Custom test', subject: 'Chemistry', difficulty: 'medium' });

    server.use(
      http.get(`${NEET_V4}/custom/sets`, () => ok()),
      http.get(`${NEET_V4}/custom/attempts`, () => ok()),
    );
    expect(await libraryApi.savedCustomTests(neet)).toEqual([]);
    expect(await libraryApi.pastCustomAttempts(neet)).toEqual([]);
  });

  it('custom subjects accept course ids as a list or a comma string', async () => {
    server.use(
      http.get(`${API}/api/v4/dashboard/competitive/2/subject-progress`, () =>
        ok({
          data: [
            { subject_name: 'neet-physics', course_ids: '11,12', total_chapters: 20 },
            { subject_name: 'Biology', course_ids: [13] },
            { subject_name: 'Chemistry', course_ids: null },
          ],
        }),
      ),
    );
    expect(await libraryApi.customSubjects(COMPETITIVE)).toEqual([
      { id: '', name: 'Physics', courseIds: ['11', '12'], chapterCount: 20 },
      { id: '', name: 'Biology', courseIds: ['13'], chapterCount: 0 },
      { id: '', name: 'Chemistry', courseIds: [], chapterCount: 0 },
    ]);
    server.use(http.get(`${API}/api/v4/dashboard/competitive/2/subject-progress`, () => ok()));
    expect(await libraryApi.customSubjects(COMPETITIVE)).toEqual([]);
  });

  it('custom chapters, topics and generation handle empty answers', async () => {
    server.use(
      http.get(`${NEET_V4}/custom/chapters/3`, () => ok()),
      http.get(`${NEET_V4}/custom/chapters/5/topics`, () => ok()),
      http.post(`${NEET_V4}/custom/sets`, async ({ request }) => {
        expect(await request.json()).toEqual({ module_id: 5, topic_ids: [1], difficulty_level: 'easy' });
        return ok({ message: 'No questions available', data: { set_id: null, total: 0 } });
      }),
    );
    expect(await libraryApi.customChapters(neet, '3')).toEqual([]);
    expect(await libraryApi.customTopics(neet, '5')).toEqual([]);
    expect(await libraryApi.generateCustomTest(neet, { moduleId: '5', lectureIds: ['1'], difficulty: 'easy' })).toEqual({
      setId: null,
      message: 'No questions available',
    });
    server.use(http.post(`${NEET_V4}/custom/sets`, () => ok({ message: 'Custom test created', data: { set_id: 77 } })));
    expect(await libraryApi.generateCustomTest(neet, { moduleId: '5', lectureIds: ['1'], difficulty: 'easy' })).toEqual({
      setId: '77',
      message: null,
    });
  });

  it('DPP months and lists handle empty answers and unattempted papers', async () => {
    server.use(
      http.get(`${NEET_V4}/dpp/months`, () => ok()),
      http.get(`${NEET_V4}/dpp/sets`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect([query.get('month'), query.get('year')]).toEqual(['11', '2026']);
        return ok({ data: [{ dpp_id: 1, attempted: false, attempt_id: 9 }] });
      }),
    );
    expect(await libraryApi.dppMonths(neet)).toEqual([]);
    expect(await libraryApi.dppList(neet, 11, 2026)).toEqual([{ dppId: '1', name: 'Daily practice', date: null, attemptId: null }]);
    server.use(http.get(`${NEET_V4}/dpp/sets`, () => ok()));
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
      http.get(`${CBSE_V4}/custom/courses`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect(query.get('class_id')).toBe('12');
        search = query.get('search');
        return ok();
      }),
      http.get(`${CBSE_V4}/custom/courses/5/modules`, () => ok({ data: [{ module_id: '4', module_name: 'Optics', topics: null }] })),
      http.get(`${CBSE_V4}/custom/sets`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('class_id')).toBe('12');
        return ok({
          data: { sets: [{ set_id: 1, set_number: 3, total_questions: 'x' }, { set_id: 2, course_name: 'Physics', created_at: '2026-01-01' }] },
        });
      }),
      http.get(`${CBSE_V4}/custom/sets/:setId/attempts`, () =>
        ok({ data: { attempts: [{ attempt_id: 1, attempt_date: '2026-01-02' }, { attempt_id: 2 }] } }),
      ),
    );
    expect(await boardCustomApi.courses(cbse, 12)).toEqual([]);
    expect(search).toBeNull();
    await boardCustomApi.courses(cbse, 12, 'phy');
    expect(search).toBe('phy');
    expect(await boardCustomApi.chapters(cbse, 5)).toEqual([{ id: 4, name: 'Optics', topics: [] }]);
    expect(await boardCustomApi.savedSets(cbse, 12)).toEqual([
      { setId: '1', title: 'Custom test 3', questionCount: 0, difficulty: '', totalMarks: 0, createdAt: null },
      { setId: '2', title: 'Physics', questionCount: 0, difficulty: '', totalMarks: 0, createdAt: '2026-01-01' },
    ]);
    expect((await boardCustomApi.submissions(cbse, '1')).map((s) => [s.attemptId, s.date])).toEqual([
      ['1', '2026-01-02'],
      ['2', null],
    ]);

    server.use(
      http.get(`${CBSE_V4}/custom/courses/5/modules`, () => ok()),
      http.get(`${CBSE_V4}/custom/sets`, () => ok()),
      http.get(`${CBSE_V4}/custom/sets/:setId/attempts`, () => ok()),
    );
    expect(await boardCustomApi.chapters(cbse, 5)).toEqual([]);
    expect(await boardCustomApi.savedSets(cbse, 12)).toEqual([]);
    expect(await boardCustomApi.submissions(cbse, '1')).toEqual([]);
  });

  it('generate returns null when no set was made', async () => {
    const chapter = { id: 4, name: 'Optics', topics: [{ id: 1, name: 'Lenses' }] };
    server.use(http.post(`${CBSE_V4}/custom/sets`, () => ok({ data: { set_id: 9, total: 0 } })));
    expect(await boardCustomApi.generate(cbse, { chapter, topicIds: [1], difficulty: 'easy' })).toBeNull();
    server.use(http.post(`${CBSE_V4}/custom/sets`, () => ok()));
    expect(await boardCustomApi.generate(cbse, { chapter, topicIds: [1], difficulty: 'easy' })).toBeNull();
  });
});
