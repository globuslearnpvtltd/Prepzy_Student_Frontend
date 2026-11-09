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

  /** Network failures and 5xx are worth retrying; 4xx are not. */
  get isRetryable() {
    return this.status === 0 || this.status >= 500;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

/** A message that is safe to show to the user. */
export function userMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isApiError(error)) {
    if (error.status === 0) return 'You seem to be offline. Check your connection and try again.';
    if (error.status >= 500) return fallback;
    return error.message || fallback;
  }
  return fallback;
}
