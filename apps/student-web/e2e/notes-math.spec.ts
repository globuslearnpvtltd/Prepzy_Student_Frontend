import { expect, signIn, test } from './fixtures';
import { mockStudentApi } from './student-mocks';

// Chapter notes with LaTeX (inline \( … \) and display $$ … $$) are typeset by MathJax, not shown as source.
const notesHtml =
  '<div class="content-card"><h2 id="t1">Fundamental Theorem of Arithmetic</h2>' +
  '<p>Prime factors can repeat; for example, \\(4=2\\times2\\) and \\(253=11\\times23\\).</p>' +
  '<p>$$x=p_1^{a_1}p_2^{a_2}\\cdots p_k^{a_k},\\quad p_1&lt;p_2&lt;\\cdots&lt;p_k$$</p></div>';

const note = {
  course_name: 'Real Numbers',
  module_id: 2,
  module_name: 'Real Numbers',
  module_order: 1,
  description: 'Key ideas.',
  note_id: 40,
  notes_text: notesHtml,
  notes_pdf: null,
  notes_index_ref: [{ anchor_id: 't1', topic: 'Fundamental Theorem of Arithmetic' }],
  student_note_active: 1,
  student_video_active: 0,
  video_thumbnail: null,
};

test('chapter notes render their LaTeX with MathJax', async ({ page, context }) => {
  await signIn(context, 'cbse');
  await mockStudentApi(page, 'board', {
    'GET /api/v4/notes/courses/5': { success: true, message: 'ok', data: { notes: [note] } },
  });
  await page.goto('/cbse/notes/5?module_id=2');
  await expect(page.getByRole('heading', { name: 'Fundamental Theorem of Arithmetic' }).first()).toBeVisible();
  await expect(page.locator('mjx-container').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('mjx-container')).toHaveCount(3);
  await expect(page.locator('[data-notes-doc]').getByText('\\times', { exact: false })).toHaveCount(0);
});
