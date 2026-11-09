/** NEET learn & notes sample responses for visual comparison (spread into MOCKS in mocks.ts). */
const sidebarRow = {
  module_id: 341,
  module_title: 'Laws of Motion',
  module_description: "Newton's laws, friction and circular motion.",
  course_id: 214,
  course_title: 'Physics Class 11',
  subject_id: 7,
  subject_title: 'NEET-PHYSICS',
  total_videos: 1,
  completed_videos: 1,
  total_notes: 1,
  completed_notes: 0,
  total_tests: 1,
  completed_tests: 0,
  total_pyqs: 1,
  completed_pyqs: 0,
  pyq_question_count: 14,
  attempt_id: 9021,
  chapter_pyq_attempt_id: null,
};

const modules = ['Units and Measurement', 'Motion in a Straight Line', 'Laws of Motion', 'Work, Energy and Power', 'Gravitation'];
const counts = (i: number) => ({
  total_videos: 1,
  completed_videos: i < 3 ? 1 : 0,
  total_notes: 1,
  completed_notes: i < 2 ? 1 : 0,
  total_tests: 1,
  completed_tests: i < 1 ? 1 : 0,
  total_pyqs: 1,
  completed_pyqs: i < 1 ? 1 : 0,
});

const attempts = [
  { attempt_id: 55210, attempt_number: 2, date: '2026-09-10T09:12:44.000Z', total_questions: 20, total_marks: 80, total_marks_obtained: 52, percentage: '65.00%', is_latest: true },
  { attempt_id: 55100, attempt_number: 1, date: '2026-09-01T09:12:44.000Z', total_questions: 20, total_marks: 80, total_marks_obtained: 36, percentage: '45.00%', is_latest: false },
];

export const NEET_LEARN_MOCKS: Record<string, unknown> = {
  '/api/neet/summary-notes/subjects': {
    success: true,
    data: [
      { subject_id: 7, subject_name: 'NEET-PHYSICS', image: null, total_chapters: 5, completed_chapters: 2 },
      { subject_id: 8, subject_name: 'NEET-CHEMISTRY', image: null, total_chapters: 4, completed_chapters: 0 },
      { subject_id: 9, subject_name: 'NEET-BOTANY', image: null, total_chapters: 6, completed_chapters: 1 },
      { subject_id: 10, subject_name: 'NEET-ZOOLOGY', image: null, total_chapters: 6, completed_chapters: 0 },
    ],
  },
  '/api/neet/summary-notes/chapters': {
    success: true,
    summary: { total_chapters: 5, completed_chapters: 2, in_progress_chapters: 0, pending_chapters: 3 },
    data: modules.map((title, i) => ({
      module_id: 339 + i,
      module_title: title,
      module_order: i + 1,
      course_id: 214,
      course_title: 'Physics Class 11',
      subject_id: 7,
      subject_name: 'NEET-PHYSICS',
      note_id: 900 + i,
      lock_content: i === 4 ? 1 : 0,
      notes_status: i < 2 ? 'completed' : 'pending',
    })),
  },
  '/api/neet/module-list/214': {
    success: true,
    total_modules: modules.length,
    summary: { videos: { completed: 3, total: 5 }, notes: { completed: 2, total: 5 }, tests: { completed: 1, total: 5 }, pyqs: { completed: 1, total: 5 } },
    data: modules.map((title, i) => ({ module_id: 339 + i, course_id: 214, title, description: null, orders: i + 1, is_active: 1, ...counts(i) })),
  },
  ...Object.fromEntries(modules.map((title, i) => [`/api/neet/ChapterSidebar/${339 + i}`, { success: true, data: [{ ...sidebarRow, module_id: 339 + i, module_title: title }] }])),
  '/api/neet/sumamry-video/341': {
    success: true,
    data: [
      {
        module_id: 341,
        title: 'Physics Class 11',
        summary_video_status: 'pending',
        new_video_link: {
          english: {
            'Part 1': { title: 'Laws of Motion — Part 1', video_link: 'https://example.invalid/laws-1-en.mp4', source_type: 'upload' },
            'Part 2': { title: 'Laws of Motion — Part 2', video_link: 'https://example.invalid/laws-2-en.mp4', source_type: 'upload' },
          },
          hindi: { 'Part 1': { title: 'Laws of Motion — Part 1', video_link: 'https://example.invalid/laws-1-hi.mp4', source_type: 'upload' } },
        },
      },
    ],
  },
  '/api/neet/get-summar-notes/341': {
    success: true,
    data: {
      note_id: 902,
      module_id: 341,
      course_id: 214,
      course_name: 'Physics Class 11',
      module_name: 'Laws of Motion',
      module_order: 3,
      notes_text:
        '<h2>Newton’s First Law</h2><p>A body continues in its state of rest or uniform motion unless acted upon by an external force.</p><div class="exam-tip-box">Exam tip: inertia depends only on mass.</div><h3>Momentum</h3><p>p = mv. The rate of change of momentum equals the applied force.</p><div class="example-box">Example: a 2 kg ball moving at 3 m/s has momentum 6 kg m/s.</div><table><tr><th>Law</th><th>Statement</th></tr><tr><td>First</td><td>Inertia</td></tr><tr><td>Second</td><td>F = ma</td></tr></table>',
      notes_pdf: 'https://example.invalid/laws.pdf',
      is_completed: false,
      summary_notes_status: null,
    },
  },
  '/api/neet/unit-test-assessment/341': { success: true, data: { assessment_id: 5231, module_id: 341, assessment_type: 'unit_test' } },
  '/api/neet/quiz-exam/previous-attempts/5231': { success: true, submissions: attempts },
  '/api/neet/chapter-pyq-exam/previous-attempts/341': {
    success: true,
    submissions: attempts.map((a) => ({ ...a, attempt_id: a.attempt_id - 47000, total_marks: 40, total_marks_obtained: a.total_marks_obtained / 2 })),
  },
};
