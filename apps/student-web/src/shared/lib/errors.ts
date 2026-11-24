/** Normalised error for every failed API call, whatever shape the backend used. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(options: { status: number; code: string; message: string; requestId?: string; details?: unknown }) {
    super(options.message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.details = options.details;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isRateLimited() {
    return this.status === 429;
  }

  /** A plan/feature usage limit (shows the upgrade dialog), not the OTP request limit. */
  get isPlanLimit() {
    return this.status === 429 && this.code !== 'TOO_MANY_REQUESTS';
  }

  /** The student's institute switched this feature off (403 FEATURE_RESTRICTED); not a plan limit. */
  get isFeatureRestricted() {
    return this.status === 403 && this.code === 'FEATURE_RESTRICTED';
  }

  /** Network failures and 5xx are worth retrying; 4xx are not. */
  get isRetryable() {
    return this.status === 0 || this.status >= 500;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

/** A 403 FEATURE_RESTRICTED: the institute switched the feature off (see features/feature-access). */
export const isFeatureRestricted = (error: unknown): error is ApiError => isApiError(error) && error.isFeatureRestricted;

/** A message that is safe to show to the user. */
/** Server errors whose message is written for students (others may describe internals, so they get the fallback). */
const USER_FACING_SERVER_ERRORS = new Set(['OTP_DELIVERY_FAILED', 'DATABASE_UNAVAILABLE']);

export function userMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isApiError(error)) {
    if (error.status === 0 && error.code === 'TIMEOUT') return 'This is taking longer than usual. Please try again.';
    if (error.status === 0) return 'You seem to be offline. Check your connection and try again.';
    if (error.status >= 500 && !USER_FACING_SERVER_ERRORS.has(error.code)) return fallback;
    return error.message || fallback;
  }
  return fallback;
}
