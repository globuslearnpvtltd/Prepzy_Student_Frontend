/** Sample backend responses for the test pages (players, results, hubs). Spread into MOCKS in mocks.ts. */
const boardQuestions = [
  {
    question_id: 1,
    question_type: 'mcq',
    question_text: '<p>Which of the following is the SI unit of electric charge?</p>',
    marks: 1,
    options: [
      { option_id: 11, option_text: 'Ampere' },
      { option_id: 12, option_text: 'Coulomb' },
      { option_id: 13, option_text: 'Volt' },
      { option_id: 14, option_text: 'Ohm' },
    ],
    sub_questions: [],
    selected_answer: { text: 12, images: [] },
    status: 'saved',
  },
  {
    question_id: 2,
    question_type: 'mcq',
    question_text: '<p>The force between two charges is given by which law?</p>',
    marks: 1,
    options: [
      { option_id: 21, option_text: "Ohm's law" },
      { option_id: 22, option_text: "Coulomb's law" },
      { option_id: 23, option_text: "Faraday's law" },
      { option_id: 24, option_text: "Lenz's law" },
    ],
    sub_questions: [],
    status: 'skipped',
  },
  {
    question_id: 3,
    question_type: 'short_answer',
    question_text: '<p>State Gauss’s law in electrostatics.</p>',
    marks: 3,
    options: [],
    sub_questions: [],
  },
  {
    question_id: 4,
    question_type: 'long_answer',
    question_text: '<p>Derive an expression for the electric field due to an infinitely long straight charged wire.</p>',
    marks: 5,
    options: [],
    sub_questions: [],
  },
];

const boardResponses = [
  {
    id: 1,
    question_type: 'mcq',
    question_text: '<p>Which of the following is the SI unit of electric charge?</p>',
    total_marks: 1,
    marks_obtained: 1,
    feedback: '<p>Correct. Charge is measured in coulomb.</p>',
    options: [
      { option_id: 11, option_text: 'Ampere', isSelected: false, isCorrectAnswer: false },
      { option_id: 12, option_text: 'Coulomb', isSelected: true, isCorrectAnswer: true },
      { option_id: 13, option_text: 'Volt', isSelected: false, isCorrectAnswer: false },
    ],
  },
  {
    id: 3,
    question_type: 'short_answer',
    question_text: '<p>State Gauss’s law in electrostatics.</p>',
    total_marks: 3,
    marks_obtained: 2,
    selected_answer: { text: '<p>Flux through a closed surface equals charge enclosed by epsilon zero.</p>', images: [] },
    feedback: '<p>Good. Mention that the surface is arbitrary.</p>',
    sample_answer: '<p>The total electric flux through any closed surface is 1/ε0 times the charge enclosed.</p>',
    options: [],
  },
];

const neetItems = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    set_id: i + 4,
    name: `${prefix} ${i + 1}`,
    title: `${prefix} ${i + 1}`,
    year: 2024 - i,
    board: 'NTA',
    setName: null,
    question_category: 'previous_year',
    duration: 180,
    question_count: 180,
    attempt_count: i === 0 ? 1 : 0,
    status: i === 0 ? 'completed' : i === 1 ? 'in_progress' : 'pending',
    ongoing_session:
      i === 1 ? { session_id: 1, start_time: '2026-11-10T09:00:00Z', expiry_time: '2026-11-10T12:00:00Z', remaining_seconds: 5400 } : null,
  }));

const attempt = (name: string) => ({
  attempt_id: 1,
  set_id: 4,
  name,
  title: name,
  year: 2024,
  board: 'NTA',
  setName: null,
  duration: 180,
  total_marks: 720,
  total_marks_obtained: 486,
  attempt_date: '2026-11-10T09:30:00Z',
});

export const TEST_MOCKS: Record<string, unknown> = {
  // Board player + result
  '/api/v1/exams/mock-exam/fetch-mock-questions': { success: true, questions: boardQuestions, time_left: 7200 },
  '/api/v1/exams/mock-exam/fetch-mock-responses': {
    success: true,
    marks: { total_marks: 4, total_marks_obtained: 3 },
    responses: boardResponses,
  },
  '/api/mock-exams/fetchAssessmentId': { success: true, set_id: 8 },
  // Board listings
  '/api/active-exams': {
    success: true,
    mock_result: [
      { subject_id: 1, subject_title: 'Physics', exam_count: 3 },
      { subject_id: 2, subject_title: 'Chemistry', exam_count: 2 },
    ],
    pyq_result: [{ subject_id: 1, subject_title: 'Physics', exam_count: 2 }],
  },
  '/api/mock-exams/fetch-mock-sets': {
    success: true,
    data: {
      papers: [
        { set_id: 8, set_number: 1, subject: 'Physics', totalQuestion: 33, status: 'completed', total_marks: 70, latest_mark: 52, attempt_id: 300, duration: '3 hrs', attempts: 1, last_attempted_date: '2026-11-08T10:00:00Z' },
        { set_id: 9, set_number: 2, subject: 'Physics', totalQuestion: 33, status: 'in_progress', total_marks: 70, duration: '3 hrs', attempts: 0, current_progress: 40 },
        { set_id: 10, set_number: 3, subject: 'Physics', totalQuestion: 33, status: 'pending', total_marks: 70, duration: '3 hrs', attempts: 0 },
      ],
      stats: { totalPaper: 3, inProgress: 1, completed: 1, pending: 1 },
      filters: { selectedSubject: '1', selectedClass: null, selectedStatus: null },
      filterOptions: { subjectOptions: [{ subjectId: 1, subject: 'Physics' }, { subjectId: 2, subject: 'Chemistry' }] },
    },
  },
  '/api/pyq-exams/fetch-pyq-sets': {
    success: true,
    data: {
      papers: [
        { set_id: 18, set_number: 1, year: 2024, subject: 'Physics', totalQuestion: 33, status: 'pending', total_marks: 70, duration: '3 hrs', attempts: 0 },
        { set_id: 19, set_number: 1, year: 2023, subject: 'Physics', totalQuestion: 33, status: 'completed', total_marks: 70, latest_mark: 61, attempt_id: 301 },
      ],
      stats: { totalPaper: 2, inProgress: 1, completed: 1, pending: 1 },
      filters: { selectedSubject: '1', selectedClass: null, selectedStatus: null },
      filterOptions: { subjectOptions: [{ subjectId: 1, subject: 'Physics' }, { subjectId: 2, subject: 'Chemistry' }] },
    },
  },
  // NEET hubs
  '/api/neet/mock-exam/fetch-mock-exams': { success: true, data: { mockExams: neetItems('NEET Full Mock', 3) } },
  '/api/neet/mock-exam/fetch-subject-mock-exams': {
    success: true,
    data: {
      mockExams: neetItems('Physics Mock', 2).map((m) => ({ ...m, subjectId: 1, subjectName: 'NEET-Physics', duration: 60, question_count: 45 })),
    },
  },
  '/api/neet/mock-exam/fetch-mock-best-score': { success: true, data: { bestScore: { obtained: 486, total: 720 } } },
  '/api/neet/mock-exam/fetch-mock-subject-best-score': { success: true, data: { bestScore: { obtained: 140, total: 180 } } },
  '/api/neet/mock-exam/fetch-recent-mock-attempts': { success: true, data: { attempts: [attempt('NEET Full Mock 1')] } },
  '/api/neet/mock-exam/fetch-recent-subject-mock-attempts': { success: true, data: { attempts: [] } },
  '/api/neet/pyq-exam/fetch-pyq-exams': { success: true, data: { pyqExams: neetItems('NEET', 3) } },
  '/api/neet/pyq-exam/fetch-pyq-best-score': { success: true, data: { bestScore: { obtained: 512, total: 720 } } },
  '/api/neet/pyq-exam/fetch-recent-pyq-attempts': { success: true, data: { attempts: [attempt('NEET 2024')] } },
  '/api/neet/custom-exam/saved-tests': {
    success: true,
    sets: [
      {
        set_id: 1,
        set_number: 1,
        subject_name: 'NEET-Biology',
        module_id: 14,
        module_name: 'Cell: The Unit of Life',
        topics: [{ lecture_id: 1, title: 'Cell theory' }, { lecture_id: 2, title: 'Cell organelles' }],
        difficulty_level: 'medium',
        total_questions: 20,
        total_marks: 80,
        created_at: '2026-11-09T10:00:00Z',
        attempt_count: 1,
        latest_attempt_id: 64,
        in_progress: false,
      },
    ],
  },
  '/api/neet/custom-exam/past-attempts': {
    success: true,
    attempts: [
      {
        attempt_id: 64,
        set_id: 1,
        attempt_number: 1,
        subject_name: 'NEET-Biology',
        module_name: 'Cell: The Unit of Life',
        topics: [{ lecture_id: 1, title: 'Cell theory' }],
        difficulty_level: 'medium',
        total_questions: 20,
        total_marks: 80,
        total_marks_obtained: 56,
        attempt_date: '2026-11-09T10:30:00Z',
      },
    ],
  },
  '/api/neet/custom-exam/chapters/1': {
    success: true,
    chapters: [
      { module_id: 14, module_name: 'Cell: The Unit of Life', topic_count: 6 },
      { module_id: 15, module_name: 'Biomolecules', topic_count: 5 },
    ],
  },
  '/api/neet/custom-exam/topics/14': {
    success: true,
    topics: [
      { lecture_id: 1, title: 'Cell theory' },
      { lecture_id: 2, title: 'Cell organelles' },
      { lecture_id: 3, title: 'Cell membrane' },
    ],
  },
  '/api/neet/get-dpp-months': { success: true, data: { months: [{ year: 2026, month: 11, first_dpp_id: 7 }, { year: 2026, month: 10, first_dpp_id: 3 }] } },
  '/api/neet/get-dpp-list': {
    success: true,
    data: {
      list: [
        { dpp_id: 7, dpp_name: 'Daily practice · 12 Nov', dpp_date: '2026-11-12', attempted: 1, attempt_id: 55 },
        { dpp_id: 8, dpp_name: 'Daily practice · 13 Nov', dpp_date: '2026-11-13', attempted: 0, attempt_id: null },
      ],
    },
  },
};
