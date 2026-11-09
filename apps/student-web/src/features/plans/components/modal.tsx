'use client';

import { cx } from '@prepzy/design-system';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

/** Locks page scroll and closes on Escape while mounted. */
export function useModalBehaviour(onClose: (() => void) | undefined) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
}

/** Centred sheet that stays scrollable on a phone (plan pages' modals). */
export function Modal({
  label,
  onClose,
  className,
  children,
}: {
  label: string;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}) {
  useModalBehaviour(onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/45 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cx('bg-surface max-h-[92vh] w-full overflow-y-auto rounded-[14px]', className)}
      >
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className={cx(
        'border-plan-panel-line text-neutral-350 hover:text-neutral-600 flex size-[26px] shrink-0 items-center justify-center rounded-full border',
        className,
      )}
    >
      <X aria-hidden className="size-3" strokeWidth={2.4} />
    </button>
  );
}

/** "Something went wrong" alert used for checkout and cancellation errors. */
export function WarningDialog({
  title = 'Something went wrong',
  message,
  onClose,
}: {
  title?: string;
  message: string;
  onClose: () => void;
}) {
  useModalBehaviour(onClose);
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-neutral-950/40 px-5 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="plan-warning-title"
        className="bg-surface shadow-lg flex w-full max-w-[420px] flex-col items-center rounded-xl px-8 pt-9 pb-7"
      >
        <span className="bg-danger-soft flex size-16 items-center justify-center rounded-full">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden className="text-plan-alert">
            <path d="M12 8V13M12 16.5V16.6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2" />
          </svg>
        </span>
        <h2 id="plan-warning-title" className="mt-5 text-center text-xl font-semibold text-neutral-900">
          {title}
        </h2>
        <p className="text-foreground-muted mt-2.5 max-h-[180px] overflow-y-auto text-center text-sm">{message}</p>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="bg-brand hover:bg-plan-violet text-on-brand mt-7 h-[50px] w-full rounded-[14px] text-[15px] font-semibold"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
