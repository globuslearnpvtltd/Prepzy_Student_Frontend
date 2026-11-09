/** Board custom tests, no-plan dashboard widgets, chapter-PYQ attempts (the last porting pass). */
export const GAP_MOCKS: Record<string, unknown> = {
  '/api/custom-exams/get-custom-exam-course-list/12': {
    success: true,
    courses: [
      { course_id: 11, course_name: 'Physics Part 1', subject_name: 'Physics' },
      { course_id: 12, course_name: 'Chemistry Part 1', subject_name: 'Chemistry' },
      { course_id: 13, course_name: 'Biology', subject_name: 'Biology' },
    ],
  },
  '/api/custom-exams/get-custom-exam-module-list/11': {
    success: true,
    modules: [
      { module_id: 101, module_name: 'ELECTRIC CHARGES AND FIELDS', topics: [{ topic_id: 1, topic_name: 'Coulomb law' }, { topic_id: 2, topic_name: 'Electric field' }] },
      { module_id: 102, module_name: 'CURRENT ELECTRICITY', topics: [{ topic_id: 3, topic_name: 'Ohm law' }] },
    ],
  },
  '/api/custom-exams/get-custom-exam-set-list/12': {
    success: true,
    sets: [
      { set_id: 71, set_number: 1, course_name: 'Physics Part 1', subject_name: 'Physics', difficulty_level: 'easy', total_marks: 40, total_questions: 20, created_at: '2026-10-02T10:00:00Z' },
      { set_id: 72, set_number: 2, course_name: 'Chemistry Part 1', subject_name: 'Chemistry', difficulty_level: 'hard', total_marks: 50, total_questions: 25, created_at: '2026-10-05T10:00:00Z' },
    ],
  },
  '/api/custom-exams/custom-exam-submissions-list/71': {
    success: true,
    submissions: [{ id: 501, attempt_number: 1, attempt_date: '2026-10-03T10:00:00Z', total_questions: 20, total_marks: 40, total_marks_obtained: 28 }],
  },
  // No-plan board student (PAIRS exam field `board-noplan`)
  '/api/v1/student/free-courses': {
    success: true,
    data: {
      free_courses: [
        { course_id: 31, class_id: 12, title: 'Physics Part 1', class_name: 'CLASS 12', subject_name: 'Physics', image: '', unique_lecture: 24, assessment_count: 6 },
        { course_id: 32, class_id: 12, title: 'Chemistry Part 1', class_name: 'CLASS 12', subject_name: 'Chemistry', image: '', unique_lecture: 18, assessment_count: 4 },
        { course_id: 33, class_id: 12, title: 'Biology', class_name: 'CLASS 12', subject_name: 'Biology', image: '', unique_lecture: 30, assessment_count: 8 },
      ],
    },
  },
  '/api/v1/student/pyq-subject-list': {
    success: true,
    data: {
      pyq: [
        { year: 2025, subject: 4, title: 'SCIENCE', image: '', class: 'CLASS 12' },
        { year: 2025, subject: 5, title: 'SOCIAL SCIENCE', image: '', class: 'CLASS 12' },
      ],
    },
  },
  // Chapter PYQ "Your attempts" drawer
  '/api/v1/exams/chapter-pyqs/previous-attempts/2': {
    success: true,
    submissions: [
      { set_id: 2, attempt_id: 91, attempt_number: 2, grade: '72.4', date: '2026-10-05T10:30:00Z' },
      { set_id: 2, attempt_id: 90, attempt_number: 1, grade: '55', date: '2026-10-01T10:30:00Z' },
    ],
  },
};
