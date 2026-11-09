'use client';

import { Button } from '@prepzy/design-system';
import { useEffect } from 'react';
import { StatusScreen } from '@/shared/layout/status-screens';
import { logger } from '@/shared/lib/logger';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error('Unhandled page error', error, { digest: error.digest });
  }, [error]);

  return (
    <StatusScreen
      title="Something went wrong"
      description="We couldn't load this page. Please try again."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
