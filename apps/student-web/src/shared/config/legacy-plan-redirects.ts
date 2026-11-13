import { EXAMS } from './exams';

/**
 * The previous app's plan, checkout and billing URLs → /manage-plans and the common checkout /purchase. Read by
 * next.config.ts; plain data (relative imports only) so it can be unit-tested.
 *
 * /purchase is again the checkout of every exam (the previous app's URL): the page picks the exam from `?exam=`, else
 * the remembered exam, else the first purchasable one. The exam-scoped checkout this app had before,
 * /:exam/plans/purchase, goes there with `?exam=<that exam>` (a link's own ?exam= wins, as it did on that page).
 * Next passes the original query string (CLASSID, stream_id …) on.
 */
type Redirect = {
  source: string;
  destination: string;
  permanent: boolean;
  has?: { type: 'query' | 'cookie'; key: string; value?: string }[];
};

/** The common checkout page; same path as the previous app's /purchase. */
const CHECKOUT = '/purchase';

const competitive = EXAMS.neet.slug;

/** The common Manage Plans page (every exam's plans and invoices); same path as the previous app's /manage-plans. */
const MANAGE_PLANS = '/manage-plans';

export const legacyPlanRedirects: Redirect[] = [
  { source: '/purchase-plan', destination: CHECKOUT, permanent: false },
  { source: '/:exam/plans/purchase', has: [{ type: 'query', key: 'exam' }], destination: CHECKOUT, permanent: false },
  { source: '/:exam/plans/purchase', destination: `${CHECKOUT}?exam=:exam`, permanent: false },
  { source: '/view-plans', destination: MANAGE_PLANS, permanent: true },
  { source: '/view-subscription', destination: MANAGE_PLANS, permanent: true },
  { source: '/invoice/:id', destination: MANAGE_PLANS, permanent: true },
  { source: `/${competitive}/manage-plans`, destination: MANAGE_PLANS, permanent: true },
  { source: `/${competitive}/purchase-plan`, destination: `${CHECKOUT}?exam=${competitive}`, permanent: true },
  { source: `/${competitive}/billing-history`, destination: MANAGE_PLANS, permanent: true },
  { source: '/pre-dashboard', destination: '/welcome', permanent: true },
];

/** The destination Next would pick (first match, path params filled in), for tests. */
export function resolveLegacyPlanPath(path: string, query: Record<string, string> = {}, cookies: Record<string, string> = {}) {
  for (const rule of legacyPlanRedirects) {
    const names: string[] = [];
    const pattern = rule.source.replace(/:(\w+)/g, (_, name: string) => {
      names.push(name);
      return '([^/]+)';
    });
    const match = new RegExp(`^${pattern}$`).exec(path);
    if (!match) continue;
    const applies = (rule.has ?? []).every((condition) => {
      const value = condition.type === 'query' ? query[condition.key] : cookies[condition.key];
      return value !== undefined && (condition.value === undefined || new RegExp(`^${condition.value}$`).test(value));
    });
    if (applies) return names.reduce((destination, name, index) => destination.replace(`:${name}`, match[index + 1]!), rule.destination);
  }
  return null;
}
