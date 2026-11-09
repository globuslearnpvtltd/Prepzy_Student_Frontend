import type { LegacyRedirect } from './legacy-test-redirects';

/** Old portal URLs (/parents-login, /partner-dashboard …) → the portal base paths. Read by next.config.ts. */
const MAP: Record<string, string> = {
  '/parents-login': '/parents/login',
  '/parents-dashboard': '/parents/dashboard',
  '/schools-login': '/schools/login',
  '/schools-dashboard': '/schools/dashboard',
  '/schools-student/:studentId': '/schools/students/:studentId',
  '/partner-login': '/partners/login',
  '/partner-signup': '/partners/signup',
  '/partner-dashboard': '/partners/dashboard',
  '/partner-payout': '/partners/payouts',
  '/partner-bank-details': '/partners/bank-details',
};

export const legacyPortalRedirects: LegacyRedirect[] = Object.entries(MAP).map(([source, destination]) => ({
  source,
  destination,
  permanent: true,
}));
