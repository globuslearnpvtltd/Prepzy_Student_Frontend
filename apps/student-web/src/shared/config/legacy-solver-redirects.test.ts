import { EXAMS } from './exams';
import { legacySolverRedirects } from './legacy-solver-redirects';

describe('legacy doubt solver redirects', () => {
  it('sends /solve to the remembered exam, else the default exam', () => {
    const solve = legacySolverRedirects.filter((r) => r.source === '/solve');
    expect(solve.find((r) => r.has?.[0]?.value === EXAMS.neet.slug)?.destination).toBe('/neet/doubt-solver');
    expect(solve.at(-1)).toEqual({ source: '/solve', destination: '/cbse/doubt-solver', permanent: false });
  });

  it('sends /upload to the ask step', () => {
    const upload = legacySolverRedirects.filter((r) => r.source === '/upload');
    expect(upload.every((r) => r.destination.endsWith('/doubt-solver?step=ask'))).toBe(true);
  });
});
