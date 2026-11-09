'use client';

import { useEffect } from 'react';
import { logger } from '@/shared/lib/logger';

/** Last-resort boundary when the root layout itself fails. Must render its own <html>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error('Root layout error', error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
