/** Board learn, courses and notes pages (course 5, chapter 2, lecture 8, note 40, catalogue course 7). */
const ok = (data: unknown) => ({ success: true, message: 'ok', data });

const books = ok({
  result: [
    { course_id: 5, title: 'Physics Part 1', class: 'CLASS 12', image: null, unique_lecture: 14, assessment_count: 6, module_count: 8 },
    { course_id: 6, title: 'Physics Part 2', class: 'CLASS 12', image: null, unique_lecture: 12, assessment_count: 5, module_count: 6 },
  ],
});

const questions = [
  {
    id: 1,
    type: 'mcq',
    year: 2020,
    marks: 1,
    difficulty: 'easy',
    question_text: '<p>Which mirror is used as a shaving mirror?</p>',
    options: [
      { id: 'a', option_text: 'Concave mirror', is_correct: true },
      { id: 'b', option_text: 'Convex mirror' },
      { id: 'c', option_text: 'Plane mirror' },
      { id: 'd', option_text: 'None of these' },
    ],
    explanation: '<p>A concave mirror gives an enlarged, upright image when the face is close.</p>',
  },
  { id: 2, type: 'short_answer', year: 2022, marks: 3, question_text: '<p>State the laws of reflection of light.</p>', sample_answer: '<p>Angle of incidence equals angle of reflection.</p>' },
  { id: 3, type: 'long_answer', year: 2023, marks: 5, question_text: '<p>Draw a ray diagram for an object placed between F and 2F of a convex lens.</p>' },
];

const chapters = ['Electric Charges and Fields', 'Electrostatic Potential', 'Current Electricity', 'Ray Optics'];

const notesHtml =
  '<div class="content-card"><h2 id="t1">Coulomb’s law</h2><p>The force between two point charges varies inversely as the square of the distance.</p><div class="exam-tip-box">Exam tip: always state the medium.</div><h3 id="t2">Electric field</h3><p>The region around a charge where its effect can be felt.</p><div class="example-box">Example: a 2 µC charge at 1 m.</div></div>';

export const LEARN_MOCKS: Record<string, unknown> = {
  '/api/v1/student/getCourselist-dashboard/12/1': books,
  '/api/v1/student/getCourselist-dashboard/12/2': books,
  '/api/v1/student/getCourselist-dashboard/12/3': books,
  '/api/v1/student/getCourselist-dashboard/12/4': books,
  '/api/v1/learn/module-outline/5': ok({
    finalList: [
      ...chapters.map((title, i) => ({ category: 'module', id: i + 2, title, module_order: i + 1 })),
      { category: 'assessment', id: 90, type: 'mid_term_exam', title: 'Mid term' },
      { category: 'assessment', id: 91, type: 'final_exam', title: 'Final' },
    ],
    courseDetail: { course_id: 5, course_name: 'Physics Part 1', class_name: 'CLASS 12', subject_name: 'PHYSICS', class_id: 12, stream_name: 'PCB' },
  }),
  '/api/v1/learn/module-details/2/5': ok({
    finalList: [
      { order: 1, category: 'lecture', id: 8, title: 'introduction to electric charges', lecture_order: 1, isCompleted: true },
      { order: 2, category: 'assessment', type: 'quiz', id: 20, title: 'electric charges quiz' },
      { order: 3, category: 'lecture', id: 9, title: 'coulomb’s law', lecture_order: 2, isCompleted: false },
      { order: 4, category: 'assessment', type: 'unit_test', id: 21, title: 'unit test: electric charges' },
    ],
    module_data: { title: 'Electric Charges and Fields', orders: 1, description: 'Charges, forces and fields.' },
    summary_videos: [
      { type: 'video', id: 40, module_id: 2, title: 'Electric Charges and Fields', student_side_active: 1 },
      { type: 'notes', id: 40, module_id: 2, title: 'Electric Charges and Fields', student_side_active: 1 },
    ],
  }),
  '/api/v1/learn/chapter-pyqs/2': ok({ questions }),
  '/api/v1/learn/chapter-ncert-questions/2': ok({ questions, total: questions.length }),
  '/api/v1/learn/chapter-ncert-questions/2/count': ok({ total: 3 }),
  '/api/v1/learn/lectures/8': ok({
    lecture: {
      lecture_id: 8,
      title: 'introduction to electric charges',
      description: 'What electric charge is, how it is measured and how charges interact.',
      course_id: 5,
      module_id: 2,
      module_order: 1,
      videos: [
        { language: 'english', link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { language: 'hindi', link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      ],
    },
  }),
  '/api/v1/learn/transcript/8': ok({ transcript: 'Welcome to the first lecture.<br /><br />Today we study electric charge.' }),
  '/api/class-list': ok([
    { class_id: 10, title: 'Class 10', stream_name: '' },
    { class_id: 12, title: 'Class 12', stream_name: 'PCB' },
  ]),
  '/api/v2/get-textbooks': {
    class_id: null,
    subject_courses: [
      {
        subject_id: 1,
        subject_name: 'Physics',
        textbooks: [
          { id: 7, class_id: 12, class_name: 'Class 12', textbook_name: 'Physics Part 1', textbook_image: null, description: 'Electrostatics, current electricity and magnetism.' },
          { id: 8, class_id: 12, class_name: 'Class 12', textbook_name: 'Physics Part 2', textbook_image: null, description: 'Optics, modern physics and semiconductors.' },
        ],
      },
      { subject_id: 2, subject_name: 'Chemistry', textbooks: [{ id: 9, class_id: 12, class_name: 'Class 12', textbook_name: 'Chemistry Part 1', textbook_image: null, description: 'Solutions and electrochemistry.' }] },
    ],
  },
  '/api/courses/7': ok({
    course_id: 7,
    class: 12,
    class_id: 12,
    className: 'CLASS 12',
    subjectName: 'PHYSICS',
    title: 'Physics Part 1',
    description: 'electrostatics, current electricity and magnetism.',
    image: null,
    lectureCount: 14,
    assessCounts: { quiz: 4, unit_test: 2, mid_term_exam: 1, final_exam: 1 },
    outcomes: ['Understand electric charges and fields', 'Apply Gauss’s law', 'Solve circuit problems', 'Explain magnetism'],
  }),
  '/api/course_outline_overview/7': {
    finalList: [
      { order: 1, category: 'module', id: 2, module_order: 1, title: 'electric charges and fields', lectures: [{ category: 'lecture', lecture_order: 1, title: 'introduction' }] },
      { order: 2, category: 'module', id: 3, module_order: 2, title: 'electrostatic potential', lectures: [] },
      { order: 3, category: 'assessment', type: 'final_exam' },
    ],
  },
  '/api/subscribed-class': ok({ classIds: [12] }),
  '/api/v1/notes/notes/5': ok({
    notes: chapters.slice(0, 3).map((title, i) => ({
      course_name: 'Physics Part 1',
      module_id: i + 2,
      module_name: title,
      module_order: i + 1,
      description: 'Key ideas and formulas for revision.',
      note_id: 40 + i,
      notes_text: notesHtml,
      notes_pdf: 'https://example.com/notes.pdf',
      notes_index_ref: [
        { anchor_id: 't1', topic: 'Coulomb’s law' },
        { anchor_id: 't2', topic: 'Electric field' },
      ],
      student_note_active: 1,
      student_video_active: i === 0 ? 1 : 0,
      video_thumbnail: null,
    })),
  }),
  '/api/notes/summary-video/40': {
    success: true,
    notes: {
      note_id: 40,
      module_name: 'Electric Charges and Fields',
      module_order: 1,
      course_name: 'Physics Part 1',
      description: 'Key ideas and formulas for revision.',
      video_link: null,
      video_thumbnail: null,
      narrations: ['Welcome to the summary of electric charges.', 'Charges are of two kinds.', 'Like charges repel; unlike charges attract.'],
    },
  },
};
