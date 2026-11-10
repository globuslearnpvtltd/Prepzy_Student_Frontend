import { LEARN_MOCKS } from './mocks-learn';
import { NEET_LEARN_MOCKS } from './mocks-neet-learn';
import { PLAN_MOCKS } from './mocks-plans';
import { TEST_MOCKS } from './mocks-tests';
import { ACCOUNT_MOCKS } from './mocks-account';
import { ASSISTANT_MOCKS } from './mocks-assistant';
import { GAP_MOCKS } from './mocks-gaps';
import { SCHOOLS_MOCKS } from './mocks-schools';
import { PARTNER_MOCKS } from './mocks-partners';
import { PARENT_MOCKS } from './mocks-parents';
import { VOICE_MOCKS } from './mocks-voice';
/**
 * Sample backend responses for visual comparison. Both the old app and the new app call the same
 * backend URLs, so one table drives screenshots of both. Unlisted endpoints get `{ success: true, data: [] }`.
 * Add entries here when porting a page so old and new render the same data.
 */
export const student = {
  account_id: 1,
  first_name: 'Ravi',
  last_name: 'Kumar',
  phone: '+919876543210',
  email: 'ravi@example.com',
  class: 12,
  gender: 'male',
  status: 1,
};

export const plansFor = (exam: 'board' | 'competitive') => ({
  success: true,
  data: {
    plans: [
      exam === 'competitive'
        ? { plan_id: 3, exam_id: 2, class_id: 20, class_name: 'NEET', stream_name: '', duration_months: 12, expiry_date: '2027-05-01', status: 'active' }
        : { plan_id: 3, exam_id: 1, class_id: 12, class_name: 'CLASS 12', stream_name: 'PCB', duration_months: 12, expiry_date: '2027-05-01', status: 'active' },
    ],
  },
});

const week = { Monday: 1.5, Tuesday: 2, Wednesday: 0.5, Thursday: 3, Friday: 1, Saturday: 2.5, Sunday: 0 };
const graph = {
  success: true,
  data: {
    overall_percent: 64,
    result_data: [
      { subject: 'Physics', thisAttempt: 48, lastAttempt: 55 },
      { subject: 'Chemistry', thisAttempt: 66, lastAttempt: 60 },
      { subject: 'Biology', thisAttempt: 72, lastAttempt: 65 },
    ],
  },
};

const questions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    question_id: i + 1,
    question_text: i === 0 ? '<p>Which organelle is known as the <b>powerhouse of the cell</b>?</p>' : `<p>Question ${i + 1}</p>`,
    options: [
      { option_id: 1, text: 'Ribosome' },
      { option_id: 2, text: 'Mitochondria' },
      { option_id: 3, text: 'Golgi apparatus' },
      { option_id: 4, text: 'Lysosome' },
    ],
    selected_option: i > 0 && i < 6 ? 2 : null,
    status: i > 0 && i < 6 ? 'answered' : i >= 6 && i < 9 ? 'skipped' : i === 9 ? 'marked_for_review' : 'not_visited',
  }));

export const MOCKS: Record<string, unknown> = {
  '/api/accounts': { success: true, data: student },
  '/api/auth/getStudentDetails': { success: true, user: { ...student, target_exam: 'CBSE' } },
  '/api/v1/student/exams/purchased': {
    success: true,
    data: {
      exams: [
        { exam_id: 1, exam_slice: 'cbse', exam_name: 'CBSE' },
        { exam_id: 2, exam_slice: 'neet-ug', exam_name: 'NEET-UG' },
      ],
    },
  },
  '/api/exam-list': {
    success: true,
    data: [
      { exam_id: 1, exam_name: 'CBSE', exam_slice: 'cbse' },
      { exam_id: 2, exam_name: 'NEET-UG', exam_slice: 'neet-ug' },
      { exam_id: 3, exam_name: 'JEE', exam_slice: 'jee' },
    ],
  },
  // Board dashboard
  '/api/v1/student/classes/12/subjects': {
    success: true,
    data: {
      subjects: ['Physics', 'Chemistry', 'Biology', 'English'].map((s, i) => ({
        subject_id: i + 1,
        subject_name: s,
        subject_description: `${s} for Class 12`,
        course_count: 2,
        module_count: 14,
      })),
    },
  },
  '/api/v1/student/continue-dashboard-courses/12': {
    success: true,
    data: {
      courses: [
        {
          course_id: 5,
          course_name: 'Electrostatics',
          class_name: 'Class 12',
          subject_name: 'Physics',
          completed_learn_items: 6,
          total_learn_items: 20,
          progress_percentage: 30,
          upcoming_learn_item: { id: 9, type: 'lecture', module: 2, category: 'lecture' },
        },
      ],
    },
  },
  '/api/v1/student/continue-dashboard-exams/12': {
    success: true,
    data: { exams: [{ set_id: 8, set_number: 2, exam_type: 'mock', subject_id: 1, progress_percentage: 40, class_name: 'Class 12', duration: 180 }] },
  },
  '/api/v1/student/fetchLearnerBoardData/class': { success: true, data: { week_activity: week, performance: {} } },
  '/api/v1/student/getsubjectGraphData/12': graph,
  '/api/v1/student/getsubjectGraphData/20': graph,
  '/api/referral/me': { success: true, data: { balance: 120 } },
  '/api/v1/study-plan/status/12': { success: true, data: { has_plan: false } },
  // NEET dashboard
  '/api/neet/subject-progress': {
    success: true,
    data: [
      ['Botany', 6, 18],
      ['Zoology', 9, 19],
      ['Physics', 4, 20],
      ['Chemistry', 12, 20],
    ].map(([s, c, t]) => ({
      subject_name: `NEET-${s}`,
      completed_chapters: c,
      total_chapters: t,
      progress_percentage: Math.round((Number(c) / Number(t)) * 100),
      course_ids: [1],
    })),
  },
  '/api/neet/get-live-dpp-neet': {
    success: true,
    data: {
      dpp: { dpp_id: 9, dpp_name: 'Daily practice · 14 Nov', dpp_date: '2026-11-14' },
      questionCount: 15,
      subjects: [{ subject_id: 1, subject_name: 'Physics' }],
      attempt: null,
      attempted_questions: 0,
    },
  },
  '/api/neet/weekly-activity/class': { success: true, data: week },
  '/api/v4/dashboard/competitive/2/weekly-activity': { success: true, data: week },
  '/api/neet/v1/purchase/plan-summary': {
    success: true,
    data: { planName: 'NEET Topper', planType: 'topper', status: 'active', expiryDate: '2027-05-01', daysLeft: 170 },
  },
  // NEET tests
  '/api/neet/mock-exam/fetch-mock-exams': {
    success: true,
    data: {
      mockExams: [
        { set_id: 4, name: 'NEET Full Mock 1', duration: 180, question_count: 180, attempt_count: 1, status: 'completed' },
        { set_id: 5, name: 'NEET Full Mock 2', duration: 180, question_count: 180, attempt_count: 0, ongoing_session: { session_id: 1 } },
        { set_id: 6, name: 'NEET Full Mock 3', duration: 180, question_count: 180, attempt_count: 0 },
      ],
    },
  },
  '/api/neet/mock-exam/fetch-mock-best-score': { success: true, data: { bestScore: { obtained: 486, total: 720 } } },
  '/api/neet/mock-exam/fetch-recent-mock-attempts': {
    success: true,
    data: { attempts: [{ attempt_id: 1, set_id: 4, name: 'NEET Full Mock 1', duration: 180, total_marks: 720, total_marks_obtained: 486, attempt_date: '2026-11-10T09:30:00Z' }] },
  },
  '/api/neet/mock-exam/start-mock-exam': {
    success: true,
    data: { set_id: 4, session_id: 1, session_expiry_time: new Date(Date.now() + 2 * 3600_000).toISOString(), questions: questions(24) },
  },
  '/api/neet/mock-exam/get-mock-result': {
    success: true,
    data: {
      summary: { attempt_id: 1, set_id: 4, name: 'NEET Full Mock 1', attempt_number: 1, total_questions: 2, total_marks: 720, total_marks_obtained: 486, attempt_date: '2026-11-10T09:30:00Z' },
      questions: [
        {
          question_id: 1,
          question_text: 'Which organelle is known as the powerhouse of the cell?',
          options: [
            { option_id: 1, text: 'Ribosome' },
            { option_id: 2, text: 'Mitochondria' },
            { option_id: 3, text: 'Golgi apparatus' },
          ],
          selected_option_id: 1,
          correct_option_id: 2,
          is_correct: 0,
          explanation: '<p>Mitochondria produce most of the cell ATP.</p>',
        },
      ],
    },
  },
  ...TEST_MOCKS, // tests & exams (visual/mocks-tests.ts)
  ...NEET_LEARN_MOCKS, // NEET learn & notes (visual/mocks-neet-learn.ts)
  ...PLAN_MOCKS, // plans, checkout, billing, welcome (visual/mocks-plans.ts)
  ...LEARN_MOCKS, // board learn, courses & notes (visual/mocks-learn.ts)
  ...ACCOUNT_MOCKS, // study plan, diagnostic, refer & earn, profile (visual/mocks-account.ts)
  ...ASSISTANT_MOCKS, // doubt solver & Atlas chat (visual/mocks-assistant.ts)
  ...GAP_MOCKS, // board custom tests, no-plan widgets, chapter-PYQ attempts (visual/mocks-gaps.ts)
  ...SCHOOLS_MOCKS, // schools (teacher) portal (visual/mocks-schools.ts)
  ...PARTNER_MOCKS, // partners portal (visual/mocks-partners.ts)
  ...PARENT_MOCKS, // parents portal (visual/mocks-parents.ts)
  ...VOICE_MOCKS, // live voice talk start / save (visual/mocks-voice.ts)
};

// The new app reads NEET subject progress from the v4 backend (same body).
MOCKS['/api/v4/dashboard/competitive/2/subject-progress'] = MOCKS['/api/neet/subject-progress'];
// The new app reads the CBSE dashboard from the v4 backend (same bodies).
MOCKS['/api/v4/dashboard/board/1/overview'] = MOCKS['/api/v1/student/fetchLearnerBoardData/class'];
MOCKS['/api/v4/dashboard/board/1/classes/12/subjects'] = MOCKS['/api/v1/student/classes/12/subjects'];
MOCKS['/api/v4/dashboard/board/1/classes/12/continue-courses'] = MOCKS['/api/v1/student/continue-dashboard-courses/12'];
MOCKS['/api/v4/dashboard/board/1/classes/12/continue-exams'] = MOCKS['/api/v1/student/continue-dashboard-exams/12'];
MOCKS['/api/v4/dashboard/board/1/classes/12/subject-scores'] = MOCKS['/api/v1/student/getsubjectGraphData/12'];
MOCKS['/api/v4/dashboard/competitive/2/classes/20/subject-scores'] = MOCKS['/api/v1/student/getsubjectGraphData/20'];
MOCKS['/api/v4/student/account'] = MOCKS['/api/accounts'];
MOCKS['/api/v4/student/exams/purchased'] = MOCKS['/api/v1/student/exams/purchased'];
MOCKS['/api/v4/student/plans/2/summary'] = MOCKS['/api/neet/v1/purchase/plan-summary'];
MOCKS['/api/v4/exams'] = {
  success: true,
  message: 'Exams fetched',
  data: [
    { exam_id: 1, exam_name: 'CBSE', exam_slice: 'cbse', category: 'board' },
    { exam_id: 2, exam_name: 'NEET-UG', exam_slice: 'neet-ug', category: 'competitive' },
  ],
};

// The new app reads the learn pages from the v4 backend (`learn` module). Same data as the old keys above
// (the old app keeps using those); only the envelope differs where the old route didn't use one.
const v4 = (data: unknown) => ({ success: true, message: 'ok', data });
const dataOf = (path: string) => (MOCKS[path] as { data?: unknown }).data;
const oldClasses = dataOf('/api/class-list');
MOCKS['/api/v4/learn/board/1/classes'] = v4({ classes: oldClasses });
MOCKS['/api/v4/learn/competitive/2/classes'] = v4({ classes: oldClasses });
MOCKS['/api/v4/learn/classes/subscribed'] = MOCKS['/api/subscribed-class'];
MOCKS['/api/v4/learn/board/1/textbooks'] = v4(MOCKS['/api/v2/get-textbooks']);
for (const subject of [1, 2, 3, 4]) {
  const old = dataOf(`/api/v1/student/getCourselist-dashboard/12/${subject}`) as { result: unknown[] };
  MOCKS[`/api/v4/learn/classes/12/subjects/${subject}/courses`] = v4({ courses: old.result });
}
MOCKS['/api/v4/learn/free-courses'] = MOCKS['/api/v1/student/free-courses'];
MOCKS['/api/v4/learn/courses/5/outline'] = MOCKS['/api/v1/learn/module-outline/5'];
MOCKS['/api/v4/learn/courses/5/modules/2'] = MOCKS['/api/v1/learn/module-details/2/5'];
MOCKS['/api/v4/learn/lectures/8'] = MOCKS['/api/v1/learn/lectures/8'];
MOCKS['/api/v4/learn/lectures/8/transcript'] = MOCKS['/api/v1/learn/transcript/8'];
MOCKS['/api/v4/learn/courses/7'] = MOCKS['/api/courses/7'];
MOCKS['/api/v4/learn/courses/7/curriculum'] = v4(MOCKS['/api/course_outline_overview/7']);
MOCKS['/api/v4/learn/modules/2/pyqs'] = MOCKS['/api/v1/learn/chapter-pyqs/2'];
MOCKS['/api/v4/learn/modules/2/ncert-questions'] = MOCKS['/api/v1/learn/chapter-ncert-questions/2'];
MOCKS['/api/v4/learn/modules/2/ncert-questions/count'] = MOCKS['/api/v1/learn/chapter-ncert-questions/2/count'];
MOCKS['/api/v4/learn/modules/2/pyq-attempts'] = v4({
  attempts: (MOCKS['/api/v1/exams/chapter-pyqs/previous-attempts/2'] as { submissions: { grade: string }[] }).submissions.map(
    ({ grade, ...attempt }, index) => ({ ...attempt, percentage: Number(grade), is_latest: index === 0 }),
  ),
});
// NEET learn & notes (competitive exam 2): same data as the /api/neet/* keys in mocks-neet-learn.ts.
const neetLearn = '/api/v4/learn/competitive/2';
const percentOf = (attempt: { percentage?: unknown }) => parseFloat(String(attempt.percentage));
const asAttempts = (path: string) =>
  v4({ attempts: ((MOCKS[path] as { submissions: { percentage?: unknown }[] }).submissions).map((a) => ({ ...a, percentage: percentOf(a) })) });
MOCKS[`${neetLearn}/classes/20/notes/subjects`] = v4({ subjects: dataOf('/api/neet/summary-notes/subjects') });
const neetNotesChapters = MOCKS['/api/neet/summary-notes/chapters'] as { summary: unknown; data: unknown };
MOCKS[`${neetLearn}/classes/20/notes/chapters`] = v4({ summary: neetNotesChapters.summary, chapters: neetNotesChapters.data });
const neetCourse = MOCKS['/api/neet/module-list/214'] as { total_modules: number; summary: unknown; data: unknown };
MOCKS[`${neetLearn}/courses/214/chapters`] = v4({ total_modules: neetCourse.total_modules, summary: neetCourse.summary, chapters: neetCourse.data });
for (const moduleId of [339, 340, 341, 342, 343]) {
  MOCKS[`${neetLearn}/chapters/${moduleId}`] = v4({ chapter: (dataOf(`/api/neet/ChapterSidebar/${moduleId}`) as unknown[])[0] });
}
MOCKS[`${neetLearn}/chapters/341/summary-video`] = v4({ video: (dataOf('/api/neet/sumamry-video/341') as unknown[])[0] });
MOCKS[`${neetLearn}/chapters/341/notes`] = MOCKS['/api/neet/get-summar-notes/341'];
MOCKS[`${neetLearn}/chapters/341/practice`] = MOCKS['/api/neet/unit-test-assessment/341'];
MOCKS[`${neetLearn}/practice/5231/attempts`] = asAttempts('/api/neet/quiz-exam/previous-attempts/5231');
MOCKS['/api/v4/learn/modules/341/pyq-attempts'] = asAttempts('/api/neet/chapter-pyq-exam/previous-attempts/341');
// The new app's Atlas (dashboard) chat reads the v4 chat routes (same bodies as the old keys above).
for (const [legacy, v4Chat] of [
  ['/api/v1/chat', '/api/v4/chat/board/1'],
  ['/api/neet/chat', '/api/v4/chat/competitive/2'],
] as const) {
  MOCKS[`${v4Chat}/dashboard/conversation`] = MOCKS[`${legacy}/dashboard-conversations`];
  MOCKS[`${v4Chat}/dashboard/chats`] = MOCKS[`${legacy}/dashboard-chat-history`];
  MOCKS[`${v4Chat}/dashboard/avatar`] = MOCKS[`${legacy}/marketingChatImageName`];
}
// Lecture tutor avatars (board course 5, NEET course 214), same body as the old avatar key.
MOCKS['/api/v4/chat/board/1/lectures/5/avatar'] = MOCKS['/api/v1/chat/marketingChatImageName'];
MOCKS['/api/v4/chat/competitive/2/lectures/214/avatar'] = MOCKS['/api/neet/chat/marketingChatImageName'];
// The new app's doubt solver (Socrates) reads v4 routes; same data as the old keys in mocks-assistant.ts.
MOCKS['/api/v4/learn/competitive/2/textbooks'] = v4(MOCKS['/api/neet/doubt-solver-subjects']);
MOCKS['/api/v4/learn/courses/11/outline'] = MOCKS['/api/v1/learn/module-outline/11'];
MOCKS['/api/v4/learn/modules/401/ncert-questions'] = MOCKS['/api/v1/learn/chapter-unsolved/401'];
MOCKS['/api/v4/learn/modules/401/pyqs'] = MOCKS['/api/v1/learn/chapter-pyqs/401'];
for (const doubts of ['/api/v4/chat/board/1/doubts', '/api/v4/chat/competitive/2/doubts']) {
  MOCKS[`${doubts}/check`] = v4({ valid: true });
  MOCKS[`${doubts}/extract-question`] = v4({ text: '', diagrams: [], image_url: null });
  // GET (history) and POST (start a doubt) share the path here (mocks are per path): one body serves both.
  const history = MOCKS['/api/chat/step_solver_chat/history'] as { data: object };
  MOCKS[`${doubts}/chats`] = v4({ ...history.data, chat_id: 900 });
  const reply = MOCKS['/api/chat/step_solver_chat_interaction/v2'] as { chat_id: number; llm_responses: string; is_first_query: boolean; current_card_no: number };
  MOCKS[`${doubts}/chats/900/ask`] = v4({ ...reply, text: reply.llm_responses, image: null, reached_final_solution: false });
  MOCKS[`${doubts}/chats/900/concept-cards`] = v4(MOCKS['/api/chat/step_solver_concept_card/v1']);
}
