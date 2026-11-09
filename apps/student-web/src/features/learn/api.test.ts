import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import {
  activityHref,
  assessmentLabel,
  assessmentTestType,
  formatTitle,
  learnApi,
  resolveVideoSource,
  text,
  titleCase,
  toActivity,
  toArray,
  toQuestion,
  toVideos,
} from './api';

describe('learn helpers', () => {
  it('formats titles like the previous app', () => {
    expect(formatTitle('the laws OF motion ii')).toBe('The Laws of Motion II');
    expect(formatTitle(null)).toBe('');
    expect(titleCase('CLASS 12_science')).toBe('Class 12 Science');
  });

  it('reads text and JSON-string arrays', () => {
    expect(text(' null ')).toBeNull();
    expect(text(12)).toBe('12');
    expect(toArray('[{"a":1}]')).toEqual([{ a: 1 }]);
    expect(toArray('nope')).toEqual([]);
    expect(toArray({})).toEqual([]);
  });

  it('maps activities to the player or the exam engine', () => {
    const lecture = toActivity({ category: 'lecture', id: 7, module: 3 })!;
    expect(activityHref('cbse', '5', lecture)).toBe('/cbse/learn/5/3/lecture/7');
    const quiz = toActivity({ category: 'assessment', id: 9, type: 'unit_test' })!;
    expect(activityHref('cbse', '5', quiz)).toBe('/cbse/tests/quiz/9');
    expect(activityHref('cbse', '5', { category: 'assessment', id: '1', moduleId: null, type: 'odd' })).toBe('/cbse/assessments');
    expect(toActivity(null)).toBeNull();
    expect(toActivity({ category: 'lecture' })).toBeNull();
    expect(assessmentTestType('mid_term_exam')).toBe('mid');
    expect(assessmentTestType(null)).toBeNull();
    expect(assessmentLabel('final_exam')).toBe('Final Exam');
    expect(assessmentLabel(undefined)).toBe('Assessment');
  });

  it('resolves YouTube, file and HeyGen video links', () => {
    expect(resolveVideoSource('https://youtu.be/abcdefghijk')).toMatchObject({ kind: 'youtube', id: 'abcdefghijk' });
    expect(resolveVideoSource('https://cdn.test/v.mp4')).toEqual({ kind: 'file', url: 'https://cdn.test/v.mp4' });
    expect(resolveVideoSource('abc123')).toEqual({ kind: 'file', url: 'https://resource2.heygen.ai/video/abc123/1280x720.mp4' });
    expect(resolveVideoSource('  ')).toBeNull();
    expect(toVideos('[{"language":"hindi","link":"x"},{"language":"english"}]')).toEqual([{ language: 'hindi', link: 'x' }]);
  });

  it('normalises questions with options, parts and answers', () => {
    const q = toQuestion(
      {
        id: 4,
        type: 'case_based',
        year: 2023,
        marks: '4',
        question_text: '<p>Read</p>',
        difficulty: 'hard',
        options: '[{"id":"a","option_text":"A","is_correct":1}]',
        sub_questions: [
          { id: 1, sub_question_text: 'Why?', marks: 1, sample_answer: 'Because' },
          { id: 2, sub_question_text: 'Pick', options: [{ id: 'b', text: 'B' }], correct_answer: 'b' },
        ],
      },
      0,
    );
    expect(q).toMatchObject({ id: '4', year: '2023', marks: 4, difficulty: 'hard' });
    expect(q.options[0]).toMatchObject({ html: 'A', correct: true });
    expect(q.subQuestions.map((s) => s.answerHtml)).toEqual(['Because', 'B']);
    expect(toQuestion({}, 3)).toMatchObject({ id: '3', type: '', difficulty: null, options: [] });
  });
});

describe('learnApi', () => {
  it('reads subjects, continue courses and subject courses', async () => {
    server.use(
      http.get(`${API}/api/v1/student/classes/12/subjects`, () =>
        HttpResponse.json({ success: true, data: { subjects: [{ subject_id: 1, subject_name: 'PHYSICS', course_count: 2, image: 'null' }] } }),
      ),
      http.get(`${API}/api/v1/student/continue-dashboard-courses/12`, () =>
        HttpResponse.json({
          success: true,
          data: { courses: [{ course_id: 5, course_name: 'Optics', progress_percentage: 33.6, upcoming_learn_item: { category: 'lecture', id: 8, module: 2 } }] },
        }),
      ),
      http.get(`${API}/api/v1/student/getCourselist-dashboard/12/1`, () =>
        HttpResponse.json({ success: true, data: { result: [{ course_id: 5, title: 'Optics', unique_lecture: 4, assessment_count: 2, module_count: 3 }] } }),
      ),
    );
    expect(await learnApi.subjects(12)).toEqual([{ id: '1', name: 'PHYSICS', courseCount: 2, image: null, description: null }]);
    expect((await learnApi.continueCourses(12))[0]).toMatchObject({ percent: 34, next: { id: '8', moduleId: '2' } });
    expect((await learnApi.subjectCourses(12, '1'))[0]).toMatchObject({ lectureCount: 4, testCount: 2, chapterCount: 3 });
  });

  it('reads the outline and a chapter', async () => {
    server.use(
      http.get(`${API}/api/v1/learn/module-outline/5`, () =>
        HttpResponse.json({
          success: true,
          data: {
            finalList: [
              { category: 'module', id: 2, title: 'Light', module_order: 1 },
              { category: 'assessment', id: 9, type: 'final_exam', title: 'Final' },
            ],
            courseDetail: { course_id: 5, course_name: 'Optics', class_name: 'CLASS 10', subject_name: 'SCIENCE', class_id: 12 },
          },
        }),
      ),
      http.get(`${API}/api/v1/learn/module-details/2/5`, () =>
        HttpResponse.json({
          success: true,
          data: {
            finalList: [{ category: 'lecture', id: 8, title: 'Mirrors', isCompleted: true }, { category: 'other' }],
            module_data: { title: 'Light', orders: 1 },
            summary_videos: [
              { type: 'video', id: 3, student_side_active: 1 },
              { type: 'notes', id: 4, student_side_active: 1 },
              { type: 'notes', id: 5, student_side_active: 0 },
            ],
          },
        }),
      ),
    );
    const outline = await learnApi.outline('5');
    expect(outline.chapters).toEqual([{ id: '2', title: 'Light', order: 1 }]);
    expect(outline.exams[0]).toMatchObject({ type: 'final_exam' });
    expect(outline.course).toMatchObject({ subjectName: 'SCIENCE', classId: '12' });
    const chapter = await learnApi.module('5', '2');
    expect(chapter.items).toEqual([{ kind: 'lecture', id: '8', title: 'Mirrors', type: null, completed: true }]);
    expect(chapter.summaries.map((s) => s.type)).toEqual(['notes', 'video']);
  });

  it('reads lectures, transcripts and progress steps', async () => {
    server.use(
      http.get(`${API}/api/v1/learn/lectures/8`, () =>
        HttpResponse.json({ success: true, data: { lecture: { lecture_id: 8, title: 'Mirrors', course_id: 5, module_id: 2, videos: '[{"language":"english","link":"abc"}]' } } }),
      ),
      http.get(`${API}/api/v1/learn/transcript/8`, () => HttpResponse.json({ success: true, data: { transcript: 'Hello<br />' } })),
      http.put(`${API}/api/v1/learn/progress-update/course/5/lecture/8/complete`, () =>
        HttpResponse.json({ success: true, data: { activity: null } }),
      ),
      http.post(`${API}/api/v1/learn/previousActivity`, () =>
        HttpResponse.json({ success: false, message: 'No data', data: { activity: null } }),
      ),
      http.post(`${API}/api/lectures/8/refresh-videos`, () => HttpResponse.json({ success: true, data: { videos: [{ language: 'english', link: 'new' }] } })),
      http.get(`${API}/api/v1/learn/chapter-ncert-questions/2/count`, () => HttpResponse.error()),
    );
    expect(await learnApi.lecture('8')).toMatchObject({ courseId: '5', moduleId: '2', videos: [{ language: 'english', link: 'abc' }] });
    expect(await learnApi.transcript('8')).toBe('Hello<br />');
    expect(await learnApi.completeLecture('5', '8')).toBeNull();
    expect(await learnApi.previousActivity('5', '8')).toBeNull();
    expect(await learnApi.refreshVideos('8')).toEqual([{ language: 'english', link: 'new' }]);
    expect(await learnApi.ncertCount('2')).toBe(0);
  });

  it('reads the course catalogue', async () => {
    server.use(
      http.get(`${API}/api/class-list`, () => HttpResponse.json({ success: true, data: [{ class_id: 1, title: 'Class 11', stream_name: 'PCM' }] })),
      http.get(`${API}/api/v2/get-textbooks`, () =>
        HttpResponse.json({ subject_courses: [{ subject_id: 3, subject_name: 'Physics', textbooks: [{ id: 7, class_id: 1, textbook_name: 'Part 1' }] }] }),
      ),
      http.get(`${API}/api/courses/7`, () =>
        HttpResponse.json({ success: true, data: { course_id: 7, class: 1, title: 'Part 1', assessCounts: { quiz: 2, unit_test: 1 }, outcomes: '["Waves"]', lectureCount: 9 } }),
      ),
      http.get(`${API}/api/course_outline_overview/7`, () =>
        HttpResponse.json({
          finalList: [
            { category: 'module', id: 1, module_order: 1, title: 'units', lectures: [{ category: 'lecture', lecture_order: 1, title: 'intro' }, { category: 'assessment', type: 'quiz', title: 'q' }] },
            { category: 'assessment', type: 'mid_term_exam' },
          ],
        }),
      ),
      http.get(`${API}/api/subscribed-class`, () => HttpResponse.json({ success: true, data: { classIds: [1] } })),
    );
    expect(await learnApi.classes()).toEqual([{ id: '1', title: 'Class 11 - PCM' }]);
    expect((await learnApi.textbooks(''))[0]!.textbooks[0]).toMatchObject({ name: 'Part 1', subjectName: 'Physics' });
    expect(await learnApi.course('7')).toMatchObject({ classId: '1', quizCount: 3, outcomes: ['Waves'], lectureCount: 9 });
    const curriculum = await learnApi.curriculum('7');
    expect(curriculum[0]).toMatchObject({ title: 'Chapter 1 - Units', items: [{ label: '1 .', lecture: true }, { label: 'Quiz: .' }] });
    expect(curriculum[1]!.title).toBe('Mid Term Exam');
    expect(await learnApi.subscribedClasses()).toEqual(['1']);
  });
});
