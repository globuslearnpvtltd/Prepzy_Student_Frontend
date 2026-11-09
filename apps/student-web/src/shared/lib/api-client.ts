import { env } from '@/shared/config/env';
import { ApiError } from './errors';

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  params?: Query;
  signal?: AbortSignal;
  /** Milliseconds before the request is aborted (default 20 s). */
  timeout?: number;
}

type ErrorBody = {
  message?: string;
  error?: string | { code?: string; message?: string; requestId?: string; details?: unknown };
  code?: string;
  requestId?: string;
  details?: unknown;
};

type Listener = (error: ApiError) => void;
const listeners = { unauthorized: new Set<Listener>(), rateLimited: new Set<Listener>() };

/**
 * Lets features react to session expiry (401) or plan limits (429) without coupling to the client.
 * `rateLimited` is the plan/feature limit only: the OTP request limit (429 TOO_MANY_REQUESTS) is shown by the form.
 */
export function onApiEvent(event: keyof typeof listeners, listener: Listener): () => void {
  listeners[event].add(listener);
  return () => listeners[event].delete(listener);
}

const newRequestId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export function buildUrl(base: string, path: string, params?: Query): string {
  const url = new URL(path, `${base}/`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** Builds an ApiError from a failed response, reading the backend's various error shapes. */
export function toApiError(status: number, body: unknown, requestId?: string | null): ApiError {
  const data = (body && typeof body === 'object' ? body : {}) as ErrorBody;
  const nested = typeof data.error === 'object' ? data.error : undefined;
  const message =
    nested?.message ??
    data.message ??
    (typeof data.error === 'string' ? data.error : undefined) ??
    (typeof body === 'string' && body ? body : `Request failed (${status})`);
  return new ApiError({
    status,
    code: nested?.code ?? data.code ?? `HTTP_${status}`,
    message,
    requestId: nested?.requestId ?? data.requestId ?? requestId ?? undefined,
    details: nested?.details ?? data.details,
  });
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Fetch wrapper: cookies included, JSON in/out, timeouts, and one error type (ApiError). */
export function createApiClient(baseUrl: string) {
  async function request<T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    // Kept client-side for error reports only. Not sent as a header: the backend's CORS policy allows
    // just Content-Type and Authorization, and any other custom header makes the browser block the request.
    const requestId = newRequestId();
    const headers: Record<string, string> = { accept: 'application/json' };
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && !isForm) headers['content-type'] = 'application/json';

    const timeout = AbortSignal.timeout(options.timeout ?? 20_000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

    let response: Response;
    try {
      response = await fetch(buildUrl(baseUrl, path, options.params), {
        method,
        headers,
        credentials: 'include',
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
        signal,
      });
    } catch (cause) {
      const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError';
      throw new ApiError({
        status: 0,
        code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: timedOut ? 'The request took too long.' : 'Network error',
        requestId,
      });
    }

    const data = await readBody(response);
    if (!response.ok) {
      const error = toApiError(response.status, data, response.headers.get('x-request-id') ?? requestId);
      if (error.isUnauthorized) listeners.unauthorized.forEach((listener) => listener(error));
      if (error.isPlanLimit) listeners.rateLimited.forEach((listener) => listener(error));
      throw error;
    }
    return data as T;
  }

  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body, options),
    put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, body, options),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, body, options),
    delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, undefined, options),
    /**
     * POST that answers with a stream (server-sent events). Same headers, cookies and error handling as the
     * other methods, but no timeout (replies can take a while); cancel with `options.signal`.
     */
    stream: async (path: string, body: unknown, options: Pick<RequestOptions, 'signal'> = {}) => {
      const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
      const headers: Record<string, string> = { accept: 'text/event-stream' };
      if (!isForm) headers['content-type'] = 'application/json';
      let response: Response;
      try {
        response = await fetch(buildUrl(baseUrl, path), {
          method: 'POST',
          headers,
          credentials: 'include',
          body: isForm ? (body as FormData) : JSON.stringify(body),
          signal: options.signal,
        });
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
        throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Network error' });
      }
      if (!response.ok || !response.body) {
        const error = toApiError(response.status, await readBody(response), response.headers.get('x-request-id'));
        if (error.isUnauthorized) listeners.unauthorized.forEach((listener) => listener(error));
        if (error.isPlanLimit) listeners.rateLimited.forEach((listener) => listener(error));
        throw error;
      }
      return response.body;
    },
    /**
     * Fire-and-forget request that survives the page closing (browsers cap the body at 64 KB).
     * Used to save exam progress on tab close; regular autosave covers anything larger.
     */
    keepalive: (method: 'PUT' | 'POST', path: string, body: unknown): void => {
      void fetch(buildUrl(baseUrl, path), {
        method,
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        keepalive: true,
      }).catch(() => undefined);
    },
  };
}

export const apiClient = createApiClient(env.apiUrl);
