/**
 * The student session cookie names, the same as the backend's (`src/modules/auth/session.service.ts` `cookieNames`):
 * per application and per environment, e.g. `prepzy_student_prod_access_token`, so the student app, the CMS and the
 * staging / production deployments (all on `.prepzy.ai`) never read each other's cookies. The backend sets them
 * (HTTP-only); the app only checks whether one is present (middleware). NEXT_PUBLIC_ENV must match the backend's
 * NODE_ENV (development / staging / production).
 */
const ENV_TAG: Record<string, string> = { development: 'dev', test: 'test', staging: 'staging', production: 'prod' };

export const COOKIE_APP = 'student';

export function studentCookieNames(appEnv: string = process.env.NEXT_PUBLIC_ENV ?? 'development') {
  const prefix = `prepzy_${COOKIE_APP}_${ENV_TAG[appEnv] ?? ENV_TAG.development}`;
  return { access: `${prefix}_access_token`, session: `${prefix}_session_token` };
}

/**
 * Earlier access-cookie names that still count as signed in until the backend swaps them for the current ones on the
 * first API call (or answers 401 and clears them): this app's previous name, and the previous app's.
 */
export const PREVIOUS_ACCESS_COOKIES = ['prepzyAccessToken', 'accessToken'] as const;
