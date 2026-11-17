/**
 * Sends a PostHog event. PostHog is only initialised in production (see `Analytics`), so this is a
 * no-op elsewhere; the library is imported lazily so callers don't add it to their page's bundle.
 */
export function track(event: string, properties: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  void import('posthog-js')
    .then(({ default: posthog }) => {
      if (posthog.__loaded) posthog.capture(event, properties);
    })
    .catch(() => undefined);
}
