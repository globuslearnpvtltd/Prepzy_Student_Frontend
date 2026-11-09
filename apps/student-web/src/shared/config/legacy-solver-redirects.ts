import { DEFAULT_EXAM, examList } from './exams';

/**
 * The previous app's doubt solver URLs (/solve, /upload) → /[exam]/doubt-solver. Read by next.config.ts;
 * plain data (relative imports only) so it can be unit-tested. The old routes weren't exam-scoped, so the
 * exam comes from the remembered-exam cookie, else the default exam. `?step=` is passed on.
 */
type Redirect = {
  source: string;
  destination: string;
  permanent: boolean;
  has?: { type: 'query' | 'cookie'; key: string; value: string }[];
};

/** Same cookie as src/features/auth/device.ts. */
const EXAM_COOKIE = 'prepzy_exam';

const solver = (source: string, query = ''): Redirect[] => [
  ...examList.map((exam) => ({
    source,
    has: [{ type: 'cookie' as const, key: EXAM_COOKIE, value: exam.slug }],
    destination: `/${exam.slug}/doubt-solver${query}`,
    permanent: false,
  })),
  { source, destination: `/${DEFAULT_EXAM}/doubt-solver${query}`, permanent: false },
];

export const legacySolverRedirects: Redirect[] = [
  ...solver('/solve'),
  // /upload was the old "type or snap your problem" page; its successor is the ask step.
  ...solver('/upload', '?step=ask'),
];
