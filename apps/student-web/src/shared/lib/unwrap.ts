import { ApiError } from './errors';

type Envelope<T> = { success?: boolean; message?: string; error?: unknown; data?: T };

/**
 * Several legacy endpoints answer HTTP 200 with `{ success: false }` or `{ error: '…' }` on failure.
 * This turns those into a thrown ApiError (status 422) so callers only handle one error path.
 */
export function assertOk<T>(body: T): T {
  if (body && typeof body === 'object') {
    const envelope = body as Envelope<unknown>;
    const failed = envelope.success === false || (typeof envelope.error === 'string' && envelope.success !== true);
    if (failed) {
      const message =
        envelope.message ?? (typeof envelope.error === 'string' ? envelope.error : undefined) ?? 'Request failed';
      throw new ApiError({ status: 422, code: 'REJECTED', message });
    }
  }
  return body;
}

/** assertOk, then return `data` (throws if missing). */
export function unwrapData<T>(body: Envelope<T>): T {
  const checked = assertOk(body);
  if (checked.data === undefined || checked.data === null) {
    throw new ApiError({ status: 500, code: 'EMPTY_RESPONSE', message: 'The server returned no data.' });
  }
  return checked.data;
}
