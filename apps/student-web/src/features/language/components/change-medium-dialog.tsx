'use client';

import { cx } from '@prepzy/design-system';
import { Circle, CircleCheck } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { userMessage } from '@/shared/lib/errors';
import { useChangeLanguage, useCurrentLanguage, useMediumDialog, useMediumOptions } from '../hooks';
import { mediumLabel } from '../names';

const button = 'rounded-full px-[20px] py-[11px] text-[13px] font-semibold transition-colors';

function OptionsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-[10px]">
      {[0, 1].map((row) => (
        <div key={row} className="bg-account-bone h-[62px] animate-pulse rounded-[14px]" />
      ))}
    </div>
  );
}

/**
 * "Change course medium": the mediums the current exam offers (every medium outside an exam), the current one marked.
 * Switching saves it, refetches every content list (see useChangeLanguage) and closes with a toast; an error stays in
 * the dialog. An exam with a single medium shows it alone, says so, and has nothing to switch to.
 * A centred dialog from md up, a bottom sheet on phones. Rendered into body (the header has its own z-index).
 */
export function ChangeMediumDialog({ onClose }: { onClose: () => void }) {
  const options = useMediumOptions();
  const current = useCurrentLanguage();
  const change = useChangeLanguage();
  const [picked, setPicked] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const busy = change.isPending;

  useEffect(() => setMounted(true), []);

  // Focus moves into the dialog, and back to where it was when it closes.
  useEffect(() => {
    if (!mounted) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => previous?.focus?.();
  }, [mounted]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const selectedId = picked ?? current?.id ?? null;
  const selected = options.languages?.find((language) => language.id === selectedId) ?? null;
  const only = options.exam && options.languages?.length === 1 ? options.languages[0]! : null;
  const canSwitch = selected !== null && selected.id !== current?.id && !busy;
  const target = selected ? mediumLabel(selected.name).native : '';

  const submit = () => {
    if (!selected || !canSwitch) return;
    change.mutate(selected.id, {
      onSuccess: (language) => {
        toast.success(`Switched to ${mediumLabel(language.name).native}`);
        onClose();
      },
    });
  };

  if (!mounted) return null;
  return createPortal(
    <div
      className="bg-account-ink/42 md:bg-account-scrim/40 fixed inset-0 z-[1100] flex items-end justify-center leading-normal md:items-center md:px-[16px]"
      onClick={() => !busy && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="bg-surface md:shadow-account-modal flex max-h-[calc(100dvh-24px)] w-full flex-col gap-[14px] overflow-y-auto rounded-t-[24px] px-[20px] pt-[12px] pb-[28px] outline-none md:max-w-[440px] md:rounded-[24px] md:p-[24px]"
      >
        <div className="flex justify-center md:hidden" aria-hidden="true">
          <span className="bg-account-handle h-[4px] w-[40px] rounded-[2px]" />
        </div>
        <div className="flex flex-col gap-[6px]">
          <h2 id={titleId} className="text-account-ink text-[18px] font-bold md:text-[20px]">
            Change course medium
          </h2>
          <p className="text-neutral-550 text-[12px] leading-[1.5] md:text-[13px]">
            Books, videos and notes will show in the medium you pick.
          </p>
        </div>

        {options.isPending ? (
          <OptionsSkeleton />
        ) : options.isError || !options.languages ? (
          <div className="bg-account-soft flex items-center gap-[12px] rounded-[12px] px-[14px] py-[12px]">
            <p className="text-account-ink min-w-0 flex-1 text-[13px]">We couldn’t load the mediums.</p>
            <button
              type="button"
              onClick={() => options.refetch()}
              className="text-brand shrink-0 text-[13px] font-semibold hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <div role="radiogroup" aria-label="Course medium" className="flex flex-col gap-[10px]">
            {options.languages.map((language) => {
              const label = mediumLabel(language.name);
              const isCurrent = language.id === current?.id;
              const isSelected = language.id === selectedId;
              const sub = [label.english !== label.native ? label.english : null, isCurrent ? 'Current medium' : null]
                .filter(Boolean)
                .join(' · ');
              return (
                <button
                  key={language.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={isCurrent ? `${label.native} (current medium)` : label.native}
                  disabled={busy}
                  onClick={() => {
                    change.reset();
                    setPicked(language.id);
                  }}
                  className={cx(
                    'flex w-full items-center gap-[12px] rounded-[14px] border px-[12px] py-[10px] text-left transition-colors disabled:cursor-not-allowed',
                    isSelected ? 'border-brand-150 bg-brand-75' : 'border-account-line bg-surface hover:bg-account-soft',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'flex size-[36px] shrink-0 items-center justify-center rounded-[10px] text-[15px] font-bold',
                      isSelected ? 'bg-brand text-on-brand' : 'bg-brand-75 text-brand',
                    )}
                  >
                    {label.letter}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-account-ink text-[14px] font-semibold">{label.native}</span>
                    {sub && <span className="text-neutral-550 text-[11px]">{sub}</span>}
                  </span>
                  {isSelected ? (
                    <CircleCheck aria-hidden className="text-brand size-[18px] shrink-0" />
                  ) : (
                    <Circle aria-hidden className="text-neutral-550 size-[18px] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <p className="text-neutral-550 text-[12px]">
          {only && options.exam
            ? `Only ${mediumLabel(only.name).native} is available for ${options.exam.label}.`
            : 'More mediums are on the way.'}
        </p>
        <p className="bg-account-soft text-neutral-550 rounded-[12px] px-[14px] py-[12px] text-[12px] leading-[1.5]">
          Your plan, progress and doubts stay the same.
        </p>

        {change.isError && (
          <p role="alert" className="text-account-error-text text-[13px] font-medium">
            {userMessage(change.error, 'We couldn’t change your medium. Please try again.')}
          </p>
        )}

        <div className="flex gap-[12px] md:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={cx(button, 'border-account-outline bg-surface text-account-ink hover:bg-account-soft flex-1 border disabled:opacity-60 md:flex-none')}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSwitch}
            className={cx(
              button,
              'bg-brand hover:bg-account-hover text-on-brand flex-1 disabled:cursor-not-allowed disabled:opacity-50 md:flex-none',
            )}
          >
            {busy ? 'Switching…' : selected && selected.id !== current?.id ? `Switch to ${target}` : 'Switch'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Renders the dialog while useMediumDialog is open (the header mounts this once on every page). */
export function MediumDialogHost() {
  const open = useMediumDialog((state) => state.open);
  const hide = useMediumDialog((state) => state.hide);
  return open ? <ChangeMediumDialog onClose={hide} /> : null;
}
