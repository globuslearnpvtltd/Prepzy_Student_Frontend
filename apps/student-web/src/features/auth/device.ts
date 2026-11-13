let cached: Promise<string> | null = null;

/**
 * Device id sent with login/onboarding; the backend allows 2 devices per account.
 * Uses the same library as the previous app (FingerprintJS v4 visitorId) so existing sessions keep matching.
 * Loaded lazily so it never weighs on the initial bundle.
 */
export function getDeviceFingerprint(): Promise<string> {
  cached ??= import('@fingerprintjs/fingerprintjs')
    .then((FingerprintJS) => FingerprintJS.load())
    .then((agent) => agent.get())
    .then((result) => result.visitorId)
    .catch(() => 'unknown');
  return cached;
}

/** Name of the non-sensitive cookie that remembers the student's current exam for server-side redirects. */
export const EXAM_COOKIE = 'prepzy_exam';

export function rememberExam(slug: string) {
  document.cookie = `${EXAM_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax`;
}

/** The remembered exam's slug (null when none, or outside the browser). */
export function rememberedExam(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((part) => part.startsWith(`${EXAM_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(EXAM_COOKIE.length + 1)) || null : null;
}

export function forgetExam() {
  document.cookie = `${EXAM_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
