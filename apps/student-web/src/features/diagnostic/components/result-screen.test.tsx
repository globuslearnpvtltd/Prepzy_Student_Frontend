import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { getExam } from '@/shared/config/exams';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { toResult } from '../api';
import { DiagnosticResultScreen, overview } from './result-screen';

const cbse = getExam('cbse')!;

const activePlan = http.get(`${API}/api/v4/student/plans/active`, () =>
  HttpResponse.json({ success: true, data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 12', duration_months: 12, status: 'active' }] } }),
);

const subjects = [
  { subject_id: 1, name: 'Physics', pct: 80, correct: 8, questions: 10 },
  { subject_id: 2, name: 'Chemistry', pct: 55, correct: 5, questions: 10 },
  { subject_id: 3, name: 'Maths', pct: 30, correct: 3, questions: 10 },
];
const aiSummary = {
  summary: ['You are strong in Physics.', 'Maths needs work.'],
  strongest_subject: { subject_name: 'Physics', summary: 'Great grip on motion.' },
  needs_time: { subject_name: 'Maths', summary: 'Practise algebra daily.' },
  how_you_learn: { tagline: 'Concept first', suggestion: 'Read before you drill.' },
};

describe('report overview', () => {
  it('uses the AI summary lines and cards when present', () => {
    const { lines, cards } = overview(toResult({ subject_strengths: subjects, ai_summary: aiSummary }));
    expect(lines).toEqual(['You are strong in Physics.', 'Maths needs work.']);
    expect(cards).toEqual([
      { label: 'Strongest subject', title: 'Physics', body: 'Great grip on motion.' },
      { label: 'Needs time', title: 'Maths', body: 'Practise algebra daily.' },
      { label: 'How you learn', title: 'Concept first', body: 'Read before you drill.' },
    ]);
  });

  it('falls back to score-based lines when the AI summary is empty, and skips unknown pace and missing style', () => {
    const result = toResult({
      subject_strengths: subjects,
      profiling_parameters: { learning_pace: { band: 'warp' }, thinking_style: {} },
      ai_summary: { summary: [] },
    });
    const { lines, cards } = overview(result);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Maths needs the most attention');
    expect(cards).toEqual([]);
  });

  it('with no subjects has nothing to say about strengths', () => {
    const { lines, cards, strongest, weakest } = overview(toResult({ profiling_parameters: { learning_pace: { band: 'rushing' } } }));
    expect(strongest).toBeNull();
    expect(weakest).toBeNull();
    expect(lines).toEqual([expect.stringContaining('moved quickly')]);
    expect(cards).toEqual([]);
  });
});

describe('DiagnosticResultScreen', () => {
  it('asks for a class without an active plan', async () => {
    server.use(http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: true, data: { plans: [] } })));
    renderWithProviders(<DiagnosticResultScreen />, { exam: cbse });
    expect(await screen.findByText('No active class')).toBeInTheDocument();
  });

  it('shows the AI report, links to the built plan and explains unknown levels with defaults', async () => {
    server.use(
      activePlan,
      http.get(`${API}/api/v1/diagnostic/diagnostic-results/12`, () =>
        HttpResponse.json({
          success: true,
          data: {
            status: 'submitted',
            total_questions: 30,
            subject_strengths: subjects,
            profiling_parameters: {
              overall_percentage: 55.4,
              academic_band: 'genius',
              learning_pace: { band: 'normal', time_taken_seconds: 90, total_time_seconds: 1800 },
              thinking_style: { label: 'Mixed', leaning: 'artistic' },
            },
            ai_summary: aiSummary,
          },
        }),
      ),
      http.get(`${API}/api/v1/study-plan/status/12`, () => HttpResponse.json({ success: true, data: { can_create: false, has_plan: true } })),
    );
    renderWithProviders(<DiagnosticResultScreen />, { exam: cbse });
    expect(await screen.findByText('Based on 30 questions across 3 subjects')).toBeInTheDocument();
    expect(screen.queryByText(/auto-submitted/)).not.toBeInTheDocument();
    expect(screen.getByText('Concept first')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /View My Study Plan/ })).toHaveAttribute('href', '/cbse/study-plan');

    // desktop section list
    const nav = screen.getByRole('navigation', { name: 'Report sections' });
    await userEvent.click(within(nav).getByRole('button', { name: /Subjects/ }));
    expect(within(nav).getByRole('button', { name: /Subjects/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Strongest')).toBeInTheDocument();
    expect(screen.getByText('Needs focus')).toBeInTheDocument();
    expect(screen.getByText('5 of 10 correct')).toBeInTheDocument();

    await userEvent.click(within(nav).getByRole('button', { name: /How You Learn/ }));
    expect(screen.getByText('55% overall')).toBeInTheDocument();
    expect(screen.getByText('1 min 30 sec of 30 min')).toBeInTheDocument();
    // unknown band falls back to the first level; unknown leaning to "No clear style"
    expect(screen.getByText('Below Basic')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('No clear style')).toHaveAttribute('aria-current', 'true');
  });
});
