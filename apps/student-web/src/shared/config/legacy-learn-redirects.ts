import { examList } from './exams';
import type { LegacyRedirect } from './legacy-test-redirects';

/**
 * Old learn / notes / course / account URLs → their new pages, so bookmarks, emails and links from the
 * marketing site keep working. Read by next.config.ts. More specific rules come first (Next uses the first match).
 */
const exam = `:exam(${examList.map((e) => e.slug).join('|')})`;
const competitive = `:exam(${examList
  .filter((e) => e.category === 'competitive')
  .map((e) => e.slug)
  .join('|')})`;

const rule = (source: string, destination: string): LegacyRedirect => ({ source, destination, permanent: true });

export const legacyLearnRedirects: LegacyRedirect[] = [
  // Board learn: /cbse/learns/course/… → /cbse/learn/…
  rule(`/${exam}/learns/course/:course/module/:module/lecture/:lecture`, '/:exam/learn/:course/:module/lecture/:lecture'),
  rule(`/${exam}/learns/course/:course/module/:module/pyqs`, '/:exam/learn/:course/:module/pyqs'),
  rule(`/${exam}/learns/course/:course/module/:module/ncert-questions`, '/:exam/learn/:course/:module/ncert-questions'),
  rule(`/${exam}/learns/course/:course/module/:module`, '/:exam/learn/:course/:module'),
  // Assessment start pages inside a course open the test player by type.
  rule(`/${exam}/learns/course/:course/assessments/final_exam/:id`, '/:exam/tests/final/:id'),
  rule(`/${exam}/learns/course/:course/assessments/mid_term_exam/:id`, '/:exam/tests/mid/:id'),
  rule(`/${exam}/learns/course/:course/assessments/:type/:id`, '/:exam/tests/quiz/:id'),
  rule(`/${exam}/learns/course/:course`, '/:exam/learn/:course'),
  // Course-level assessments list → the course (its chapters hold the tests).
  rule(`/${exam}/assessments/:course`, '/:exam/learn/:course'),

  // Competitive learn: /neet/learn/course/:c/module/:m/<step> → /neet/learn/:c/:m/<step>
  rule(`/${competitive}/learn/course/:course/module/:module/chapterPyq`, '/:exam/learn/:course/:module/chapter-pyq'),
  rule(`/${competitive}/learn/course/:course/module/:module/:step`, '/:exam/learn/:course/:module/:step'),
  rule(`/${competitive}/learn/course/:course/module/:module`, '/:exam/learn/:course/:module'),
  rule(`/${competitive}/learn/course/:course`, '/:exam/learn/:course'),
  // The old NEET analytics page was a "coming soon" stub.
  rule(`/${competitive}/analytics`, '/:exam/dashboard'),

  // Notes and courses
  rule(`/${exam}/notes-view/:course`, '/:exam/notes/:course'),
  rule(`/${exam}/summary-video/:note`, '/:exam/notes/video/:note'),
  rule(`/${exam}/course-detail/:course`, '/:exam/courses/:course'),

  // Legacy pages folded into others
  rule(`/${exam}/personal-info`, '/:exam/profile'),
  rule(`/${exam}/exam/:id`, '/:exam/assessments'),
];

/** Where an old path goes (first matching rule), or null. Mirrors Next's matching for these patterns; used in tests. */
export function resolveLegacyLearnPath(pathname: string, rules: LegacyRedirect[] = legacyLearnRedirects): string | null {
  for (const { source, destination } of rules) {
    const names: string[] = [];
    const pattern = source.replace(/:(\w+)(\(([^)]+)\))?/g, (_, name: string, _group, alternatives?: string) => {
      names.push(name);
      return alternatives ? `(${alternatives})` : '([^/]+)';
    });
    const match = new RegExp(`^${pattern}$`).exec(pathname);
    if (!match) continue;
    return destination.replace(/:(\w+)/g, (_, name: string) => match[names.indexOf(name) + 1] ?? '');
  }
  return null;
}
