import type { BrowserContext, Page } from '@playwright/test';
import { PARENT_MOCKS } from '../visual/mocks-parents';
import { PARTNER_MOCKS } from '../visual/mocks-partners';
import { SCHOOLS_MOCKS } from '../visual/mocks-schools';
import { expect, mockApi, test } from './fixtures';

/** The visual-compare mocks are keyed by path; every portal read is a GET. */
const asGets = (mocks: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(mocks).map(([path, json]) => [`GET ${path}`, json as object]));

const baseURL = () => test.info().project.use.baseURL!;
/** Same server on a portal subdomain: Chromium resolves *.localhost to this machine. */
const onSubdomain = (portal: string, path: string) => {
  const url = new URL(baseURL());
  url.hostname = `${portal}.${url.hostname}`;
  url.pathname = path;
  return url.toString();
};

/** Pretends the backend issued the portal session (the real cookie comes from the API). */
async function signInPortal(context: BrowserContext, cookie: string, url = baseURL()) {
  await context.addCookies([{ name: cookie, value: 'e2e', url }]);
}

async function typeCode(page: Page, code: string) {
  for (const [i, digit] of [...code].entries()) await page.getByLabel(`Digit ${i + 1}`).fill(digit);
}

test.describe('portal routing', () => {
  test('signed-out visitors land on each portal login', async ({ page }) => {
    for (const portal of ['parents', 'schools', 'partners']) {
      await page.goto(`/${portal}/dashboard`);
      await expect(page).toHaveURL(new RegExp(`/${portal}/login$`));
    }
  });

  test('old portal URLs redirect to the new pages', async ({ page }) => {
    await page.goto('/parents-login');
    await expect(page).toHaveURL(/\/parents\/login$/);
    await page.goto('/partner-signup');
    await expect(page).toHaveURL(/\/partners\/signup$/);
    await expect(page.getByLabel('First name')).toBeVisible();
  });

  test('a student session does not open a portal', async ({ page, context }) => {
    await context.addCookies([{ name: 'accessToken', value: 'e2e', url: baseURL() }]);
    await page.goto('/schools/dashboard');
    await expect(page).toHaveURL(/\/schools\/login$/);
  });

  test('portal subdomains serve short URLs', async ({ page, context }) => {
    await mockApi(page, asGets(PARENT_MOCKS));
    await page.goto(onSubdomain('parents', '/dashboard'));
    await expect(page).toHaveURL(onSubdomain('parents', '/parents/login'));
    await expect(page.getByRole('button', { name: 'Send verification code' })).toBeVisible();

    await signInPortal(context, 'mentorAccessToken', onSubdomain('parents', '/'));
    await page.goto(onSubdomain('parents', '/dashboard'));
    // Rewrite, not redirect: the address bar keeps the short URL.
    await expect(page).toHaveURL(onSubdomain('parents', '/dashboard'));
    await expect(page.getByText('Ravi Kumar').first()).toBeVisible();
  });
});

test('parents: email code login opens the dashboard', async ({ page, context }) => {
  await mockApi(page, {
    ...asGets(PARENT_MOCKS),
    'POST /api/v4/parents/auth/otp': (body) => {
      expect(body).toEqual({ method: 'email', contact: 'sunita@example.com' });
      return { success: true, message: 'OTP sent successfully', data: null };
    },
    'POST /api/v4/parents/auth/verify': (body) => {
      expect(body).toEqual({ contact: 'sunita@example.com', otp: '123456' });
      return { success: true, message: 'Logged in successfully', data: { parent_data: { account_id: 501 } } };
    },
  });

  await page.goto('/parents/login');
  await page.getByLabel('Email').fill('sunita@example.com');
  await page.getByRole('button', { name: 'Send verification code' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  await signInPortal(context, 'mentorAccessToken');
  await typeCode(page, '123456');
  await page.getByRole('button', { name: 'Verify & sign in' }).click();

  await expect(page).toHaveURL(/\/parents\/dashboard$/);
  await expect(page.getByText('Ravi Kumar').first()).toBeVisible();
});

test('schools: login, dashboard and a student page', async ({ page, context }) => {
  await mockApi(page, {
    ...asGets(SCHOOLS_MOCKS),
    'POST /api/v4/schools/auth/otp': (body) => {
      expect(body).toEqual({ email: 'anita.rao@greenfield.edu' });
      return { success: true, message: 'OTP sent successfully', data: null };
    },
    'POST /api/v4/schools/auth/verify': (body) => {
      expect(body).toEqual({ email: 'anita.rao@greenfield.edu', otp: '123456' });
      return {
        success: true,
        message: 'Logged in successfully',
        data: { teacher_data: { account_id: 11, first_name: 'Anita', email: 'anita.rao@greenfield.edu' } },
      };
    },
  });

  await page.goto('/schools/login');
  await page.getByLabel('Email').fill('anita.rao@greenfield.edu');
  await page.getByRole('button', { name: 'Send verification code' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  await signInPortal(context, 'teacherAccessToken');
  await typeCode(page, '123456');
  await page.getByRole('button', { name: 'Verify & sign in' }).click();

  await expect(page).toHaveURL(/\/schools\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Greenfield Public School, Bengaluru' })).toBeVisible();

  // The old student URL still works and keeps its class.
  const response = await page.goto('/schools-student/7?class_id=10');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/schools\/students\/7\?class_id=10$/);
});

test('partners: WhatsApp login, dashboard and payouts', async ({ page, context }) => {
  await mockApi(page, {
    ...asGets(PARTNER_MOCKS),
    'POST /api/v4/partners/auth/login/otp': (body) => {
      expect(body).toEqual({ phone: '+919876543210' });
      return { success: true };
    },
    'POST /api/v4/partners/auth/login/verify': { success: true },
  });

  await page.goto('/partners/login');
  await page.getByLabel('Mobile number').fill('9876543210');
  await page.getByRole('button', { name: 'Get OTP on WhatsApp' }).click();
  await expect(page.getByLabel('Digit 1')).toBeVisible();

  await signInPortal(context, 'partnerAccessToken');
  await typeCode(page, '123456');
  await page.getByRole('button', { name: 'Verify & sign in' }).click();

  await expect(page).toHaveURL(/\/partners\/dashboard$/);
  await expect(page.getByText('ANITA50').first()).toBeVisible();

  await page.goto('/partners/payouts');
  await expect(page.getByRole('heading', { name: 'Payouts', level: 1 })).toBeVisible();
  // Latest request is "approved", so a new request is blocked until it settles.
  await expect(page.getByText(/approved/i).first()).toBeVisible();
});
