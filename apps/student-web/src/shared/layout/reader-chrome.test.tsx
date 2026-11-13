import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { testExam } from '@/test/exams';
import { AppChrome } from './exam-shell';
import { ReaderChrome } from './reader-chrome';

const examDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', '(student)', '[exam]');

const shellApis = [
  http.get(`${API}/api/v4/student/account`, () => HttpResponse.json({ success: true, data: { account_id: 1, first_name: 'Asha' } })),
  http.get(`${API}/api/v4/student/exams/purchased`, () =>
    HttpResponse.json({ success: true, data: { exams: [{ exam_id: 1, exam_slice: 'cbse', exam_name: 'CBSE' }] } }),
  ),
  http.get(`${API}/api/v4/student/plans/active`, () =>
    HttpResponse.json({ success: true, data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'X', duration_months: 12, status: 'active' }] } }),
  ),
];

describe('ReaderChrome', () => {
  it('keeps the header but drops the board sidebar and mobile bottom bar', () => {
    server.use(...shellApis);
    renderWithProviders(
      <ReaderChrome>
        <p>Chapter notes</p>
      </ReaderChrome>,
      { exam: testExam('cbse') },
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Chapter notes');
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('is what removes them: the dashboard chrome has them', () => {
    server.use(...shellApis);
    renderWithProviders(
      <AppChrome>
        <p>Dashboard</p>
      </AppChrome>,
      { exam: testExam('cbse') },
    );
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBeGreaterThan(0);
  });

  it('keeps the competitive navigation drawer (no rail) behind the header menu', () => {
    server.use(...shellApis);
    const { container } = renderWithProviders(
      <ReaderChrome>
        <p>Course</p>
      </ReaderChrome>,
      { exam: testExam('neet') },
    );
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument();
    expect(container.querySelector('.w-\\[76px\\]')).not.toBeInTheDocument();
  });
});

describe('reading pages', () => {
  it.each(['notes/[courseId]', 'notes/video/[noteId]', 'courses', 'courses/[courseId]'])(
    '%s renders in the header-only reader group, not the dashboard one',
    (route) => {
      expect(existsSync(join(examDir, '(reader)', route, 'page.tsx'))).toBe(true);
      expect(existsSync(join(examDir, '(app)', route, 'page.tsx'))).toBe(false);
    },
  );

  it('the reader group uses ReaderChrome', () => {
    expect(readFileSync(join(examDir, '(reader)', 'layout.tsx'), 'utf8')).toContain('<ReaderChrome>');
  });
});
