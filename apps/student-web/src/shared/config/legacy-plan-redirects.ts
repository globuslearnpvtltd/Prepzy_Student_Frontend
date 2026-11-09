import { DEFAULT_EXAM, EXAMS, examList } from './exams';

/**
 * The previous app's plan, checkout and billing URLs → /[exam]/plans… Read by next.config.ts; plain data
 * (relative imports only) so it can be unit-tested.
 *
 * /purchase was shared by every exam: the exam comes from `?exam=` (old upgrade buttons), else the
 * remembered-exam cookie, else the default exam. Query strings (CLASSID, stream_id …) are passed on.
 */
type Redirect = {
  source: string;
  destination: string;
  permanent: boolean;
  has?: { type: 'query' | 'cookie'; key: string; value: string }[];
};

/** Same cookie as src/features/auth/device.ts. */
const EXAM_COOKIE = 'prepzy_exam';

const checkout = (source: string): Redirect[] => [
  ...examList.map((exam) => ({
    source,
    has: [{ type: 'query' as const, key: 'exam', value: `(${exam.slug}|${exam.examSlice})` }],
    destination: `/${exam.slug}/plans/purchase`,
    permanent: false,
  })),
  ...examList.map((exam) => ({
    source,
    has: [{ type: 'cookie' as const, key: EXAM_COOKIE, value: exam.slug }],
    destination: `/${exam.slug}/plans/purchase`,
    permanent: false,
  })),
  { source, destination: `/${DEFAULT_EXAM}/plans/purchase`, permanent: false },
];

const board = EXAMS.cbse.slug;
const competitive = EXAMS.neet.slug;

export const legacyPlanRedirects: Redirect[] = [
  ...checkout('/purchase'),
  ...checkout('/purchase-plan'),
  { source: '/view-plans', destination: `/${board}/plans`, permanent: true },
  { source: '/view-subscription', destination: `/${board}/plans`, permanent: true },
  { source: '/invoice/:id', destination: `/${board}/plans`, permanent: true },
  { source: `/${competitive}/manage-plans`, destination: `/${competitive}/plans`, permanent: true },
  { source: `/${competitive}/purchase-plan`, destination: `/${competitive}/plans/purchase`, permanent: true },
  { source: `/${competitive}/billing-history`, destination: `/${competitive}/plans/billing`, permanent: true },
  { source: '/pre-dashboard', destination: '/welcome', permanent: true },
];

/** The destination Next would pick (first match), for tests. */
export function resolveLegacyPlanPath(path: string, query: Record<string, string> = {}, cookies: Record<string, string> = {}) {
  const match = legacyPlanRedirects.find(
    (rule) =>
      rule.source.replace(':id', path.split('/').pop() ?? '') === path &&
      (rule.has ?? []).every((condition) => {
        const value = condition.type === 'query' ? query[condition.key] : cookies[condition.key];
        return value !== undefined && new RegExp(`^${condition.value}$`).test(value);
      }),
  );
  return match?.destination ?? null;
}
