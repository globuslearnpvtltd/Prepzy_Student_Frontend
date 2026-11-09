'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@prepzy/design-system';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { routes } from '@/shared/config/routes';
import { useOptionalExam } from '@/shared/hooks/use-exam';
import { onApiEvent } from '@/shared/lib/api-client';

/** Shown whenever the backend reports a plan usage limit (HTTP 429). */
export function LimitDialog() {
  const exam = useOptionalExam();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(
    () =>
      onApiEvent('rateLimited', (error) => {
        setMessage(error.message || "You've reached your plan's limit.");
      }),
    [],
  );

  return (
    <Dialog open={message !== null} onOpenChange={(open) => !open && setMessage(null)}>
      <DialogContent>
        <DialogTitle>Limit reached</DialogTitle>
        <DialogDescription>{message}</DialogDescription>
        <DialogFooter>
          {exam && (
            <Button asChild intent="secondary">
              <Link href={routes.plansPurchase(exam.slug)} onClick={() => setMessage(null)}>
                See plans
              </Link>
            </Button>
          )}
          <Button onClick={() => setMessage(null)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
