/** Schools (teacher) portal: school, class stats, student list and one student's activity. */
export const SCHOOLS_MOCKS: Record<string, unknown> = {
  '/api/mentor/v1/auth/get-teacher-info': {
    success: true,
    data: {
      teacher_data: {
        account_id: 11,
        first_name: 'Anita',
        last_name: 'Rao',
        email: 'anita.rao@greenfield.edu',
        phone: '9876543210',
      },
    },
  },
  '/api/mentor/v1/schools/get-school-info': {
    success: true,
    data: {
      institution_data: {
        institute_id: 3,
        institute_name: 'Greenfield Public School',
        institute_code: 'GPS01',
        address: 'Bengaluru',
        is_active: 1,
        student_count: 42,
        class_count: 3,
        class_list: [
          { class_id: 10, class_name: 'Class 10', stream_name: 'CBSE' },
          { class_id: 9, class_name: 'Class 9', stream_name: 'CBSE' },
          { class_id: 12, class_name: 'Class 12', stream_name: 'Science' },
        ],
      },
    },
  },
  '/api/mentor/v1/schools/get-hours-data': {
    success: true,
    data: { student_count: 18, unique_students: 12, total_hours: 36.5 },
  },
  '/api/mentor/v1/schools/get-student-list': {
    success: true,
    data: {
      student_list: [
        { account_id: 7, first_name: 'Aarav', last_name: 'Sharma' },
        { account_id: 8, first_name: 'Diya', last_name: 'Patel' },
        { account_id: 9, first_name: 'Kabir', last_name: 'Singh' },
        { account_id: 10, first_name: 'Meera', last_name: 'Iyer' },
        { account_id: 12, first_name: 'Rohan', last_name: 'Gupta' },
        { account_id: 13, first_name: 'Sara', last_name: 'Khan' },
        { account_id: 14, first_name: 'Vihaan', last_name: 'Reddy' },
      ],
    },
  },
  '/api/mentor/v1/schools/get-feature-usage': {
    success: true,
    data: {
      avg_exam_attempts: 4,
      chat_doubts: 23,
      total_lectures: 15,
      total_doubt_solver_chats: 9,
      custom_exam_count: 3,
      post_assessment_chat: 6,
    },
  },
  '/api/mentor/v1/schools/get-student-info': {
    success: true,
    data: {
      student_data: {
        account_id: 7,
        first_name: 'Aarav',
        last_name: 'Sharma',
        school: 'Greenfield Public School',
        class_title: 'Class 10',
        created_at: '2025-06-12T10:00:00.000Z',
      },
    },
  },
  '/api/mentor/v1/schools/get-student-learning-hours-info': {
    success: true,
    data: {
      graph_data: { Sun: 0.5, Mon: 1.25, Tue: 0.75, Wed: 2, Thu: 1, Fri: 0.25, Sat: 1.5, Today: 0.8 },
      study_engagement: {
        this_week: { total_hours: 6.5, hours: 6, minutes: 30 },
        total_since_joining_hours: 48,
        avg_minutes_per_active_day: 55,
      },
    },
  },
  '/api/mentor/v1/schools/get-student-video-completion-info': {
    success: true,
    data: {
      video_completion: {
        total: 14,
        subjects: [
          { subject_id: 1, subject_name: 'Science', count: 6 },
          { subject_id: 2, subject_name: 'Mathematics', count: 5 },
          { subject_id: 3, subject_name: 'English', count: 3 },
        ],
        chapters: ['Light', 'Polynomials', 'Life Processes', 'A Letter to God'],
      },
    },
  },
  '/api/mentor/v1/schools/get-student-doubts-section-info': {
    success: true,
    data: {
      doubts: {
        total: 31,
        subjects: [
          { name: 'Science', count: 8, color: '#3D348B', width: '57%' },
          { name: 'Mathematics', count: 6, color: '#F6A635', width: '43%' },
        ],
        categories: [
          { label: 'ATLAS', count: 14, color: '#3D348B' },
          { label: 'Lecture Chat', count: 9, color: '#F6A635' },
          { label: 'Doubt Solver', count: 8, color: '#10B981' },
          { label: 'Post Assessment Chat', count: 0, color: '#3D348B' },
        ],
      },
    },
  },
  '/api/mentor/v1/schools/get-student-assessment-section-info': {
    success: true,
    data: {
      assessments: {
        total: 12,
        categories: [
          { label: 'Quiz', count: 4, percentage: 78 },
          { label: 'Unit Tests', count: 2, percentage: 64 },
          { label: 'Mock Tests', count: 1, percentage: 52 },
          { label: 'PYQs', count: 3, percentage: 70 },
          { label: 'Midterm Exams', count: 0, percentage: 0 },
          { label: 'Final Exams', count: 0, percentage: 0 },
          { label: 'Custom Topic Exams', count: 2, percentage: 85 },
        ],
      },
    },
  },
};

/** The same data under the v4 paths the new app calls (the keys above still serve the old app). */
const OLD_SCHOOLS = '/api/mentor/v1/schools';
const V4_SCHOOLS = '/api/v4/schools';
const STUDENT_REPORTS: Array<[v4: string, old: string]> = [
  ['', 'get-student-info'],
  ['/learning-hours', 'get-student-learning-hours-info'],
  ['/videos', 'get-student-video-completion-info'],
  ['/doubts', 'get-student-doubts-section-info'],
  ['/assessments', 'get-student-assessment-section-info'],
];
Object.assign(SCHOOLS_MOCKS, {
  [`${V4_SCHOOLS}/auth/me`]: SCHOOLS_MOCKS['/api/mentor/v1/auth/get-teacher-info'],
  [`${V4_SCHOOLS}/school`]: SCHOOLS_MOCKS[`${OLD_SCHOOLS}/get-school-info`],
  [`${V4_SCHOOLS}/hours`]: SCHOOLS_MOCKS[`${OLD_SCHOOLS}/get-hours-data`],
  [`${V4_SCHOOLS}/students`]: SCHOOLS_MOCKS[`${OLD_SCHOOLS}/get-student-list`],
  [`${V4_SCHOOLS}/feature-usage`]: SCHOOLS_MOCKS[`${OLD_SCHOOLS}/get-feature-usage`],
  ...Object.fromEntries(
    [7, 8, 9, 10, 12, 13, 14].flatMap((id) =>
      STUDENT_REPORTS.map(([v4, old]) => [`${V4_SCHOOLS}/students/${id}${v4}`, SCHOOLS_MOCKS[`${OLD_SCHOOLS}/${old}`]]),
    ),
  ),
});
