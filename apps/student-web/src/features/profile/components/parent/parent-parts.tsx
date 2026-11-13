'use client';

import { cx } from '@prepzy/design-system';
import { Loader2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { ContactMethod, Parent } from '../../api';
import { CodeBoxes } from '../delete/delete-parts';
import { dangerButton, Icon, outlineButton, Sheet, SheetIcon, sheetText, sheetTitle, StateIcon } from '../kit';
import {
  contactError,
  formatContact,
  isContactValid,
  parentInputClass,
  parentName,
  sameDraft,
  type ParentDraft,
} from './parent-model';

export const RESEND_SECONDS = 60;

/** Pinned action button on phones (desktop shows the buttons in the card). */
export function StickyAction({
  label,
  busyLabel,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="bg-surface border-account-line fixed inset-x-0 bottom-0 z-[50] border-t px-[20px] pt-[12px] pb-[24px] leading-normal lg:hidden">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || busy}
        className={cx(
          'bg-brand text-on-brand flex w-full items-center justify-center gap-[8px] rounded-full py-[14px] text-[14px] font-semibold transition-colors',
          !busy && 'hover:bg-account-hover disabled:bg-account-track disabled:text-account-disabled-text',
        )}
      >
        {busy && <StateIcon name="loader-button" size={16} className="animate-spin" />}
        {busy ? busyLabel : label}
      </button>
    </div>
  );
}

const METHODS: { value: ContactMethod; label: string; name: string; activeName: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp', name: 'whatsapp-logo.svg', activeName: 'whatsapp-logo.svg' },
  { value: 'email', label: 'Email', name: 'email.svg', activeName: 'email-active.svg' },
];

function Label({ text, htmlFor }: { text: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-account-ink flex gap-[2px] text-[12px] font-semibold">
      {text}
      <span className="text-danger">*</span>
    </label>
  );
}

const hint = (mode: 'add' | 'edit', method: ContactMethod) => {
  if (mode === 'edit') {
    return method === 'whatsapp'
      ? 'If you change the number, we send a 6-digit code to the new one first.'
      : 'If you change the email, we send a 6-digit code to the new one first.';
  }
  return method === 'whatsapp'
    ? 'We send a 6-digit code on WhatsApp to this number. Email works the same way.'
    : 'We send a 6-digit code to this email.';
};

export function ParentForm({
  mode,
  draft,
  original,
  onChange,
  onCancel,
  onSubmit,
  sending,
}: {
  mode: 'add' | 'edit';
  draft: ParentDraft;
  /** Edit mode: the saved values, so Save stays off until something changes. */
  original?: ParentDraft;
  onChange: (draft: ParentDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
  sending: boolean;
}) {
  const [contactTouched, setContactTouched] = useState(false);
  const isWhatsapp = draft.contactMethod === 'whatsapp';
  const changed = mode === 'add' || !original || !sameDraft(draft, original);
  const canSubmit = !!draft.firstName.trim() && !!draft.lastName.trim() && isContactValid(draft) && changed && !sending;
  const error = contactTouched ? contactError(draft) : '';
  const submitLabel = mode === 'edit' ? 'Save changes' : 'Send OTP & continue';
  const set = (patch: Partial<ParentDraft>) => onChange({ ...draft, ...patch });

  const handleSubmit = (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (canSubmit) onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[16px]">
      {/* Phones show this intro under the page heading instead */}
      <div className="hidden flex-col gap-[2px] lg:flex">
        <p className="text-account-ink text-[16px] leading-normal font-semibold">
          {mode === 'edit' ? 'Edit details' : 'Add a parent'}
        </p>
        <p className="text-neutral-550 text-[12px] leading-normal">
          They get a view-only account to follow your progress.
        </p>
      </div>

      <div className="flex flex-col gap-[16px] lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
          <Label text="First name" htmlFor="parent_first_name" />
          <input
            id="parent_first_name"
            value={draft.firstName}
            onChange={(e) => set({ firstName: e.target.value })}
            placeholder="First name"
            className={parentInputClass}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
          <Label text="Last name" htmlFor="parent_last_name" />
          <input
            id="parent_last_name"
            value={draft.lastName}
            onChange={(e) => set({ lastName: e.target.value })}
            placeholder="Last name"
            className={parentInputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-[6px]">
        <Label text="Contact method" />
        <div className="bg-account-tile flex gap-[4px] rounded-[12px] p-[4px]">
          {METHODS.map((m) => {
            const active = draft.contactMethod === m.value;
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (active) return;
                  setContactTouched(false);
                  set({ contactMethod: m.value, contactValue: '' });
                }}
                className={cx(
                  'flex flex-1 items-center justify-center gap-[8px] rounded-[9px] py-[10px] text-[13px] transition-colors lg:py-[9px]',
                  active
                    ? 'bg-surface shadow-account-tab text-brand font-semibold'
                    : 'text-neutral-550 hover:text-brand font-medium',
                )}
              >
                <Icon name={active ? m.activeName : m.name} size={16} />
                {m.label}
              </button>
            );
          })}
        </div>

        {isWhatsapp ? (
          <div
            className={cx(
              'bg-surface flex items-center gap-[12px] rounded-[12px] px-[14px]',
              error
                ? 'border-account-error-line border-[1.5px]'
                : 'border-account-outline focus-within:border-brand border',
            )}
          >
            <span className="text-account-ink shrink-0 text-[14px] font-semibold lg:text-[13px]">🇮🇳 +91</span>
            <span className="bg-account-line h-[20px] w-px shrink-0" />
            <input
              type="tel"
              inputMode="numeric"
              aria-label="WhatsApp number"
              aria-invalid={!!error}
              value={draft.contactValue}
              onChange={(e) => set({ contactValue: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              onBlur={() => setContactTouched(true)}
              placeholder="WhatsApp number"
              className="text-account-ink placeholder:text-account-placeholder min-w-0 flex-1 bg-transparent py-[13px] text-[14px] outline-none lg:py-[11px] lg:text-[13px]"
            />
          </div>
        ) : (
          <input
            type="email"
            aria-label="Email"
            aria-invalid={!!error}
            value={draft.contactValue}
            onChange={(e) => set({ contactValue: e.target.value })}
            onBlur={() => setContactTouched(true)}
            placeholder="Email address"
            className={cx(parentInputClass, error && '!border-account-error-line !border-[1.5px]')}
          />
        )}
        {error && (
          <div className="flex items-start gap-[6px]">
            <StateIcon name="alert" size={14} className="mt-[2px]" />
            <p role="alert" className="text-account-error-text text-[12px] leading-[1.5] font-medium">
              {error}
            </p>
          </div>
        )}
        <p className="text-neutral-550 text-[11px] leading-normal">{hint(mode, draft.contactMethod)}</p>
      </div>

      {/* Desktop shows this in the page's side panel */}
      <div className="bg-account-soft flex flex-col gap-[6px] rounded-[12px] px-[14px] py-[12px] lg:hidden">
        <p className="text-account-ink text-[12px] leading-normal font-semibold">What they see</p>
        <p className="text-neutral-550 text-[12px] leading-normal">
          Study time, test scores and your plan. View only: they can&apos;t change your course, medium or plan.
        </p>
      </div>

      <div className="hidden gap-[12px] lg:flex">
        <button
          type="button"
          onClick={onCancel}
          className="border-account-outline text-brand hover:bg-account-soft flex-1 rounded-full border py-[12px] text-[13px] font-semibold transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-brand text-on-brand hover:bg-account-hover disabled:bg-account-track disabled:text-account-disabled-text flex flex-[2] items-center justify-center rounded-full py-[12px] text-[13px] font-semibold transition-colors"
        >
          {sending ? <Loader2 aria-label="Sending" className="animate-spin" size={18} /> : submitLabel}
        </button>
      </div>

      <StickyAction
        label={submitLabel}
        busyLabel={mode === 'edit' ? 'Saving…' : 'Sending…'}
        busy={sending}
        disabled={!canSubmit}
        onClick={() => handleSubmit()}
      />
    </form>
  );
}

export function ParentOtpStep({
  draft,
  error,
  locked,
  verifying,
  resending,
  resendKey,
  onEditDetails,
  onVerify,
  onResend,
  onCodeChange,
}: {
  draft: ParentDraft;
  error: string;
  /** Too many wrong codes: Verify stays off until a new code is sent. */
  locked: boolean;
  verifying: boolean;
  resending: boolean;
  /** Bumps whenever a new code is sent, restarting the timer. */
  resendKey: number;
  onEditDetails: () => void;
  onVerify: (code: string) => void;
  onResend: () => void;
  onCodeChange: () => void;
}) {
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  // A wrong code unlocks resend until the next code is sent.
  const [resendUnlocked, setResendUnlocked] = useState(false);

  useEffect(() => {
    setCode('');
    setSecondsLeft(RESEND_SECONDS);
    setResendUnlocked(false);
  }, [resendKey]);

  useEffect(() => {
    if (error) setResendUnlocked(true);
  }, [error]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const hasError = !!error;
  const canResend = resendUnlocked || secondsLeft <= 0;
  const canVerify = code.length === 6 && !verifying && !locked;
  const isEmail = draft.contactMethod === 'email';
  const firstName = draft.firstName.trim();
  const contact = formatContact(draft.contactMethod, isEmail ? draft.contactValue.trim() : draft.contactValue);

  return (
    <div className="flex flex-col gap-[16px]">
      <button type="button" onClick={onEditDetails} className="hidden w-fit items-center gap-[6px] lg:flex">
        <Icon name="back-small.svg" size={14} />
        <span className="text-brand text-[12px] font-semibold">Edit details</span>
      </button>

      <p className="text-account-ink text-[18px] leading-normal font-bold lg:text-[16px] lg:font-semibold">
        <span className="lg:hidden">
          Check {firstName}&apos;s {isEmail ? 'email' : 'WhatsApp'}
        </span>
        <span className="hidden lg:inline">
          Verify {firstName}&apos;s {isEmail ? 'email' : 'WhatsApp'}
        </span>
      </p>
      {/* 16px under the title on phones, 4px on desktop */}
      <p className="text-neutral-550 text-[12px] leading-normal lg:-mt-[12px]">
        {isEmail ? `We sent a 6-digit code to ${contact}.` : `We sent a 6-digit code on WhatsApp to ${contact}.`} Ask
        them to share it with you.
      </p>

      <button type="button" onClick={onEditDetails} className="text-brand w-fit text-[12px] font-semibold lg:hidden">
        {isEmail ? 'Wrong email? Edit details' : 'Wrong number? Edit details'}
      </button>

      <CodeBoxes
        variant="parent"
        resetKey={resendKey}
        hasError={hasError}
        onChange={(value) => {
          setCode(value);
          if (hasError && !locked) onCodeChange();
        }}
        onEnter={(value) => {
          if (value.length === 6 && !verifying && !locked) onVerify(value);
        }}
      />

      {hasError && (
        <div className="flex items-center gap-[6px]">
          <StateIcon name="error-sm" size={14} className="hidden lg:block" />
          <span role="alert" className="text-account-error-text text-[12px] font-medium">
            {error}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() => onVerify(code)}
        disabled={!canVerify}
        className="bg-brand text-on-brand hover:bg-account-hover disabled:bg-account-track disabled:text-account-disabled-text hidden w-full items-center justify-center rounded-full py-[12px] text-[13px] font-semibold transition-colors lg:flex"
      >
        {verifying ? <Loader2 aria-label="Verifying" className="animate-spin" size={18} /> : 'Verify & link'}
      </button>

      <div className="flex gap-[6px] text-[12px]">
        <span className="text-neutral-550">Didn&apos;t get it?</span>
        {canResend ? (
          <button
            type="button"
            onClick={onResend}
            disabled={resending}
            className="text-brand font-semibold disabled:opacity-60"
          >
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        ) : (
          <span className="text-brand font-semibold">Resend in {secondsLeft}s</span>
        )}
      </div>

      <StickyAction
        label="Verify & link"
        busyLabel="Verifying…"
        busy={verifying}
        disabled={!canVerify}
        onClick={() => onVerify(code)}
      />
    </div>
  );
}

/** A student has one parent / teacher at a time. */
export function ParentLinked({
  parent,
  justLinked,
  onEdit,
  onRemove,
}: {
  parent: Parent;
  justLinked: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const name = parentName(parent);
  const initials = `${parent.firstName[0] ?? ''}${parent.lastName[0] ?? ''}`.toUpperCase();
  const contact = formatContact(parent.contactMethod, parent.contactValue);
  const isWhatsapp = parent.contactMethod === 'whatsapp';

  return (
    <div className="flex flex-col gap-[16px]">
      {justLinked && (
        <div className="bg-success-soft border-account-ok-line rounded-[12px] border px-[14px] py-[10px]">
          <p className="text-account-ok-text text-[12px] leading-normal font-medium">
            ✓&nbsp; {name} is linked. They can log in with {contact}.
          </p>
        </div>
      )}

      <p className="text-neutral-550 hidden text-[11px] leading-normal font-semibold lg:block">LINKED</p>

      {/* Card on phones only; desktop already sits inside the page card */}
      <div className="bg-surface border-account-line rounded-[16px] border px-[16px] py-[8px] lg:rounded-none lg:border-0 lg:p-0">
        <div className="flex items-center gap-[12px] py-[12px] lg:py-[4px]">
          <div className="text-brand bg-brand-75 flex size-[40px] shrink-0 items-center justify-center rounded-full text-[13px] font-semibold">
            {initials}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
            <p className="text-account-ink truncate text-[14px] leading-normal font-semibold">{name}</p>
            <div className="flex min-w-0 items-center gap-[6px]">
              <Icon name={isWhatsapp ? 'whatsapp-logo-sm.svg' : 'email.svg'} size={14} />
              <p className="text-neutral-550 truncate text-[12px] leading-normal">
                {isWhatsapp ? 'WhatsApp' : 'Email'} · {contact}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="text-brand shrink-0 text-[12px] font-semibold hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-danger shrink-0 text-[12px] font-semibold hover:underline"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export function RemoveParentSheet({
  name,
  removing,
  onConfirm,
  onClose,
}: {
  name: string;
  removing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={() => !removing && onClose()} label={`Remove ${name}?`}>
      <SheetIcon name="user-minus.svg" tone="error" />
      <p className={`${sheetTitle} leading-[1.5]`}>Remove {name}?</p>
      <p className={sheetText}>
        They won’t see your study time, scores or plan any more. You can add them again later.
      </p>
      <div className="flex w-full flex-col gap-[10px] pt-[6px] lg:flex-row-reverse lg:gap-[12px]">
        <button type="button" onClick={onConfirm} disabled={removing} className={`${dangerButton} lg:flex-1`}>
          {removing && <StateIcon name="loader-button" size={16} className="animate-spin" />}
          {removing ? 'Removing…' : 'Remove'}
        </button>
        <button type="button" onClick={onClose} disabled={removing} className={`${outlineButton} lg:flex-1`}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}
