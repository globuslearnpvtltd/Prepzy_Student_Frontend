/**
 * The student session cookie names: one pair per environment, `prepzy_student_{dev|test|staging|prod}_access_token` /
 * `_session_token`, so logging out of staging never logs the student out of production. "student" keeps them apart
 * from the CMS's cookies. The environment is this website's `NEXT_PUBLIC_ENV`: every API request sends it
 * (`X-Prepzy-Env`, see api-client), the backend names the cookies after it (`session.service.ts` `cookieNames`), and
 * the middleware checks the same name, so they always agree.
 */
export const COOKIE_APP = 'student';
export const ENV_HEADER = 'X-Prepzy-Env';

const ENV_TAG: Record<string, string> = { development: 'dev', test: 'test', staging: 'staging', production: 'prod' };

export function studentCookieNames(appEnv: string = process.env.NEXT_PUBLIC_ENV ?? 'development') {
  const prefix = `prepzy_${COOKIE_APP}_${ENV_TAG[appEnv] ?? ENV_TAG.development}`;
  return { access: `${prefix}_access_token`, session: `${prefix}_session_token` };
}

/**
 * Earlier access-cookie names that still count as signed in until the backend swaps them for this environment's on
 * the first API call (or answers 401 and clears them): this app's earlier names and the previous app's.
 */
export const PREVIOUS_ACCESS_COOKIES = ['prepzyAccessToken', `prepzy_${COOKIE_APP}_access_token`, 'accessToken'] as const;
