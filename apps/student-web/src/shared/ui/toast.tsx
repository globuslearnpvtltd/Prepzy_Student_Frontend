'use client';

import { Info } from 'lucide-react';
import { toast as sonner } from 'sonner';

/**
 * The app's one toast (the profile page's dark design): icon, message and a Close button. Top of the page below the
 * header on desktop, bottom on phones. Every toast in the app goes through `notify` (lint forbids importing sonner
 * elsewhere), so they all look and behave the same.
 */

export type ToastKind = 'success' | 'error' | 'info';

export interface NotifyOptions {
  /** A longer wording for wide screens. */
  desktopMessage?: string;
  /** ms; default 4 s (errors 6 s). */
  duration?: number;
  /** A fixed id: showing the same toast again replaces it instead of stacking a second one. */
  id?: string | number;
}

const DESKTOP_QUERY = '(min-width: 1024px)';
const isDesktop = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_QUERY).matches;

function ToastIcon({ kind }: { kind: ToastKind }) {
  if (kind === 'info') return <Info aria-hidden className="text-account-toast-action size-[18px] shrink-0" />;
  return (
    <svg aria-hidden width={18} height={18} viewBox="0 0 18 18" fill="none" className="shrink-0">
      <g
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={kind === 'success' ? 'stroke-success-light' : 'stroke-danger-light'}
      >
        {kind === 'success' ? (
          <>
            <path d="M16.5 8.31V9C16.4991 10.6173 15.9754 12.191 15.007 13.4864C14.0386 14.7817 12.6775 15.7294 11.1265 16.1879C9.57557 16.6465 7.91794 16.5914 6.40085 16.0309C4.88376 15.4705 3.58849 14.4346 2.70822 13.0778C1.82795 11.721 1.40984 10.116 1.51625 8.50224C1.62267 6.88842 2.2479 5.35224 3.29871 4.1228C4.34951 2.89336 5.76958 2.03654 7.34714 1.68011C8.92469 1.32368 10.5752 1.48675 12.0525 2.145" />
            <path d="M6.75 8.25L9 10.5L16.5 3" />
          </>
        ) : (
          <>
            <path d="M16.5 9C16.5 13.1421 13.1421 16.5 9 16.5C4.85786 16.5 1.5 13.1421 1.5 9C1.5 4.85786 4.85786 1.5 9 1.5C13.1421 1.5 16.5 4.85786 16.5 9Z" />
            <path d="M11.25 6.75L6.75 11.25" />
            <path d="M6.75 6.75L11.25 11.25" />
          </>
        )}
      </g>
    </svg>
  );
}

export function AppToast({ kind, message, onClose }: { kind: ToastKind; message: string; onClose: () => void }) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      data-kind={kind}
      className="bg-account-ink shadow-account-toast flex w-[calc(100vw-40px)] max-w-[400px] items-center gap-[10px] rounded-[14px] py-[14px] pr-[18px] pl-[16px] leading-normal lg:mt-[72px] lg:w-[380px]"
    >
      <ToastIcon kind={kind} />
      <p className="text-on-brand min-w-0 flex-1 text-[13px] leading-[1.5] font-medium">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="text-account-toast-action shrink-0 text-[13px] leading-[1.5] font-semibold hover:underline"
      >
        Close
      </button>
    </div>
  );
}

function show(kind: ToastKind, message: string, { desktopMessage, duration, id }: NotifyOptions = {}): string | number {
  const desktop = isDesktop();
  const text = desktop && desktopMessage ? desktopMessage : message;
  return sonner.custom((id) => <AppToast kind={kind} message={text} onClose={() => sonner.dismiss(id)} />, {
    position: desktop ? 'top-center' : 'bottom-center',
    duration: duration ?? (kind === 'error' ? 6000 : 4000),
    unstyled: true,
    ...(id === undefined ? {} : { id }),
  });
}

export const notify = {
  success: (message: string, options?: NotifyOptions) => show('success', message, options),
  error: (message: string, options?: NotifyOptions) => show('error', message, options),
  info: (message: string, options?: NotifyOptions) => show('info', message, options),
  dismiss: (id?: string | number) => sonner.dismiss(id),
};
