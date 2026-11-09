/** Phase 2D mock data: study plan, diagnostic, refer & earn, profile. Spread into MOCKS in visual/mocks.ts. */

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const today = iso(0);

const days = Array.from({ length: 24 }, (_, i) => ({
  day_id: 100 + i,
  day_number: i + 1,
  plan_date: iso(i - 6),
  is_rest_day: i % 7 === 6,
  total_minutes: i % 7 === 6 ? 0 : 90,
  task_count: i % 7 === 6 ? 0 : 3,
  completed_count: i < 6 ? 3 : i === 6 ? 0 : 0,
  in_progress_count: i === 7 ? 1 : 0,
  is_completed: i < 6,
}));

const tasks = [
  { task_id: 1, task_code: 'L', label: 'Lecture', title: 'ELECTRIC CHARGES AND FIELDS', module_id: 4, module_title: 'Electric charges', subject_title: 'Physics', duration_minutes: 30, status: 'completed', is_completed: true, is_started: true, target: { type: 'lecture', course_id: 3, module_id: 4, lecture_id: 9 }, is_available: true },
  { task_id: 2, task_code: 'N', label: 'Notes', title: 'SOLUTIONS', module_id: 5, module_title: 'Solutions', subject_title: 'Chemistry', duration_minutes: 30, status: 'in_progress', is_completed: false, is_started: true, target: { type: 'notes', course_id: 7, module_id: 5 }, is_available: true },
  { task_id: 3, task_code: 'DS', label: 'Doubts', title: null, module_id: 5, module_title: null, subject_title: null, duration_minutes: 30, status: 'todo', is_completed: false, is_started: false, target: { type: 'doubt_solver' }, is_available: true },
];

const syllabus = {
  success: true,
  data: {
    rules: { min_chapters_total: 5, min_chapters_per_subject: 1, max_chapters_per_subject: 5, questions_per_subject: 10 },
    subject_chapter_list: [
      {
        class_id: 12,
        subject_id: 1,
        subject_name: 'Physics',
        subject_nature: 'numerical',
        course_count: 1,
        module_count: 4,
        courses: [
          {
            course_id: 3,
            course_name: 'Physics Part 1',
            module_count: 4,
            modules: ['ELECTRIC CHARGES AND FIELDS', 'ELECTROSTATIC POTENTIAL', 'CURRENT ELECTRICITY', 'MOVING CHARGES AND MAGNETISM'].map((name, i) => ({
              module_id: 4 + i,
              module_name: name,
              topic_count: 3 + i,
              available_question_count: 20,
              is_selectable: true,
            })),
          },
        ],
      },
      {
        class_id: 12,
        subject_id: 2,
        subject_name: 'Chemistry',
        subject_nature: 'theory',
        course_count: 1,
        module_count: 3,
        courses: [
          {
            course_id: 7,
            course_name: 'Chemistry Part 1',
            module_count: 3,
            modules: ['SOLUTIONS', 'ELECTROCHEMISTRY', 'CHEMICAL KINETICS'].map((name, i) => ({
              module_id: 20 + i,
              module_name: name,
              topic_count: 4,
              available_question_count: 20,
              is_selectable: true,
            })),
          },
        ],
      },
    ],
  },
};

const result = {
  success: true,
  data: {
    assessment_id: 31,
    status: 'submitted',
    attempt_number: 1,
    submitted_at: today,
    total_questions: 20,
    total_marks: 20,
    total_marks_obtained: 13,
    correct_answers: 13,
    incorrect_answers: 7,
    subject_strengths: [
      { subject_id: 1, name: 'Physics', nature: 'numerical', questions: 10, correct: 8, total: 10, obtained: 8, pct: 80 },
      { subject_id: 2, name: 'Chemistry', nature: 'theory', questions: 10, correct: 5, total: 10, obtained: 5, pct: 50 },
    ],
    chapter_strengths: [],
    profiling_parameters: {
      overall_percentage: 65,
      total_marks: 20,
      total_marks_obtained: 13,
      academic_band: 'proficient',
      subject_affinity: { strongest_subject_name: 'Physics', strongest_pct: 80, weakest_subject_name: 'Chemistry', weakest_pct: 50 },
      learning_pace: { pace_score: 1, band: 'normal', time_taken_seconds: 1100, total_time_seconds: 1500, questions_attempted: 20, total_questions: 20 },
      thinking_style: { code: 'C', label: 'Conceptual', leaning: 'conceptual', reason: 'clear_lead', confidence: 0.8, accuracies: { conceptual: 80, numerical: 50 } },
      key_strength: null,
      focus_area: null,
    },
    ai_summary: null,
  },
};

const questions = {
  success: true,
  data: {
    time_left: 1480,
    questions: Array.from({ length: 10 }, (_, i) => ({
      question_id: 500 + i,
      question_order: i + 1,
      question_type: 'conceptual',
      subject_id: 1,
      subject_name: 'Physics',
      module_id: 4,
      question_text: `<p>Which of the following is true about electric charge? (Q${i + 1})</p>`,
      question_image: null,
      marks: 1,
      options: ['It is quantised', 'It is not conserved', 'It is always positive', 'It has no unit'].map((text, n) => ({ option_index: n, option_text: text, option_image: null })),
      sub_questions: [],
      selected_answer: i < 3 ? { option_index: 0 } : null,
      status: i < 3 ? 'answered' : i === 3 ? 'skipped' : 'not_visited',
    })),
  },
};

const referralSummary = { code: 'RAVI12', shareLink: 'https://prepzy.ai/join?ref=RAVI12', tier: 'free', balance: 550, lifetimeEarned: 600, friendCount: 2, friendJoinCredit: 100 };

export const ACCOUNT_MOCKS: Record<string, unknown> = {
  // profile
  '/api/accounts': {
    success: true,
    data: { account_id: 1, first_name: 'Ravi', last_name: 'Kumar', phone: '+919876543210', email: 'ravi@example.com', class: 12, gender: 'male', status: 1, date_of_birth: '2008-02-16', city: 'Pune', address: 'MG Road', school: 'DPS Pune', completion_percentage: 70, updated_at: '2024-10-12T10:00:00Z', profile_picture: null },
  },
  '/api/class-list': { success: true, data: [{ class_id: 11, title: 'CLASS 11' }, { class_id: 12, title: 'CLASS 12' }] },
  '/api/mentor/v1/auth/get-mentor-data': { success: true, data: { mentor_data: null } },

  // referral (friends present → list, statement, money flow)
  '/api/referral/me': { success: true, data: referralSummary },
  '/api/referral/my-friends': {
    success: true,
    data: [
      { id: 1, status: 'paid', attributed_at: '2025-08-01', paid_at: '2025-09-05', friend_name: 'Riya Sharma', friend_phone: '+919812345678', exam_name: 'CBSE', signup_credit_amount: '25', conversion_credit_amount: '500' },
      { id: 2, status: 'joined', attributed_at: '2025-09-10', paid_at: null, friend_name: null, friend_phone: '+919123456789', exam_name: null, signup_credit_amount: '25', conversion_credit_amount: null },
    ],
  },
  '/api/referral/my-statement': {
    success: true,
    data: [
      { id: 3, entry_type: 'grant_signup', amount: '25', balance_after: '550', reason: null, referral_id: 2, exam_id: null, tier_snapshot: 'free', basis_snapshot: null, created_at: '2025-09-10T00:00:00Z' },
      { id: 2, entry_type: 'grant_conversion', amount: '500', balance_after: '525', reason: null, referral_id: 1, exam_id: 1, tier_snapshot: 'free', basis_snapshot: { paidAmount: 4999 }, created_at: '2025-09-05T00:00:00Z' },
      { id: 1, entry_type: 'grant_signup', amount: '25', balance_after: '25', reason: null, referral_id: 1, exam_id: null, tier_snapshot: 'free', basis_snapshot: null, created_at: '2025-08-01T00:00:00Z' },
    ],
  },
  '/api/referral/earn-rates': {
    success: true,
    data: [{ id: 1, exam_id: null, exam_name: null, conversion_type: 'percent', signup_credit_free: '25', signup_credit_paid: '50', conversion_rate_free: '10', conversion_rate_paid: '20', conversion_floor: '50', conversion_cap: '500', conversion_flat_amount: null }],
  },

  // study plan
  '/api/v1/study-plan/status/12': { success: true, data: { state: 'ready', can_create: true, allowed_plan_types: ['learning_cum_practice', 'revision'], has_plan: true, active_plan_id: 41, exam_date: null, max_target_date: null } },
  '/api/v1/study-plan/12': {
    success: true,
    data: {
      plan: { plan_id: 41, plan_type: 'learning_cum_practice', status: 'active', start_date: iso(-6), target_date: iso(17), daily_minutes: 90, total_days: 24, chapter_count: 6, daily_hours: 1.5, combo_id: null, tasks_purged: false },
      days,
    },
  },
  [`/api/v1/study-plan/day/41/${today}`]: { success: true, data: { tasks } },
  '/api/v1/study-plan/dashboard/12': { success: true, data: { state: 'tasks_partial', width: 'full', task_count: 3, completed_count: 1 } },

  // diagnostic
  '/api/v1/diagnostic/status/12': { success: true, data: { state: 'available', can_attempt: true } },
  '/api/v1/diagnostic/subject-chapter-list/12': syllabus,
  '/api/v1/diagnostic/diagnostic-results/12': result,
  '/api/v1/diagnostic/fetch-questions/31': questions,
};
