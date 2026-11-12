/** Parents portal mock data (login, dashboard). Spread into MOCKS in visual/mocks.ts. */

const graphData = { Mon: 0.75, Tue: 1.5, Wed: 0.5, Thu: 2, Fri: 1, Sat: 0.25, Sun: 1.25, Today: 0.5 };

export const PARENT_MOCKS: Record<string, unknown> = {
  '/api/mentor/v1/auth/get-parent-info': {
    success: true,
    data: {
      parent_data: {
        account_id: 501,
        first_name: 'Sunita',
        last_name: 'Kumar',
        email: 'sunita@example.com',
        phone: '+919876500000',
        status: 'active',
      },
    },
  },
  '/api/mentor/v1/parents/get-student-list': {
    success: true,
    data: {
      student_data: [
        {
          account_id: 1,
          first_name: 'Ravi',
          last_name: 'Kumar',
          created_at: '2025-06-14T10:00:00.000Z',
          classes: [
            { class_id: 12, class_name: 'CLASS 12', stream_name: 'PCB' },
            { class_id: 11, class_name: 'CLASS 11', stream_name: 'PCB' },
          ],
        },
        {
          account_id: 2,
          first_name: 'Asha',
          last_name: 'Kumar',
          created_at: '2025-09-01T10:00:00.000Z',
          classes: [{ class_id: 9, class_name: 'CLASS 9', stream_name: '' }],
        },
      ],
    },
  },
  '/api/mentor/v1/parents/get-student-learning-hours-info': {
    success: true,
    data: {
      graph_data: graphData,
      study_engagement: {
        this_week: { total_hours: 6.25, hours: 6, minutes: 15 },
        total_since_joining_hours: 84,
        avg_minutes_per_active_day: 54,
      },
    },
  },
  '/api/mentor/v1/parents/get-student-video-completion-info': {
    success: true,
    data: {
      video_completion: {
        total: 24,
        subjects: [
          { subject_id: 1, subject_name: 'Physics', count: 10 },
          { subject_id: 2, subject_name: 'Chemistry', count: 8 },
          { subject_id: 3, subject_name: 'Biology', count: 6 },
        ],
        chapters: ['Electric Charges and Fields', 'Solutions', 'Cell: The Unit of Life', 'Thermodynamics'],
      },
    },
  },
  '/api/mentor/v1/parents/get-student-doubts-section-info': {
    success: true,
    data: {
      doubts: {
        total: 37,
        subjects: [
          { name: 'Physics', count: 14, color: '#F6A635', width: '38%' },
          { name: 'Chemistry', count: 12, color: '#3D348B', width: '32%' },
          { name: 'Biology', count: 11, color: '#10B981', width: '30%' },
        ],
        categories: [
          { label: 'ATLAS', count: 18, color: '#3D348B' },
          { label: 'Lecture Chat', count: 9, color: '#F6A635' },
          { label: 'Doubt Solver', count: 10, color: '#10B981' },
          { label: 'Post Assessment Chat', count: 0, color: '#3D348B' },
        ],
      },
    },
  },
  '/api/mentor/v1/parents/get-student-assessment-section-info': {
    success: true,
    data: {
      assessments: {
        total: 12,
        categories: [
          { label: 'Quiz', count: 6, percentage: 72 },
          { label: 'Mock Test', count: 4, percentage: 58 },
          { label: 'Final Exam', count: 2, percentage: 64 },
        ],
      },
    },
  },
};

/** The same data under the v4 paths the new app calls (the keys above still serve the old app). */
const OLD_PARENTS = '/api/mentor/v1/parents';
const V4_PARENTS = '/api/v4/parents';
const STUDENT_REPORTS: Array<[v4: string, old: string]> = [
  ['learning-hours', 'get-student-learning-hours-info'],
  ['videos', 'get-student-video-completion-info'],
  ['doubts', 'get-student-doubts-section-info'],
  ['assessments', 'get-student-assessment-section-info'],
];
Object.assign(PARENT_MOCKS, {
  [`${V4_PARENTS}/auth/me`]: PARENT_MOCKS['/api/mentor/v1/auth/get-parent-info'],
  [`${V4_PARENTS}/students`]: PARENT_MOCKS[`${OLD_PARENTS}/get-student-list`],
  ...Object.fromEntries(
    [1, 2].flatMap((id) =>
      STUDENT_REPORTS.map(([v4, old]) => [`${V4_PARENTS}/students/${id}/${v4}`, PARENT_MOCKS[`${OLD_PARENTS}/${old}`]]),
    ),
  ),
});
