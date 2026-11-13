'use client';

import { cx } from '@prepzy/design-system';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { StateIcon } from '../kit';

/** "Log out of Prepzy?": bottom sheet on phones, dialog on desktop. Rendered into body (the header has its own z-index). */
export function LogoutConfirm({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  if (!mounted) return null;
  return createPortal(
    <div
      className="bg-account-ink/42 lg:bg-account-scrim/40 fixed inset-0 z-[1200] flex items-end justify-center leading-normal lg:items-center lg:px-[16px]"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface lg:shadow-account-modal flex w-full flex-col gap-[14px] rounded-t-[24px] px-[20px] pt-[12px] pb-[28px] lg:max-w-[440px] lg:rounded-[24px] lg:p-[28px]"
      >
        <div className="flex justify-center lg:hidden" aria-hidden="true">
          <span className="bg-account-outline h-[4px] w-[40px] rounded-[4px]" />
        </div>
        <p id="logout-title" className="text-account-ink text-[18px] leading-normal font-bold lg:text-[20px]">
          Log out of Prepzy?
        </p>
        <p className="text-neutral-550 text-[13px] leading-normal">
          <span className="lg:hidden">
            Your progress is saved to your account. Downloaded books stay on this phone until you log in again.
          </span>
          <span className="hidden lg:inline">
            Your progress is saved to your account. Books you saved for offline stay on this device until you log in
            again.
          </span>
        </p>
        <div className="flex gap-[12px] lg:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="border-account-outline bg-surface text-brand hover:bg-account-soft flex-1 rounded-full border py-[14px] text-[14px] font-semibold transition-colors disabled:opacity-60 lg:flex-none lg:px-[20px] lg:py-[11px] lg:text-[13px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cx(
              'bg-danger hover:bg-account-error-text text-on-brand flex flex-1 items-center justify-center gap-[8px] rounded-full py-[14px] text-[14px] font-semibold transition-colors disabled:opacity-80',
              'lg:flex-none lg:px-[20px] lg:py-[11px] lg:text-[13px]',
            )}
          >
            {busy && <StateIcon name="loader-button" size={16} className="animate-spin" />}
            {busy ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
