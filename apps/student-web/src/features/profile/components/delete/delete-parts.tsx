'use client';

import { cx } from '@prepzy/design-system';
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { routes } from '@/shared/config/routes';
import { dangerButton, formatDay, Icon, outlineButton, primaryButton, StateIcon } from '../kit';
import { REASONS, SUPPORT_EMAIL, type DeleteAccountState, type DeleteResultInfo } from './use-delete-account';

const WHAT_GETS_DELETED = [
  'Your profile, progress and test history',
  'Notes, saved books and Atlas doubts',
  'Parent / Teacher links and their reports',
  'Refer & Earn credits',
];

export const deleteButtonClass = dangerButton;
export const outlineButtonClass = outlineButton;

/** First step, shared by the desktop dialog and the phone page. */
export function DeleteInfo({ flow, onKeep }: { flow: DeleteAccountState; onKeep: () => void }) {
  const n = flow.paidPlans;
  return (
    <>
      <div className="bg-danger-soft flex size-[52px] shrink-0 items-center justify-center rounded-full">
        <Icon name="delete/trash.svg" size={24} />
      </div>
      <h2 className="text-account-ink text-[20px] leading-normal font-bold">Delete your account?</h2>
      <p className="text-neutral-550 text-[13px] leading-normal">
        This deletes the Prepzy account on <span className="whitespace-nowrap">{flow.displayPhone}</span>, for every
        course.
      </p>
      {n > 0 && (
        <div className="bg-danger-soft border-account-danger-line rounded-[14px] border p-[14px] lg:px-[16px] lg:py-[12px]">
          <p className="text-danger text-[13px] leading-normal font-medium">
            {n === 1
              ? 'You have 1 active plan. It ends when the account is deleted and is not refunded.'
              : `You have ${n} active plans. They end when the account is deleted and are not refunded.`}
          </p>
        </div>
      )}
      <p className="text-neutral-550 text-[11px] leading-normal font-semibold">WHAT GETS DELETED</p>
      <ul className="m-0 flex list-none flex-col gap-[8px] p-0 lg:gap-[6px]">
        {WHAT_GETS_DELETED.map((item) => (
          <li key={item} className="text-account-ink flex items-start gap-[10px] text-[13px] leading-normal">
            <Icon name="delete/dot.svg" size={14} width={6} />
            {item}
          </li>
        ))}
      </ul>
      <div className="bg-account-soft rounded-[14px] p-[14px] lg:px-[16px] lg:py-[12px]">
        <p className="text-account-ink text-[12px] leading-normal">
          You get {flow.graceDays} days to change your mind. Email {SUPPORT_EMAIL} before {formatDay(flow.deleteOn)} and
          we keep everything. After that, it is gone for good.
        </p>
      </div>
      <div className="flex flex-col gap-[6px]">
        <label htmlFor="delete-reason" className="text-account-ink text-[12px] leading-normal font-semibold">
          Why are you leaving? (optional)
        </label>
        <div className="relative">
          <select
            id="delete-reason"
            value={flow.reason}
            onChange={(e) => flow.setReason(e.target.value)}
            className={cx(
              'bg-surface border-account-outline focus:border-brand w-full cursor-pointer appearance-none rounded-[12px] border py-[12px] pr-[44px] pl-[14px] text-[14px] outline-none lg:py-[10px]',
              flow.reason ? 'text-account-ink' : 'text-account-placeholder',
            )}
          >
            <option value="">Pick a reason</option>
            {REASONS.map((r) => (
              <option key={r} value={r} className="text-account-ink">
                {r}
              </option>
            ))}
          </select>
          <Icon
            name="delete/chevron-down.svg"
            size={18}
            className="pointer-events-none absolute top-1/2 right-[14px] -translate-y-1/2"
          />
        </div>
      </div>
      <div className="flex flex-col gap-[10px] pt-[6px] lg:flex-row lg:gap-[12px] lg:pt-[4px]">
        <button type="button" onClick={onKeep} disabled={flow.sending} className={`${outlineButton} lg:flex-1`}>
          Keep my account
        </button>
        <button
          type="button"
          onClick={flow.continueToCode}
          disabled={flow.sending}
          className={`${dangerButton} lg:flex-1`}
        >
          {flow.sending && <StateIcon name="loader-button" size={16} className="animate-spin" />}
          {flow.sending ? 'Sending code…' : 'Continue'}
        </button>
      </div>
    </>
  );
}

/** Six digit boxes: typing moves on, backspace moves back, pasting fills them all. */
export function CodeBoxes({
  resetKey,
  hasError,
  onChange,
  onEnter,
  variant = 'delete',
}: {
  resetKey: number;
  hasError: boolean;
  onChange: (code: string) => void;
  onEnter?: (code: string) => void;
  variant?: 'delete' | 'parent';
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setDigits(Array(6).fill(''));
    refs.current[0]?.focus();
  }, [resetKey]);

  const update = (next: string[]) => {
    setDigits(next);
    onChange(next.join(''));
  };

  const handleChange = (i: number, value: string) => {
    const d = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    update(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'Enter') onEnter?.(digits.join(''));
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    if (pasted.length === 0) return;
    update(Array.from({ length: 6 }, (_, i) => pasted[i] ?? ''));
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const tone = (filled: boolean) => {
    if (hasError) return 'bg-danger-soft border border-account-error-soft-line text-account-error-text';
    if (filled)
      return 'bg-surface border border-account-outline text-account-ink focus:border-[1.5px] focus:border-brand';
    return variant === 'parent'
      ? 'bg-account-soft lg:bg-surface border border-account-line lg:border-account-outline text-account-ink focus:border-[1.5px] focus:border-brand'
      : 'bg-account-soft border border-account-line text-account-ink focus:border-[1.5px] focus:border-brand';
  };

  const size =
    variant === 'parent'
      ? 'flex-1 min-w-0 max-w-[56px] h-[60px] lg:flex-none lg:w-[52px] lg:h-[56px] text-[20px]'
      : 'flex-1 min-w-0 h-[56px] lg:h-[58px] text-[20px] lg:text-[22px]';

  return (
    <div className={cx('flex gap-[8px] lg:gap-[10px]', variant === 'delete' && 'w-full')}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={`Digit ${i + 1}`}
          aria-invalid={hasError}
          className={cx('rounded-[12px] text-center font-semibold transition-colors outline-none', size, tone(!!d))}
        />
      ))}
    </div>
  );
}

export function CodeMeta({ flow }: { flow: DeleteAccountState }) {
  const m = Math.floor(flow.resendIn / 60);
  const s = String(flow.resendIn % 60).padStart(2, '0');
  return (
    <>
      {flow.codeError && (
        <div className="flex w-full items-start gap-[6px]">
          <StateIcon name="alert" size={14} className="mt-[2px]" />
          <p role="alert" className="text-account-error-text flex-1 text-[12px] leading-[1.5] font-medium">
            {flow.codeError}
          </p>
        </div>
      )}
      {flow.resendIn > 0 ? (
        <p className="text-neutral-550 text-[12px] leading-normal lg:text-[13px]">
          Resend code in {m}:{s}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => flow.resend()}
          disabled={flow.sending}
          className="text-brand w-fit text-[12px] font-semibold disabled:opacity-60 lg:text-[13px]"
        >
          {flow.sending ? 'Sending…' : 'Resend code'}
        </button>
      )}
    </>
  );
}

/** Shown once the request is saved; the session has already ended. */
export function DeleteResult({ info }: { info: DeleteResultInfo }) {
  const date = formatDay(info.deleteOn);
  return (
    <div className="flex w-full flex-col items-center px-[20px] pt-[48px] pb-[32px] leading-normal lg:pt-[88px] lg:pb-[40px]">
      <div className="lg:bg-surface lg:border-account-line flex w-full max-w-[560px] flex-col items-center gap-[14px] text-center lg:gap-[16px] lg:rounded-[20px] lg:border lg:p-[32px]">
        <div className="bg-brand-75 flex size-[52px] shrink-0 items-center justify-center rounded-full">
          <Icon name="delete/clock.svg" size={24} />
        </div>
        <h1 className="text-account-ink text-[20px] leading-normal font-bold lg:text-[22px]">
          Your account will be deleted on {date}
        </h1>
        <p className="text-neutral-550 text-[13px] leading-normal lg:text-[14px]">
          We have logged you out. Changed your mind? Email {SUPPORT_EMAIL} from your account with{' '}
          <span className="whitespace-nowrap">{info.phone}</span> before {date} and your account stays as it was.
        </p>
        <div className="bg-surface lg:bg-account-soft border-account-line flex w-full flex-col gap-[10px] rounded-[14px] border p-[14px] text-[13px] lg:gap-[12px] lg:border-0 lg:p-[16px] lg:text-[14px]">
          {[
            { label: 'Requested', value: formatDay(info.requestedOn) },
            { label: 'Deleted on', value: date },
            { label: 'Invoices', value: 'Kept, as tax law requires' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-[12px]">
              <span className="text-neutral-550">{row.label}</span>
              <span className="text-account-ink text-right font-medium">{row.value}</span>
            </div>
          ))}
        </div>
        <div className="w-full pt-[6px] lg:pt-[8px]">
          <button
            type="button"
            onClick={() => {
              window.location.href = routes.login();
            }}
            className={primaryButton}
          >
            Go to log in
          </button>
        </div>
      </div>
    </div>
  );
}
