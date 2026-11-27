'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@prepzy/design-system';
import { TOP_DIALOG } from '@/shared/layout/limit-dialog';
import { Clock } from 'lucide-react';
import { useSessionExpiry } from '../hooks';

/**
 * "Session expired": opens when any request reports that the login session ended (401), on every page except
 * login / sign-up. It can't be dismissed; "Log in again" opens the login page (the portal's own on the portals).
 * Mounted once in the app providers.
 */
export function SessionExpiredDialog() {
  const { expired, logIn } = useSessionExpiry();
  return (
    <Dialog open={expired}>
      <DialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        // over any open chatbot, page blurred (shared with the plan-limit dialog)
        overlayClassName={TOP_DIALOG.overlayClassName}
        className={`${TOP_DIALOG.className} w-[345px] max-w-[calc(100%-32px)] gap-0 rounded-2xl border-[1.5px] px-6 pt-8 pb-6 text-center md:w-[420px]`}
      >
        <span className="bg-brand-50 text-brand mx-auto mb-5 flex size-14 items-center justify-center rounded-full">
          <Clock aria-hidden className="size-7" />
        </span>
        <DialogTitle className="mb-3 text-[20px] leading-7 font-semibold text-neutral-950">Session expired</DialogTitle>
        <DialogDescription className="mb-8 text-[14px] leading-relaxed text-neutral-600">
          Your login session has expired. Please log in again to continue.
        </DialogDescription>
        <button
          type="button"
          onClick={logIn}
          className="bg-brand hover:bg-brand-600 text-on-brand flex w-full items-center justify-center rounded-lg px-6 py-3 font-medium transition-colors duration-200"
        >
          Log in again
        </button>
      </DialogContent>
    </Dialog>
  );
}
