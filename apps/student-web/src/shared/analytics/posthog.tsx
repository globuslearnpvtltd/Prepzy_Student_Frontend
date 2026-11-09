'use client';

import { useEffect } from 'react';

/** Loads PostHog after the page is interactive so it never delays first paint. */
export function PostHogInit({ token, host }: { token: string; host?: string }) {
  useEffect(() => {
    let cancelled = false;
    void import('posthog-js').then(({ default: posthog }) => {
      if (!cancelled)
        posthog.init(token, { api_host: host, capture_pageview: 'history_change', person_profiles: 'identified_only' });
    });
    return () => {
      cancelled = true;
    };
  }, [token, host]);
  return null;
}
