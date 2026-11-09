import { examList, type TestTypeKey } from './exams';

/**
 * Old test player / result URLs (bookmarks, emails, shared links) → the unified engine routes
 * `/[exam]/tests/[testType]/[id]` and `/[exam]/tests/[testType]/result/[attemptId]`.
 * Read by next.config.ts; kept here (plain data, relative imports only) so it can be unit-tested.
 */
const PLAYER: Record<string, TestTypeKey> = {
  'mock-exam': 'mock',
  'pyq-exam': 'pyq',
  'chapter-pyq': 'chapter-pyq',
  'chapter-pyq-exam': 'chapter-pyq',
  'custom-exam': 'custom',
  'custom-exam-view': 'custom',
  'mid-exam': 'mid',
  'final-exam': 'final',
  'quiz-exam': 'quiz',
  'practice-exam': 'practice',
  'dpp-exam': 'dpp',
  dpp: 'dpp',
};

const RESULT: Record<string, TestTypeKey> = {
  'mock-result': 'mock',
  'mock-exam-result': 'mock',
  'pyq-result': 'pyq',
  'pyq-exam-result': 'pyq',
  'chapter-pyq-result': 'chapter-pyq',
  'custom-result': 'custom',
  'custom-exam-result': 'custom',
  'mid-result': 'mid',
  'final-exam-result': 'final',
  'quiz-result': 'quiz',
  'practice-result': 'practice',
  'dpp-result': 'dpp',
};

export interface LegacyRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}

const examPattern = `:exam(${examList.map((exam) => exam.slug).join('|')})`;

export const legacyTestRedirects: LegacyRedirect[] = [
  ...Object.entries(PLAYER).map(([segment, type]) => ({
    source: `/${examPattern}/${segment}/:id`,
    destination: `/:exam/tests/${type}/:id`,
    permanent: true,
  })),
  ...Object.entries(RESULT).map(([segment, type]) => ({
    source: `/${examPattern}/${segment}/:id`,
    destination: `/:exam/tests/${type}/result/:id`,
    permanent: true,
  })),
];

/** Where an old path goes, or null. Mirrors Next's matching for these simple patterns (used in tests). */
export function resolveLegacyTestPath(pathname: string): string | null {
  const [, exam, segment, id, ...rest] = pathname.split('/');
  if (!exam || !segment || !id || rest.length > 0) return null;
  if (!examList.some((e) => e.slug === exam)) return null;
  const player = PLAYER[segment];
  if (player) return `/${exam}/tests/${player}/${id}`;
  const result = RESULT[segment];
  return result ? `/${exam}/tests/${result}/result/${id}` : null;
}
