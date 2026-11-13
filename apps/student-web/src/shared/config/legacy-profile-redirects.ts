import { DEFAULT_EXAM, examList } from './exams';

/**
 * The previous app's account pages (/profile, /profile/parent, /profile/help, /change-password,
 * /request-account-delete) → /[exam]/profile… Read by next.config.ts; plain data (relative imports only).
 *
 * They had no exam in the URL: the exam comes from the remembered-exam cookie, else the default exam.
 * Query strings (e.g. ?edit=1) are passed on by Next. Temporary, since the target depends on the cookie.
 */
type Redirect = {
  source: string;
  destination: string;
  permanent: boolean;
  has?: { type: 'cookie'; key: string; value: string }[];
};

/** Same cookie as src/features/auth/device.ts. */
const EXAM_COOKIE = 'prepzy_exam';

const PAGES: Record<string, string> = {
  '/profile': '/profile',
  '/profile/parent': '/profile/parent',
  '/profile/help': '/profile/help',
  '/change-password': '/profile/change-password',
  '/request-account-delete': '/profile/request-account-delete',
};

export const legacyProfileRedirects: Redirect[] = Object.entries(PAGES).flatMap(([source, page]) => [
  ...examList.map((exam) => ({
    source,
    has: [{ type: 'cookie' as const, key: EXAM_COOKIE, value: exam.slug }],
    destination: `/${exam.slug}${page}`,
    permanent: false,
  })),
  { source, destination: `/${DEFAULT_EXAM}${page}`, permanent: false },
]);

/** The destination Next would pick (first match), for tests. */
export function resolveLegacyProfilePath(path: string, cookies: Record<string, string> = {}) {
  const match = legacyProfileRedirects.find(
    (rule) =>
      rule.source === path &&
      (rule.has ?? []).every((condition) => {
        const value = cookies[condition.key];
        return value !== undefined && new RegExp(`^${condition.value}$`).test(value);
      }),
  );
  return match?.destination ?? null;
}
