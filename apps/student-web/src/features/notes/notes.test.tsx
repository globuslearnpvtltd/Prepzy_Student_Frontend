import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { notesApi, pdfDownloadUrl, toChapterNotes, toTopics, toVideoUrl } from './api';
import { prepareNotes } from './document';
import { NotesScreen, NotesViewScreen, SummaryVideoScreen } from './ui';
import { testExam } from '@/test/exams';

const cbse = testExam('cbse');
const ok = (data: unknown) => HttpResponse.json({ success: true, data });

const plan = http.get(`${API}/api/v4/student/plans/active`, () =>
  ok({ plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 10', stream_name: '', duration_months: 12, expiry_date: '2099-03-31', status: 'active' }] }),
);

const note = (extra: Record<string, unknown> = {}) => ({
  note_id: 40,
  module_id: 2,
  module_name: 'Light',
  module_order: 1,
  course_name: 'Science Part 1',
  description: 'Mirrors and lenses',
  notes_text: '<html><head><style>p{}</style></head><body><h2 id="t1">Reflection</h2><p>Angle in equals angle out.</p></body></html>',
  notes_pdf: 'https://cdn.test/light.pdf',
  notes_index_ref: '[{"anchor_id":"t1","topic":"Reflection"}]',
  student_note_active: 1,
  student_video_active: 1,
  video_thumbnail: null,
  ...extra,
});

beforeEach(() => {
  navigation.searchParams = new URLSearchParams();
});

describe('notes api', () => {
  it('normalises notes, topics and video links', async () => {
    expect(toTopics('bad')).toEqual([]);
    expect(toTopics([{ anchor_id: 'a', topic: 'A' }, { topic: 'no anchor' }])).toEqual([{ anchorId: 'a', topic: 'A' }]);
    expect(toChapterNotes(note({ student_note_active: 0, notes_pdf: 'null' }))).toMatchObject({ notesReady: false, pdf: null, topics: [{ anchorId: 't1' }] });
    expect(toVideoUrl('[{"language":"english","link":"https://v.test/a.mp4"}]')).toBe('https://v.test/a.mp4');
    expect(toVideoUrl('https://v.test/b.mp4')).toBe('https://v.test/b.mp4');
    expect(toVideoUrl([])).toBeNull();
    expect(pdfDownloadUrl('https://cdn.test/a.pdf')).toBe('https://cdn.test/a.pdf?fl_attachment=true');
    expect(pdfDownloadUrl('https://cdn.test/a.pdf?v=1')).toBe('https://cdn.test/a.pdf?v=1&fl_attachment=true');

    server.use(
      http.get(`${API}/api/v4/notes/summary-video/40`, () =>
        HttpResponse.json({ success: true, data: { note_id: 40, module_name: 'Light', video_link: 'https://v.test/s.mp4', narrations: ['One', ''] } }),
      ),
    );
    expect(await notesApi.summaryVideo('40')).toMatchObject({ videoUrl: 'https://v.test/s.mp4', narrations: ['One'] });
  });
});

describe('Notes page', () => {
  it('lists books for the chosen subject', async () => {
    server.use(
      plan,
      http.get(`${API}/api/v4/dashboard/board/1/classes/12/subjects`, () =>
        ok({ subjects: [{ subject_id: 1, subject_name: 'Science' }, { subject_id: 2, subject_name: 'Maths' }] }),
      ),
      http.get(`${API}/api/v4/learn/classes/12/subjects/1/courses`, () => ok({ courses: [{ course_id: 5, title: 'Science Part 1', module_count: 13 }] })),
      http.get(`${API}/api/v4/learn/classes/12/subjects/2/courses`, () => ok({ courses: [{ course_id: 6, title: 'Maths Book', module_count: 15 }] })),
    );
    renderWithProviders(<NotesScreen aside={<p>Aside</p>} />, { exam: cbse });
    expect(screen.getByRole('heading', { name: 'Notes', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'View Notes: Science Part 1' })).toHaveAttribute('href', '/cbse/notes/5');
    expect(screen.getByText('13 Chapters')).toBeInTheDocument();

    await userEvent.click(within(screen.getByRole('group', { name: 'Subjects' })).getByRole('button', { name: 'Maths' }));
    expect(await screen.findByRole('link', { name: 'View Notes: Maths Book' })).toHaveAttribute('href', '/cbse/notes/6');

    // Mobile subject picker
    await userEvent.click(screen.getByRole('button', { name: /Maths/, expanded: false }));
    const menuItems = screen.getAllByRole('button', { name: 'Science' });
    await userEvent.click(menuItems[menuItems.length - 1]!);
    expect(await screen.findByRole('link', { name: 'View Notes: Science Part 1' })).toBeInTheDocument();
  });

  it('shows an error when subjects fail', async () => {
    server.use(plan, http.get(`${API}/api/v4/dashboard/board/1/classes/12/subjects`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<NotesScreen />, { exam: cbse });
    expect(await screen.findByText('Failed To Load Notes')).toBeInTheDocument();
  });
});

const twoChapters = () =>
  http.get(`${API}/api/v4/notes/courses/5`, () =>
    ok({
      notes: [
        note({
          notes_text:
            '<div class="content-card"><h2 id="t1">Reflection</h2><p>Angle in equals angle out.</p><h3>Mirrors</h3><p>Plane and curved.</p></div>' +
            '<div class="content-card"><h2>Refraction</h2><p>Light bends.</p><table><tr><th>Medium</th><th>n</th></tr><tr><td>Glass</td><td>1.5</td></tr></table></div>',
          notes_index_ref: '[{"anchor_id":"t1","topic":"Reflection"},{"anchor_id":"t2","topic":"Refraction"},{"anchor_id":"t9","topic":"Not in the notes"}]',
        }),
        note({ note_id: 41, module_id: 3, module_name: 'Electricity', module_order: 2, student_video_active: 0, notes_pdf: null }),
      ],
    }),
  );

describe('Notes view', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    window.history.replaceState(null, '', '/cbse/notes/5');
  });

  it('opens the linked chapter, with prev / next between chapters', async () => {
    navigation.searchParams = new URLSearchParams('module_id=3');
    server.use(twoChapters());
    renderWithProviders(<NotesViewScreen courseId="5" />, { exam: cbse });

    expect(await screen.findByRole('heading', { name: 'Electricity', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Science Part 1 · Chapter 2 of 2')).toBeInTheDocument();
    // No PDF for this chapter: no download, and nothing about saving offline.
    expect(screen.queryByRole('button', { name: /Download notes/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
    expect(screen.getByText('Coming Soon')).toBeInTheDocument();

    const steps = screen.getByRole('navigation', { name: 'Chapter navigation' });
    expect(within(steps).getByRole('button', { name: /Next/ })).toBeDisabled();
    await userEvent.click(within(steps).getByRole('button', { name: /Previous/ }));
    expect(await screen.findByRole('heading', { name: 'Light', level: 1 })).toBeInTheDocument();
    expect(window.location.search).toBe('?module_id=2');
    expect(within(steps).getByRole('button', { name: /Previous/ })).toBeDisabled();
    await userEvent.click(within(steps).getByRole('button', { name: /Next/ }));
    expect(await screen.findByRole('heading', { name: 'Electricity', level: 1 })).toBeInTheDocument();
  });

  it('switches chapter from the chapter list and the chapter sheet', async () => {
    server.use(twoChapters());
    renderWithProviders(<NotesViewScreen courseId="5" />, { exam: cbse });
    expect(await screen.findByRole('heading', { name: 'Light', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Light Summary Video/ })).toHaveAttribute('href', '/cbse/notes/video/40');

    await userEvent.click(within(screen.getByRole('complementary', { name: 'Chapters' })).getByRole('button', { name: /Chapter 2\s*Electricity/ }));
    expect(await screen.findByRole('heading', { name: 'Electricity', level: 1 })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Switch chapter' }));
    const sheet = screen.getByRole('dialog', { name: 'Chapters' });
    expect(within(sheet).getByText('Science Part 1 · 2 chapters')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /Electricity/ })).toHaveAttribute('aria-current', 'true');
    await userEvent.click(within(sheet).getByRole('button', { name: /Light/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Light', level: 1 })).toBeInTheDocument();
  });

  it('indexes the sections that exist in the notes and scrolls to them from the contents sheet', async () => {
    server.use(twoChapters());
    // Where each section starts on screen (jsdom has no layout).
    const tops: Record<string, number> = { t1: 300, 'notes-t2': 900 };
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return new DOMRect(0, tops[this.id] ?? 0, 0, 0);
    });
    const { container } = renderWithProviders(<NotesViewScreen courseId="5" />, { exam: cbse });
    expect(await screen.findByText('Angle in equals angle out.')).toBeInTheDocument();

    // Anchors: t1 is in the HTML; "Refraction" is found by its heading and given an id; t9 points nowhere and is left out.
    const index = screen.getByRole('navigation', { name: 'Chapter contents' });
    expect(within(index).getAllByRole('button').map((b) => b.textContent)).toEqual(['Reflection', 'Refraction']);
    expect(within(index).getByRole('button', { name: 'Reflection' })).toHaveAttribute('aria-current', 'true');
    expect(container.querySelector('#t1')).toHaveTextContent('Reflection');
    expect(container.querySelector('#notes-t2')).toHaveTextContent('Refraction');
    // Wide tables scroll in their own box.
    expect(container.querySelector('.table-scroll > table')).toBeInTheDocument();

    // Scroll-spy: the section whose start has passed under the header is the current one.
    tops.t1 = -400;
    tops['notes-t2'] = 80;
    fireEvent.scroll(window);
    await waitFor(() => expect(within(index).getByRole('button', { name: 'Refraction' })).toHaveAttribute('aria-current', 'true'));
    tops.t1 = 300;
    tops['notes-t2'] = 900;
    fireEvent.scroll(window);
    await waitFor(() => expect(within(index).getByRole('button', { name: 'Reflection' })).toHaveAttribute('aria-current', 'true'));

    await userEvent.click(screen.getByRole('button', { name: /Contents/ }));
    const sheet = screen.getByRole('dialog', { name: 'Chapter contents' });
    expect(within(sheet).getByText('Light · 2 sections')).toBeInTheDocument();
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(2);
    expect(within(sheet).getByRole('button', { name: /Reflection/ })).toHaveAttribute('aria-current', 'true');

    await userEvent.click(within(sheet).getByRole('button', { name: /Refraction/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalled());
    expect(within(index).getByRole('button', { name: 'Refraction' })).toHaveAttribute('aria-current', 'true');

    // The wide-screen index scrolls too; Escape closes the sheet.
    vi.mocked(window.scrollTo).mockClear();
    await userEvent.click(within(index).getByRole('button', { name: 'Reflection' }));
    expect(window.scrollTo).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Contents/ }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rect.mockRestore();
  });

  it('downloads the PDF as a file, and offers a retry when that fails', async () => {
    let fail = true;
    server.use(
      twoChapters(),
      http.get('https://cdn.test/light.pdf', ({ request }) => {
        expect(new URL(request.url).searchParams.get('fl_attachment')).toBe('true');
        return fail ? new HttpResponse(null, { status: 503 }) : new HttpResponse(new Blob(['%PDF']), { headers: { 'Content-Type': 'application/pdf' } });
      }),
    );
    const createObjectURL = vi.fn(() => 'blob:notes');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderWithProviders(<NotesViewScreen courseId="5" />, { exam: cbse });

    await userEvent.click(await screen.findByRole('button', { name: 'Download notes (PDF)' }));
    const retry = await screen.findByRole('button', { name: 'Could not download · tap to try again' });
    expect(click).not.toHaveBeenCalled();

    fail = false;
    await userEvent.click(retry);
    expect(await screen.findByRole('button', { name: 'Download notes (PDF)' })).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('Science Part 1 - Light.pdf');
    click.mockRestore();
  });

  it('shows the download failure straight away when offline', async () => {
    server.use(twoChapters());
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderWithProviders(<NotesViewScreen courseId="5" />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Download notes (PDF)' }));
    expect(screen.getByRole('button', { name: 'Could not download · tap to try again' })).toBeInTheDocument();
    online.mockRestore();
  });

  it('says when notes aren’t ready (no index, no download), and handles failures', async () => {
    server.use(http.get(`${API}/api/v4/notes/courses/5`, () => ok({ notes: [note({ student_note_active: 0 })] })));
    renderWithProviders(<NotesViewScreen courseId="5" />, { exam: cbse });
    expect(await screen.findByText('Notes Not Ready Yet...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download notes/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Contents/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Switch chapter' })).not.toBeInTheDocument();

    server.use(http.get(`${API}/api/v4/notes/courses/9`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<NotesViewScreen courseId="9" />, { exam: cbse });
    expect(await screen.findByText('Failed To Fetch Notes')).toBeInTheDocument();
  });

  it('shows an empty chapter list', async () => {
    server.use(http.get(`${API}/api/v4/notes/courses/5`, () => ok({ notes: [] })));
    renderWithProviders(<NotesViewScreen courseId="5" />, { exam: cbse });
    expect((await screen.findAllByText('No Chapters To Show...')).length).toBeGreaterThan(0);
  });
});

describe('prepareNotes', () => {
  it('falls back to the notes’ headings when the index is missing or points nowhere', () => {
    const html = '<html><head><style>h2{}</style><script>alert(1)</script></head><body><h1>Light</h1><h2>1. Reflection</h2><p>a</p><h2>Reflection</h2><h2>Refraction</h2></body></html>';
    const doc = prepareNotes(html, []);
    expect(doc.sections).toEqual([
      { id: 'notes-1-reflection', title: '1. Reflection' },
      { id: 'notes-reflection', title: 'Reflection' },
      { id: 'notes-refraction', title: 'Refraction' },
    ]);
    expect(doc.html).not.toContain('<script');
    expect(doc.html).toContain('id="notes-reflection"');
    expect(prepareNotes(html, [{ anchorId: 'x', topic: 'Nowhere' }]).sections).toHaveLength(3);
    // Numbered headings still match their index entry.
    expect(prepareNotes(html, [{ anchorId: 'refl', topic: 'Reflection' }]).sections).toEqual([{ id: 'notes-refl', title: 'Reflection' }]);
    expect(prepareNotes('<h1>Only</h1><h3>A</h3><h3>B</h3>', []).sections.map((s) => s.title)).toEqual(['A', 'B']);
    expect(prepareNotes('', [])).toEqual({ html: '', sections: [] });
  });

  it('keeps anchors on non-heading elements and doesn’t reuse an id', () => {
    const doc = prepareNotes('<section id="cell"><p>Cells</p></section><h2 id="notes-cycle">Old</h2><h2>Cycle</h2>', [
      { anchorId: 'cell', topic: 'The cell' },
      { anchorId: 'cycle', topic: 'Cycle' },
      { anchorId: 'cell', topic: 'Duplicate' },
    ]);
    expect(doc.sections).toEqual([
      { id: 'cell', title: 'The cell' },
      { id: 'notes-cycle-2', title: 'Cycle' },
    ]);
  });
});

describe('Summary video', () => {
  it('plays the video with its transcript', async () => {
    server.use(
      http.get(`${API}/api/v4/notes/summary-video/40`, () =>
        HttpResponse.json({ success: true, data: { note_id: 40, module_name: 'Light', module_order: 1, course_name: 'Science', video_link: 'https://v.test/s.mp4', narrations: ['Welcome to light.'] } }),
      ),
    );
    renderWithProviders(<SummaryVideoScreen noteId="40" />, { exam: cbse });
    expect(await screen.findByLabelText('Light summary video')).toHaveAttribute('src', 'https://v.test/s.mp4');
    expect(screen.getByText('Welcome to light.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notes' })).toHaveAttribute('href', '/cbse/notes');
  });

  it('handles a missing video and failures', async () => {
    server.use(http.get(`${API}/api/v4/notes/summary-video/40`, () => HttpResponse.json({ success: true, data: { module_name: 'Light' } })));
    renderWithProviders(<SummaryVideoScreen noteId="40" />, { exam: cbse });
    expect(await screen.findByText('No video available')).toBeInTheDocument();

    server.use(http.get(`${API}/api/v4/notes/summary-video/41`, () => HttpResponse.json({ success: false, message: 'Notes not found' }, { status: 404 })));
    renderWithProviders(<SummaryVideoScreen noteId="41" />, { exam: cbse });
    await waitFor(() => expect(screen.getByText('Failed To Fetch Summary Video')).toBeInTheDocument());
  });
});
