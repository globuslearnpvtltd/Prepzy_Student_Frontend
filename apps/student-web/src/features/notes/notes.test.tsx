import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { notesApi, pdfDownloadUrl, toChapterNotes, toTopics, toVideoUrl } from './api';
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

describe('Notes view', () => {
  it('shows the linked chapter’s notes, topics, download and video', async () => {
    navigation.searchParams = new URLSearchParams('module_id=3');
    server.use(
      http.get(`${API}/api/v4/notes/courses/5`, () =>
        ok({ notes: [note(), note({ note_id: 41, module_id: 3, module_name: 'Electricity', module_order: 2, student_video_active: 0, notes_pdf: null })] }),
      ),
    );
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo;
    renderWithProviders(<NotesViewScreen courseId="5" />, { exam: cbse });

    expect(await screen.findByRole('heading', { name: 'Electricity', level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText('Download notes')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Coming Soon')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Chapter 1\s*Light/ }));
    expect(await screen.findByRole('heading', { name: 'Light', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Angle in equals angle out.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download notes' })).toHaveAttribute('href', 'https://cdn.test/light.pdf?fl_attachment=true');
    expect(screen.getByRole('link', { name: /Light Summary Video/ })).toHaveAttribute('href', '/cbse/notes/video/40');

    await userEvent.click(screen.getByRole('button', { name: 'Reflection' }));
    expect(scrollTo).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /All Chapters/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Close chapters' }));
  });

  it('says when notes aren’t ready, and handles failures', async () => {
    server.use(http.get(`${API}/api/v4/notes/courses/5`, () => ok({ notes: [note({ student_note_active: 0 })] })));
    renderWithProviders(<NotesViewScreen courseId="5" />, { exam: cbse });
    expect(await screen.findByText('Notes Not Ready Yet...')).toBeInTheDocument();

    server.use(http.get(`${API}/api/v4/notes/courses/9`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<NotesViewScreen courseId="9" />, { exam: cbse });
    expect(await screen.findByText('Failed To Fetch Notes')).toBeInTheDocument();
  });

  it('shows an empty chapter list', async () => {
    server.use(http.get(`${API}/api/v4/notes/courses/5`, () => ok({ notes: [] })));
    renderWithProviders(<NotesViewScreen courseId="5" />, { exam: cbse });
    expect(await screen.findByText('No Chapters To Show...')).toBeInTheDocument();
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
