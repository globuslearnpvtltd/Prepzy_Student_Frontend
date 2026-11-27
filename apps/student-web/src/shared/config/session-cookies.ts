/**
 * The student session cookie names, the same as the backend's (`src/modules/auth/session.service.ts` `cookieNames`)
 * and the same in every environment (localhost, staging, production), so the cookie the backend sets is always the
 * one this app checks. "student" keeps them apart from the CMS's cookies. The backend sets them (HTTP-only); the app
 * only checks whether the access cookie is present (middleware).
 */
export const COOKIE_APP = 'student';

export const STUDENT_COOKIES = {
  access: `prepzy_${COOKIE_APP}_access_token`,
  session: `prepzy_${COOKIE_APP}_session_token`,
} as const;

/**
 * Earlier access-cookie names that still count as signed in until the backend swaps them for the current ones on the
 * first API call (or answers 401 and clears them): this app's previous names and the previous app's.
 */
export const PREVIOUS_ACCESS_COOKIES = [
  'prepzyAccessToken',
  ...['dev', 'test', 'staging', 'prod'].map((tag) => `prepzy_${COOKIE_APP}_${tag}_access_token`),
  'accessToken',
] as const;
