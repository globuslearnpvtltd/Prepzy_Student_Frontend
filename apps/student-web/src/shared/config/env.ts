/**
 * Public environment variables, validated once at startup.
 * Each variable is referenced explicitly so Next.js can inline it into the client bundle.
 */
const APP_ENVS = ['development', 'staging', 'production', 'test'] as const;
type AppEnv = (typeof APP_ENVS)[number];

const optional = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined);

function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value.trim();
}

function parseUrl(name: string, value: string): string {
  try {
    return new URL(value).toString().replace(/\/+$/, '');
  } catch {
    throw new Error(`Environment variable ${name} must be an absolute URL, got "${value}".`);
  }
}

const rawEnv = process.env.NEXT_PUBLIC_ENV ?? 'development';
if (!(APP_ENVS as readonly string[]).includes(rawEnv)) {
  throw new Error(`NEXT_PUBLIC_ENV must be one of ${APP_ENVS.join(', ')}, got "${rawEnv}".`);
}
const appEnv = rawEnv as AppEnv;

export const env = {
  appEnv,
  isProduction: appEnv === 'production',
  apiUrl: parseUrl('NEXT_PUBLIC_API_URL', required('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL)),
  /** Partner (affiliate) API; defaults to the main API, as in the previous app. */
  partnerApiUrl: parseUrl(
    'NEXT_PUBLIC_PARTNER_API_URL',
    optional(process.env.NEXT_PUBLIC_PARTNER_API_URL) ??
      required('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL),
  ),
  parentDomain: optional(process.env.NEXT_PUBLIC_PARENT_DOMAIN) ?? 'localhost',
  googleClientId: optional(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
  sentryDsn: optional(process.env.NEXT_PUBLIC_SENTRY_DSN),
  posthog: {
    token: optional(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN),
    host: optional(process.env.NEXT_PUBLIC_POSTHOG_HOST),
  },
  gaId: optional(process.env.NEXT_PUBLIC_GA_ID),
  clarityId: optional(process.env.NEXT_PUBLIC_CLARITY_ID),
  /** Razorpay public key id for checkout; without it the checkout page explains payments are unavailable. */
  razorpayKeyId: optional(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID),
} as const;
