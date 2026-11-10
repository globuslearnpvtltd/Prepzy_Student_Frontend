import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { NotesStep } from './notes-step';
import { testExam } from '@/test/exams';

const neet = testExam('neet');
const ok = (body: Record<string, unknown>) => HttpResponse.json({ success: true, ...body });

const sidebar = http.get(`${API}/api/v4/learn/competitive/${neet.examId}/chapters/:id`, () =>
  ok({ data: { chapter: { module_id: 341, module_title: 'Laws of Motion', course_id: 214, course_title: 'Physics Class 11', total_notes: 1, completed_notes: 1 } } }),
);
const notes = (data: Record<string, unknown>) => http.get(`${API}/api/v4/learn/competitive/${neet.examId}/chapters/341/notes`, () => ok({ data }));

const scrolled = vi.fn();

beforeEach(() => {
  Element.prototype.scrollIntoView = scrolled;
});
afterEach(() => {
  window.location.hash = '';
});

describe('NotesStep', () => {
  it('falls back to the chapter title, shows it as completed and disables download without a PDF', async () => {
    server.use(sidebar, notes({ notes_text: '<p>F = ma</p>', is_completed: true }));
    renderWithProviders(<NotesStep courseId="214" moduleId="341" step="study-notes" />, { exam: neet });
    expect(await screen.findByRole('heading', { name: 'Laws of Motion' })).toBeInTheDocument();
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Mark As Completed' })).not.toBeInTheDocument();
    for (const link of screen.getAllByText('Download')) {
      expect(link.closest('a')).toHaveAttribute('aria-disabled', 'true');
      expect(link.closest('a')).not.toHaveAttribute('href');
    }
    expect(screen.getByRole('link', { name: 'Physics Class 11' })).toHaveAttribute('href', '/neet/learn/214');
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/neet/learn/214');
  });

  it('scrolls to the topic named in the URL hash once the notes render', async () => {
    window.location.hash = '#newton%20laws';
    server.use(sidebar, notes({ module_name: 'Laws of Motion', notes_text: '<h2 id="newton laws">Newton</h2>' }));
    renderWithProviders(<NotesStep courseId="214" moduleId="341" step="study-notes" />, { exam: neet });
    await screen.findByRole('heading', { name: 'Newton' });
    await waitFor(() => expect(scrolled).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' }));
  });

  it('retries the scroll shortly after when the topic is not on the page yet', async () => {
    window.location.hash = '#late-topic';
    server.use(sidebar, notes({ module_name: 'Laws of Motion', notes_text: '<p>Intro</p>' }));
    renderWithProviders(<NotesStep courseId="214" moduleId="341" step="study-notes" />, { exam: neet });
    await screen.findByText('Intro');
    expect(scrolled).not.toHaveBeenCalled();
    const late = document.createElement('section');
    late.id = 'late-topic';
    document.body.append(late);
    await waitFor(() => expect(scrolled).toHaveBeenCalledTimes(1), { timeout: 1000 });
    late.remove();
  });

  it('shows the generic chapter label when nothing names it', async () => {
    server.use(
      http.get(`${API}/api/v4/learn/competitive/${neet.examId}/chapters/:id`, () => HttpResponse.json({ success: false, code: 'CHAPTER_NOT_FOUND' }, { status: 404 })),
      notes({ notes_text: null }),
    );
    renderWithProviders(<NotesStep courseId="214" moduleId="341" step="study-notes" />, { exam: neet });
    expect(await screen.findByText('Notes Coming Soon!')).toBeInTheDocument();
    expect(screen.getByText('this chapter')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Subject' })).toBeInTheDocument();
  });
});
