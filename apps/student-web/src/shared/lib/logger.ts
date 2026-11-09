import { env } from '@/shared/config/env';
import { isApiError } from './errors';

type Context = Record<string, unknown>;

/** Sentry is downloaded only when something needs reporting, never as part of page load. */
const sentry = () => import('@sentry/nextjs');

let initialised = false;
async function client() {
  const Sentry = await sentry();
  if (!initialised && env.sentryDsn) {
    Sentry.init({ dsn: env.sentryDsn, environment: env.appEnv, tracesSampleRate: 0 });
    initialised = true;
  }
  return Sentry;
}

/**
 * App-wide logger. In development it writes to the console; in deployed environments errors go to
 * Sentry (when NEXT_PUBLIC_SENTRY_DSN is set) with the backend request id so browser and server logs link up.
 */
export const logger = {
  warn(message: string, context?: Context) {
    if (env.appEnv === 'development') console.warn(message, context ?? '');
    else if (env.sentryDsn) void client().then((S) => S.addBreadcrumb({ level: 'warning', message, data: context }));
  },
  error(message: string, error?: unknown, context?: Context) {
    if (env.appEnv === 'development') console.error(message, error, context ?? '');
    if (env.appEnv === 'development' || env.appEnv === 'test' || !env.sentryDsn) return;
    void client().then((Sentry) =>
      Sentry.withScope((scope) => {
        scope.setContext('details', { message, ...context });
        if (isApiError(error)) {
          scope.setTag('api.status', String(error.status));
          scope.setTag('api.code', error.code);
          if (error.requestId) scope.setTag('request_id', error.requestId);
        }
        Sentry.captureException(error ?? new Error(message));
      }),
    );
  },
};
