import { EXAMS, examList } from './exams';
import { legacySyllabusRedirects } from './legacy-syllabus-redirects';

describe('legacy syllabus / trend analysis redirects', () => {
  it('sends /syllabus to the remembered board exam, else the first board exam', () => {
    const syllabus = legacySyllabusRedirects.filter((r) => r.source === '/syllabus');
    expect(syllabus.find((r) => r.has?.[0]?.value === EXAMS.jac.slug)?.destination).toBe('/jac/syllabus');
    expect(syllabus.at(-1)).toEqual({ source: '/syllabus', destination: '/cbse/syllabus', permanent: false });
  });

  it('sends /trend-analysis to the PYQ trends page', () => {
    const trends = legacySyllabusRedirects.filter((r) => r.source === '/trend-analysis');
    expect(trends.length).toBeGreaterThan(0);
    expect(trends.every((r) => /^\/[a-z-]+\/pyq-trends$/.test(r.destination))).toBe(true);
  });

  it('never sends to a non-board exam', () => {
    const boardSlugs = examList.filter((exam) => exam.category === 'board').map((exam) => exam.slug);
    for (const redirect of legacySyllabusRedirects) {
      expect(boardSlugs).toContain(redirect.destination.split('/')[1]);
    }
  });
});
