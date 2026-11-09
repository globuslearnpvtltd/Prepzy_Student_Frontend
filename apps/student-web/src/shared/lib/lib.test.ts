import { ApiError, isApiError } from './errors';
import { createQueryClient } from './query-client';

const captureException = vi.fn();
const setTag = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureException: (...args: unknown[]) => captureException(...args),
  withScope: (fn: (scope: { setContext: () => void; setTag: typeof setTag }) => void) =>
    fn({ setContext: vi.fn(), setTag }),
}));

describe('query client defaults', () => {
  const retry = createQueryClient().getDefaultOptions().queries?.retry as (count: number, error: unknown) => boolean;

  it('retries network and server errors twice, never client errors', () => {
    const server = new ApiError({ status: 503, code: 'X', message: '' });
    const offline = new ApiError({ status: 0, code: 'NETWORK_ERROR', message: '' });
    const notFound = new ApiError({ status: 404, code: 'X', message: '' });
    expect(retry(0, server)).toBe(true);
    expect(retry(1, offline)).toBe(true);
    expect(retry(2, server)).toBe(false);
    expect(retry(0, notFound)).toBe(false);
    expect(retry(0, new Error('unknown'))).toBe(true);
  });

  it('does not refetch on window focus (exam answers must never be overwritten)', () => {
    expect(createQueryClient().getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });
});

describe('ApiError', () => {
  it('classifies statuses', () => {
    const error = new ApiError({ status: 401, code: 'X', message: 'm' });
    expect(isApiError(error)).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
    expect(error.isUnauthorized).toBe(true);
    expect(error.isRateLimited).toBe(false);
    expect(error.isRetryable).toBe(false);
  });
});

describe('logger', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('stays silent in tests and when Sentry is not configured', async () => {
    const { logger } = await import('./logger');
    logger.error('boom', new Error('x'));
    logger.warn('careful');
    await Promise.resolve();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports errors to Sentry in deployed environments with the request id', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://key@sentry.example/1');
    const { logger } = await import('./logger');
    const { ApiError: FreshApiError } = await import('./errors');
    logger.error(
      'Submit failed',
      new FreshApiError({ status: 500, code: 'HTTP_500', message: 'x', requestId: 'req-1' }),
    );
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledTimes(1));
    expect(setTag).toHaveBeenCalledWith('request_id', 'req-1');
  });
});
