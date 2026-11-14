import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { testExam } from '@/test/exams';
import { safePdfUrl, syllabusApi, syllabusCards } from './api';
import { loadPdfJs, pageWidth, PdfViewer, type PdfDocument, type PdfJs } from './components/pdf-viewer';
import { SyllabusCards } from './components/syllabus-cards';
import { SyllabusScreen } from './components/syllabus-screen';

const cbse = testExam('cbse');
const BASE = `${API}/api/v4/dashboard/board/1/classes/12/syllabus-trends`;

const plan = (className = 'CLASS 12', classId = 12) =>
  http.get(`${API}/api/v4/student/plans/active`, () =>
    HttpResponse.json({
      success: true,
      data: { plans: [{ plan_id: 1, class_id: classId, class_name: className, duration_months: 12, status: 'active' }] },
    }),
  );
const noPlan = http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: true, data: { plans: [] } }));

const subjects = (kind: 'syllabus' | 'trend', list: { subject_id: number; subject_name: string }[]) =>
  http.get(`${BASE}/${kind}/subjects`, () => HttpResponse.json({ success: true, message: 'ok', data: { subjects: list } }));

const pdf = (kind: 'syllabus' | 'trend', subjectId: number, data: Record<string, unknown>) =>
  http.get(`${BASE}/${kind}/subjects/${subjectId}`, () => HttpResponse.json({ success: true, message: 'ok', data }));

/** A fake pdf.js with a document of `pages` pages; records the rendered page numbers. */
function fakePdfJs(pages: number, fail = false) {
  const rendered: number[] = [];
  const doc: PdfDocument = {
    numPages: pages,
    getPage: async (n) => ({
      getViewport: ({ scale }) => ({ width: 600 * scale, height: 848 * scale }),
      render: () => {
        rendered.push(n);
        return { promise: Promise.resolve(), cancel: vi.fn() };
      },
    }),
    destroy: vi.fn(),
  };
  const lib: PdfJs = {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: vi.fn(() => ({ promise: fail ? Promise.reject(new Error('CORS')) : Promise.resolve(doc) })),
  };
  window.pdfjsLib = lib;
  return { lib, rendered };
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
});
afterEach(() => {
  delete window.pdfjsLib;
  vi.restoreAllMocks();
});

describe('rules', () => {
  it('shows syllabus / trends by class', () => {
    expect(syllabusCards('CLASS 12')).toEqual({ syllabus: true, trends: true });
    expect(syllabusCards('Class 11')).toEqual({ syllabus: true, trends: false });
    expect(syllabusCards('Class 8')).toEqual({ syllabus: false, trends: false });
    expect(syllabusCards(null)).toEqual({ syllabus: false, trends: false });
  });

  it.each([
    ['https://a.test/x.pdf', 'https://a.test/x.pdf'],
    ['javascript:alert(1)', null],
    ['/x.pdf', null],
    [undefined, null],
  ])('safePdfUrl(%s) = %s', (input, expected) => {
    expect(safePdfUrl(input)).toBe(expected);
  });

  it('draws pages A4 wide, narrower on small screens, times the zoom', () => {
    expect(pageWidth(1200, 1)).toBe(794);
    expect(pageWidth(350, 1)).toBe(350);
    expect(pageWidth(350, 2)).toBe(700);
    expect(pageWidth(0, 1)).toBe(794);
  });

  it('rejects a PDF whose link is not http(s)', async () => {
    server.use(pdf('syllabus', 3, { pdf_url: 'ftp://x/y.pdf' }));
    await expect(syllabusApi.pdf(cbse, 12, 'syllabus', '3')).rejects.toThrow('not valid');
  });
});

describe('SyllabusCards', () => {
  it('is hidden below class 9 and shows syllabus only for class 11', async () => {
    server.use(plan('CLASS 8', 8));
    const { unmount } = renderWithProviders(<SyllabusCards />, { exam: cbse });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Syllabus and trends' })).not.toBeInTheDocument());
    unmount();

    server.use(plan('CLASS 11', 11));
    renderWithProviders(<SyllabusCards />, { exam: cbse });
    expect(await screen.findByRole('button', { name: /View Syllabus/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Trend Analysis' })).not.toBeInTheDocument();
  });

  it('opens the subject picker and goes to the picked subject', async () => {
    server.use(
      plan(),
      subjects('syllabus', [
        { subject_id: 3, subject_name: 'MATHEMATICS' },
        { subject_id: 4, subject_name: 'SOCIAL SCIENCE' },
      ]),
      subjects('trend', [{ subject_id: 5, subject_name: 'PHYSICS' }]),
    );
    renderWithProviders(<SyllabusCards />, { exam: cbse });

    await userEvent.click(await screen.findByRole('button', { name: /View Syllabus/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Select Subject for Syllabus' });
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Social Science' }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/syllabus?subject_id=4');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'View Trend Analysis' }));
    const trends = await screen.findByRole('dialog', { name: 'Select Subject for Trends' });
    await userEvent.click(await within(trends).findByRole('button', { name: 'Physics' }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/pyq-trends?subject_id=5');
  });

  it('says when there are no subjects, shows errors with a retry, and closes', async () => {
    let fail = true;
    server.use(
      plan(),
      http.get(`${BASE}/trend/subjects`, () =>
        fail
          ? HttpResponse.json({ success: false, message: 'Server down' }, { status: 500 })
          : HttpResponse.json({ success: true, data: { subjects: [] } }),
      ),
    );
    renderWithProviders(<SyllabusCards />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'View Trend Analysis' }));
    const dialog = await screen.findByRole('dialog');
    const retry = await within(dialog).findByRole('button', { name: 'Try again' });
    fail = false;
    await userEvent.click(retry);
    expect(await within(dialog).findByText('No Subjects Available')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('SyllabusScreen', () => {
  it('shows the subject PDF with "Subject · Class", page navigation and zoom', async () => {
    const { lib, rendered } = fakePdfJs(3);
    server.use(
      plan(),
      pdf('syllabus', 3, { subject_name: 'MATHEMATICS', class_name: 'CLASS 12', pdf_url: 'https://cdn.test/m.pdf' }),
    );
    renderWithProviders(<SyllabusScreen kind="syllabus" subjectId="3" />, { exam: cbse });

    expect(await screen.findByRole('heading', { level: 1, name: 'Mathematics · Class 12' })).toBeInTheDocument();
    expect(screen.getByText('Syllabus Analysis')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Syllabus Analysis: Mathematics, page 1 of 3' })).toBeInTheDocument();
    expect(lib.getDocument).toHaveBeenCalledWith('https://cdn.test/m.pdf');
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', 'https://cdn.test/m.pdf');

    const pages = screen.getByRole('navigation', { name: 'Pages' });
    expect(within(pages).getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await userEvent.click(within(pages).getByRole('button', { name: 'Next page' }));
    expect(await screen.findByRole('img', { name: /page 2 of 3/ })).toBeInTheDocument();
    const bottom = screen.getByRole('navigation', { name: 'Pages (bottom)' });
    await userEvent.click(within(bottom).getByRole('button', { name: 'Next page' }));
    expect(await screen.findByRole('img', { name: /page 3 of 3/ })).toBeInTheDocument();
    expect(within(bottom).getByRole('button', { name: 'Next page' })).toBeDisabled();
    await userEvent.click(within(bottom).getByRole('button', { name: 'Previous page' }));
    await waitFor(() => expect(rendered).toContain(3));

    const zoom = screen.getByRole('group', { name: 'Zoom' });
    expect(zoom).toHaveTextContent('100%');
    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom in' }));
    expect(zoom).toHaveTextContent('125%');
    for (let i = 0; i < 4; i += 1) await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom out' }));
    expect(zoom).toHaveTextContent('50%');
    expect(within(zoom).getByRole('button', { name: 'Zoom out' })).toBeDisabled();
  });

  it('says "No trend analysis found." for a subject without a PDF', async () => {
    server.use(
      plan(),
      http.get(`${BASE}/trend/subjects/9`, () =>
        HttpResponse.json({ success: false, code: 'SYLLABUS_NOT_FOUND', message: 'No trend analysis found', data: null }, { status: 404 }),
      ),
    );
    renderWithProviders(<SyllabusScreen kind="trend" subjectId="9" />, { exam: cbse });
    expect(await screen.findByText('No trend analysis found.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'PYQ Trends' })).toBeInTheDocument();
  });

  it('shows other load errors', async () => {
    server.use(plan(), http.get(`${BASE}/syllabus/subjects/3`, () => HttpResponse.json({ message: 'x' }, { status: 500 })));
    renderWithProviders(<SyllabusScreen kind="syllabus" subjectId="3" />, { exam: cbse });
    expect(await screen.findByText(/Something went wrong|try again/i)).toBeInTheDocument();
  });

  it('lists the subjects without (or with an invalid) subject id', async () => {
    server.use(plan(), subjects('trend', [{ subject_id: 5, subject_name: 'PHYSICS' }]));
    renderWithProviders(<SyllabusScreen kind="trend" subjectId="abc" />, { exam: cbse });
    expect(await screen.findByRole('heading', { name: 'Select Subject for Trends' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Physics' }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/pyq-trends?subject_id=5');
  });

  it('needs an active plan', async () => {
    server.use(noPlan);
    renderWithProviders(<SyllabusScreen kind="syllabus" subjectId="3" />, { exam: cbse });
    expect(await screen.findByText('Syllabus is available with an active plan.')).toBeInTheDocument();
  });

  it('shows plan load errors', async () => {
    server.use(http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ message: 'down' }, { status: 503 })));
    renderWithProviders(<SyllabusScreen kind="syllabus" subjectId="3" />, { exam: cbse });
    expect(await screen.findByText(/Something went wrong|try again/i)).toBeInTheDocument();
  });
});

describe('PdfViewer', () => {
  it('offers the PDF as a link when it cannot be shown', async () => {
    fakePdfJs(1, true);
    renderWithProviders(<PdfViewer url="https://cdn.test/x.pdf" title="X" />);
    expect(await screen.findByText(/couldn.t show the PDF here/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open PDF' })).toHaveAttribute('href', 'https://cdn.test/x.pdf');
  });

  it('hides page navigation for a one-page PDF', async () => {
    fakePdfJs(1);
    renderWithProviders(<PdfViewer url="https://cdn.test/x.pdf" title="X" />);
    expect(await screen.findByRole('img', { name: 'X, page 1 of 1' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('loads pdf.js from cdnjs once, and retries after a failed load', async () => {
    const scripts = () => [...document.head.querySelectorAll('script')].filter((s) => s.src.includes('cdnjs.cloudflare.com/ajax/libs/pdf.js'));

    const failed = loadPdfJs();
    expect(scripts()).toHaveLength(1);
    act(() => void scripts()[0]!.dispatchEvent(new Event('error')));
    await expect(failed).rejects.toThrow('pdf.js did not load');
    scripts()[0]!.remove();

    const loading = loadPdfJs();
    expect(loadPdfJs()).toBe(loading);
    const lib = { GlobalWorkerOptions: { workerSrc: '' }, getDocument: vi.fn() };
    window.pdfjsLib = lib;
    fireEvent.load(scripts()[0]!);
    await expect(loading).resolves.toBe(lib);
    expect(lib.GlobalWorkerOptions.workerSrc).toBe('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');
    expect(await loadPdfJs()).toBe(lib);
    scripts()[0]!.remove();
  });

  it('fails when the script loads without pdf.js', async () => {
    const loading = loadPdfJs();
    const script = [...document.head.querySelectorAll('script')].at(-1)!;
    fireEvent.load(script);
    await expect(loading).rejects.toThrow('pdf.js did not load');
    script.remove();
  });
});
