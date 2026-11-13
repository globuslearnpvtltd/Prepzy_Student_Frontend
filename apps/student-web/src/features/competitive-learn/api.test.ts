import { http, HttpResponse } from 'msw';
import { LEARN_API, learnApiBase } from '@/shared/config/exams';
import { API, server } from '@/test/server';
import { testExam } from '@/test/exams';
import { learnApi, toNotesChapters, toSummaryVideo, toVideoParts } from './api';

const neet = testExam('neet');
const BASE = `${API}${learnApiBase(neet)}`;
const ok = (data: unknown, message?: string) => HttpResponse.json({ success: true, message, data });
const fail = (status: number) => HttpResponse.json({ success: false, message: 'Server error' }, { status });

describe('competitive learn mapping edge cases', () => {
  it('counts notes chapters itself when the summary is missing', () => {
    const notes = toNotesChapters({
      data: [
        { module_id: 1, course_id: 2, module_order: '1', module_title: 'A', lock_content: '1', notes_status: 'completed' },
        { module_id: 3, course_id: 2, notes_status: 'in_progress' },
        { module_id: 4, course_id: 2 },
      ],
    });
    expect(notes.chapters.map((c) => [c.status, c.locked])).toEqual([
      ['completed', true],
      ['in_progress', false],
      ['not_started', false],
    ]);
    expect(notes).toMatchObject({ total: 3, completed: 1 });
    expect(toNotesChapters({ data: 'x' })).toEqual({ chapters: [], total: 0, completed: 0 });
  });

  it('reads video links as JSON strings, bare URLs or junk', () => {
    expect(toVideoParts('  ')).toEqual([]);
    expect(toVideoParts('not json')).toEqual([]);
    expect(toVideoParts('https://cdn.test/v.mp4', 'Intro')).toEqual([
      { label: 'Part 1', sources: [{ language: 'default', title: 'Intro', url: 'https://cdn.test/v.mp4' }] },
    ]);
    expect(toVideoParts('{"en":{"p1":{"video_link":"u"}},"hi":null}', 'T')).toEqual([
      { label: 'p1', sources: [{ language: 'en', title: 'T', url: 'u' }] },
    ]);
    expect(toVideoParts([1])).toEqual([]);
    expect(toSummaryVideo(null)).toBeNull();
    expect(toSummaryVideo({ summary_video_status: 'completed', new_video_link: '' })).toEqual({ title: null, parts: [], completed: false });
  });
});

describe('learnApi requests', () => {
  it('calls the v4 learn routes with the class, subject and chapter', async () => {
    let subjectParam: string | null = null;
    server.use(
      http.get(`${BASE}/classes/20/notes/subjects`, () => ok({ subjects: [{ subject_id: 7, subject_name: 'NEET-Physics', total_chapters: '4' }] })),
      http.get(`${BASE}/classes/20/notes/chapters`, ({ request }) => {
        subjectParam = new URL(request.url).searchParams.get('subject_id');
        return ok({ chapters: [{ module_id: 1, course_id: 2 }], summary: { total_chapters: 9, completed_chapters: 2 } });
      }),
      http.get(`${BASE}/courses/2/chapters`, () => ok({ chapters: [], summary: { notes: { completed: '3' } } })),
      http.get(`${BASE}/chapters/1`, () => ok({ chapter: { module_id: 1, module_title: 'Kinematics' } })),
      http.get(`${BASE}/chapters/1/summary-video`, () => ok({ video: [{ title: 'Recap', new_video_link: { en: { p1: { video_link: 'u' } } } }] })),
      http.get(`${BASE}/chapters/1/notes`, () => ok({ notes_text: '<p>x</p>', is_completed: true })),
      http.post(`${BASE}/chapters/1/notes/complete`, () => ok(null, 'Notes completed')),
      http.get(`${BASE}/chapters/1/practice`, () => ok({ assessment_id: 55 })),
      http.get(`${BASE}/practice/55/attempts`, () => ok({ attempts: [{ attempt_id: 1, total_marks_obtained: 4 }] })),
      http.get(`${API}${LEARN_API}/modules/1/pyq-attempts`, () => ok({ attempts: [{ attempt_id: 2 }] })),
    );

    expect(await learnApi.notesSubjects(neet, 20)).toEqual([{ id: '7', name: 'Physics', total: 4, completed: 0 }]);
    expect(await learnApi.notesChapters(neet, 20, '7')).toMatchObject({ total: 9, completed: 2 });
    expect(subjectParam).toBe('7');
    expect((await learnApi.course(neet, '2')).done).toEqual({ videos: 0, notes: 3, tests: 0, pyqs: 0 });
    expect(await learnApi.chapter(neet, '1')).toMatchObject({ moduleId: '1', title: 'Kinematics', status: 'not_started' });
    expect((await learnApi.summaryVideo(neet, '1'))?.parts).toHaveLength(1);
    expect(await learnApi.studyNotes(neet, '1')).toMatchObject({ html: '<p>x</p>', completed: true });
    expect(await learnApi.markComplete(neet, 'notes', '1')).toBe('Notes completed');
    expect(await learnApi.practiceAssessment(neet, '1')).toBe('55');
    expect((await learnApi.practiceAttempts(neet, '55'))[0]).toMatchObject({ attemptId: '1', marks: 4 });
    expect((await learnApi.chapterPyqAttempts('1'))[0]?.attemptId).toBe('2');
  });

  it('returns null for a missing chapter or practice id, but rethrows other errors', async () => {
    server.use(
      http.get(`${BASE}/chapters/404`, () => fail(404)),
      http.get(`${BASE}/chapters/1/practice`, () => ok(null)),
      http.get(`${BASE}/chapters/500`, () => fail(500)),
      http.get(`${BASE}/chapters/500/notes`, () => fail(500)),
      http.get(`${BASE}/chapters/500/practice`, () => fail(500)),
      http.get(`${BASE}/chapters/2`, () => ok({})),
    );
    expect(await learnApi.chapter(neet, '404')).toBeNull();
    expect(await learnApi.chapter(neet, '2')).toBeNull();
    expect(await learnApi.practiceAssessment(neet, '1')).toBeNull();
    await expect(learnApi.chapter(neet, '500')).rejects.toMatchObject({ status: 500 });
    await expect(learnApi.studyNotes(neet, '500')).rejects.toMatchObject({ status: 500 });
    await expect(learnApi.practiceAssessment(neet, '500')).rejects.toMatchObject({ status: 500 });
  });
});
