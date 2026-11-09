import { QueryClient } from '@tanstack/react-query';
import { isApiError } from './errors';
import { logger } from './logger';

/** Shared defaults: cache for a minute, retry only transient failures, never retry 4xx. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => (isApiError(error) ? error.isRetryable && failureCount < 2 : failureCount < 2),
      },
      mutations: {
        retry: false,
        onError: (error) => {
          if (!isApiError(error) || error.status >= 500 || error.status === 0) logger.error('Mutation failed', error);
        },
      },
    },
  });
}
