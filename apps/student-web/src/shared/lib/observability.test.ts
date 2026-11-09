import type * as ErrorsNs from './errors';
import type * as LoggerNs from './logger';
const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  setTag: vi.fn(),
}));
vi.mock('@sentry/nextjs', () => ({
  init: sentry.init,
  addBreadcrumb: sentry.addBreadcrumb,
  captureException: sentry.captureException,
  withScope: (fn: (scope: { setContext: () => void; setTag: typeof sentry.setTag }) => void) =>
    fn({ setContext: vi.fn(), setTag: sentry.setTag }),
}));

type LoggerModule = typeof LoggerNs;
type ErrorsModule = typeof ErrorsNs;

async function load(appEnv: string, dsn?: string) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_ENV', appEnv);
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', dsn ?? '');
  const { logger } = (await import('./logger')) as LoggerModule;
  const { ApiError } = (await import('./errors')) as ErrorsModule;
  return { logger, ApiError };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('logger', () => {
  it('writes to the console in development and never reports', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { logger } = await load('development', 'https://key@sentry.example/1');
    logger.warn('careful', { a: 1 });
    logger.warn('careful');
    logger.error('boom', new Error('x'), { b: 2 });
    logger.error('boom');
    expect(warn).toHaveBeenCalledWith('careful', { a: 1 });
    expect(warn).toHaveBeenCalledWith('careful', '');
    expect(error).toHaveBeenCalledWith('boom', expect.any(Error), { b: 2 });
    await Promise.resolve();
    expect(sentry.captureException).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });

  it('does nothing in production without a DSN', async () => {
    const { logger } = await load('production');
    logger.warn('careful');
    logger.error('boom', new Error('x'));
    await Promise.resolve();
    expect(sentry.addBreadcrumb).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('sends breadcrumbs and exceptions to Sentry, initialising it once', async () => {
    const { logger, ApiError } = await load('staging', 'https://key@sentry.example/1');
    logger.warn('slow request', { ms: 900 });
    await vi.waitFor(() =>
      expect(sentry.addBreadcrumb).toHaveBeenCalledWith({ level: 'warning', message: 'slow request', data: { ms: 900 } }),
    );
    logger.error('no error object');
    await vi.waitFor(() => expect(sentry.captureException).toHaveBeenCalledWith(new Error('no error object')));
    logger.error('client error', new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }));
    await vi.waitFor(() => expect(sentry.captureException).toHaveBeenCalledTimes(2));
    expect(sentry.setTag).toHaveBeenCalledWith('api.status', '404');
    expect(sentry.setTag).not.toHaveBeenCalledWith('request_id', expect.anything());
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({ environment: 'staging' }));
  });
});

describe('query client mutations', () => {
  it('logs only unexpected mutation failures', async () => {
    vi.resetModules();
    const { logger } = (await import('./logger')) as LoggerModule;
    const { ApiError } = (await import('./errors')) as ErrorsModule;
    const { createQueryClient } = await import('./query-client');
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const onError = createQueryClient().getDefaultOptions().mutations?.onError as (error: unknown) => void;
    onError(new ApiError({ status: 422, code: 'REJECTED', message: 'x' }));
    expect(spy).not.toHaveBeenCalled();
    onError(new ApiError({ status: 500, code: 'X', message: 'x' }));
    onError(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'x' }));
    onError(new TypeError('bug'));
    expect(spy).toHaveBeenCalledTimes(3);
  });
});

describe('env', () => {
  async function loadEnv(values: Record<string, string | undefined>) {
    vi.resetModules();
    for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
    return (await import('@/shared/config/env')).env;
  }

  it('normalises URLs and falls back to defaults', async () => {
    const env = await loadEnv({
      NEXT_PUBLIC_ENV: undefined,
      NEXT_PUBLIC_API_URL: ' https://api.example.com/// ',
      NEXT_PUBLIC_PARTNER_API_URL: 'https://partners.example.com/',
      NEXT_PUBLIC_PARENT_DOMAIN: '  ',
    });
    expect(env.appEnv).toBe('development');
    expect(env.isProduction).toBe(false);
    expect(env.apiUrl).toBe('https://api.example.com');
    expect(env.partnerApiUrl).toBe('https://partners.example.com');
    expect(env.parentDomain).toBe('localhost');
  });

  it('uses the main API for partners by default', async () => {
    const env = await loadEnv({ NEXT_PUBLIC_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://api.example.com' });
    expect(env.isProduction).toBe(true);
    expect(env.partnerApiUrl).toBe('https://api.example.com');
  });

  it('fails fast on a bad configuration', async () => {
    await expect(loadEnv({ NEXT_PUBLIC_ENV: 'qa' })).rejects.toThrow('NEXT_PUBLIC_ENV must be one of');
    await expect(loadEnv({ NEXT_PUBLIC_ENV: 'test', NEXT_PUBLIC_API_URL: '' })).rejects.toThrow(
      'Missing environment variable NEXT_PUBLIC_API_URL',
    );
    await expect(loadEnv({ NEXT_PUBLIC_ENV: 'test', NEXT_PUBLIC_API_URL: 'not a url' })).rejects.toThrow(
      'must be an absolute URL',
    );
  });
});
