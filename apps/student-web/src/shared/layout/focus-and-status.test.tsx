import { act, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useExam } from '@/shared/hooks/use-exam';
import { apiClient } from '@/shared/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { FocusChrome } from './focus-chrome';
import { LimitDialog } from './limit-dialog';
import { HomeLink, PageSpinner, StatusScreen } from './status-screens';
import { testExam } from '@/test/exams';

const neet = testExam('neet');
const cbse = testExam('cbse');

const shellApis = [
  http.get(`${API}/api/v4/student/account`, () => HttpResponse.json({ success: true, data: { account_id: 1, first_name: 'Asha' } })),
  http.get(`${API}/api/v4/student/exams/purchased`, () =>
    HttpResponse.json({ success: true, data: { exams: [{ exam_id: 2, exam_slice: 'neet-ug', exam_name: 'NEET' }] } }),
  ),
  http.get(`${API}/api/v4/student/plans/active`, () =>
    HttpResponse.json({ success: true, data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'X', duration_months: 12, status: 'active' }] } }),
  ),
];

describe('FocusChrome', () => {
  it('keeps the header and the competitive icon rail around the player', () => {
    server.use(...shellApis);
    renderWithProviders(
      <FocusChrome>
        <p>Player</p>
      </FocusChrome>,
      { exam: neet },
    );
    expect(screen.getByRole('main')).toHaveTextContent('Player');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
  });

  it('has no sidebar for board exams', () => {
    server.use(...shellApis);
    const { container } = renderWithProviders(
      <FocusChrome>
        <p>Player</p>
      </FocusChrome>,
      { exam: cbse },
    );
    expect(screen.getByRole('main')).toHaveTextContent('Player');
    expect(container.querySelector('aside')).not.toBeInTheDocument();
  });
});

describe('status screens', () => {
  it('renders title, description, action, spinner and home link', () => {
    renderWithProviders(
      <>
        <StatusScreen title="Not found" description="Nothing here" action={<HomeLink />} />
        <StatusScreen title="Bare" />
        <PageSpinner />
        <HomeLink href="/neet/dashboard">Dashboard</HomeLink>
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Not found' })).toBeInTheDocument();
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/neet/dashboard');
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });
});

describe('LimitDialog inside an exam', () => {
  const limited = (body: Record<string, unknown>) => http.get(`${API}/api/limited`, () => HttpResponse.json(body, { status: 429 }));

  it('links to the exam plans and closes when followed', async () => {
    server.use(limited({ message: 'Daily doubt limit reached.' }));
    renderWithProviders(<LimitDialog />, { exam: neet });
    await act(() => apiClient.get('/api/limited').catch(() => undefined));
    const link = await screen.findByRole('link', { name: 'See plans' });
    expect(link).toHaveAttribute('href', '/purchase?exam=neet');
    await userEvent.click(link);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('falls back to a generic message and closes on Escape', async () => {
    server.use(limited({ message: '' }));
    renderWithProviders(<LimitDialog />);
    await act(() => apiClient.get('/api/limited').catch(() => undefined));
    const dialog = await screen.findByRole('dialog', { name: 'Limit reached' });
    expect(dialog).toHaveTextContent("You've reached your plan's limit.");
    expect(screen.queryByRole('link', { name: 'See plans' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('useExam', () => {
  it('throws outside an exam route', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useExam())).toThrow('useExam must be used inside an /[exam] route');
    spy.mockRestore();
  });
});
