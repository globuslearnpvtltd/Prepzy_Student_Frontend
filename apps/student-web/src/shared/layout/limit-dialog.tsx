'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@prepzy/design-system';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { routes } from '@/shared/config/routes';
import { useOptionalExam } from '@/shared/hooks/use-exam';
import { onApiEvent } from '@/shared/lib/api-client';

/**
 * App-wide dialogs (plan limit, session expired) open over everything, chat panels and live talk included (those go up
 * to z-index 130; the shared Dialog's own 50 / 51 put this one behind an open chatbot), with the page behind blurred.
 */
export const TOP_DIALOG = {
  overlayClassName: 'z-[200] backdrop-blur-sm',
  className: 'z-[201]',
} as const;

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
      <DialogContent overlayClassName={TOP_DIALOG.overlayClassName} className={TOP_DIALOG.className}>
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
