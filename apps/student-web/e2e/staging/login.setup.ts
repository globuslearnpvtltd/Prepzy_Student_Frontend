import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test as setup, type APIResponse } from '@playwright/test';
import { STAGING_DEVICE, STAGING_SESSION, stagingApiUrl, stagingLogin, stagingSiteUrl } from './target';


const HINTS: Record<string, string> = {
  STUDENT_NOT_FOUND: 'E2E_PHONE is not an active student on this server.',
  INVALID_OTP:
    'E2E_OTP is not the fixed code of this student. If the student has no fixed code, a real WhatsApp code was just sent: set the fixed code first (README.md).',
  OTP_EXPIRED: 'The code expired; run again.',
  MAX_LOGIN_SESSIONS: 'The test student is signed in on two other devices. Log out of one of them, then run again.',
  TOO_MANY_REQUESTS: 'Too many login attempts for this number or network. Wait 10 minutes.',
  OTP_DELIVERY_FAILED: 'The server tried to send a WhatsApp code and failed: the test student has no fixed code (README.md).',
};

async function refusal(step: string, response: APIResponse): Promise<string> {
  const body = (await response.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code ?? `HTTP_${response.status()}`;
  return `${step} was refused (${response.status()} ${code}). ${HINTS[code] ?? ''}`.trim();
}

setup('sign in the staging test student', async ({ playwright }) => {
  const { phone, otp } = stagingLogin();
  const api = await playwright.request.newContext({ baseURL: stagingApiUrl() });

  try {
    const requested = await api.post('/api/v4/auth/login-otp', { data: { phone, fingerprint: STAGING_DEVICE } });
    expect(requested.ok(), await refusal('Asking for the login code', requested)).toBe(true);

    const verified = await api.post('/api/v4/auth/verify-login-otp', {
      data: { phone, otp, fingerprint: STAGING_DEVICE },
    });
    expect(verified.ok(), await refusal('Checking the login code', verified)).toBe(true);

    // the site reads the cookie on its own host, so it has to be valid there too
    const state = await api.storageState();
    const session = state.cookies.find((cookie) => cookie.name === 'accessToken');
    expect(session, 'The server answered but set no session cookie').toBeTruthy();
    const cookieDomain = (session?.domain ?? '').replace(/^\./, '');
    const siteHost = new URL(stagingSiteUrl()).hostname;
    expect(
      siteHost === cookieDomain || siteHost.endsWith(`.${cookieDomain}`),
      `The session cookie is for "${cookieDomain}" but the website is "${siteHost}": the website would not see the login. Check E2E_BASE_URL and E2E_API_URL.`,
    ).toBe(true);

    mkdirSync(dirname(STAGING_SESSION), { recursive: true });
    await api.storageState({ path: STAGING_SESSION });
  } finally {
    await api.dispose();
  }
});
