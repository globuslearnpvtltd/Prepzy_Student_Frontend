'use client';

import { cx } from '@prepzy/design-system';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent } from 'react';
import { isApiError, userMessage } from '@/shared/lib/errors';
import { profileApi, type HelpRequest } from '../../api';
import {
  formatDay,
  Icon,
  outlineButton,
  primaryButton,
  Sheet,
  SheetIcon,
  sheetText,
  sheetTitle,
  showProfileToast,
  StateIcon,
} from '../kit';
import {
  CALL_HOURS,
  REPORT_TOPICS,
  requestNumber,
  statusOf,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  SUPPORT_PHONE_TEL,
  type Faq,
} from './help-data';

const overline = 'text-neutral-550 text-[11px] leading-[1.5] font-semibold uppercase';
const bodyText = 'text-account-body text-[13px] leading-[1.5] lg:text-[14px]';
const pairRow = 'flex w-full flex-col-reverse gap-[10px] pt-[6px] lg:flex-row lg:gap-[12px]';

function DetailRows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="bg-account-soft flex w-full flex-col gap-[10px] rounded-[14px] p-[16px]">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-[12px] text-[13px] leading-[1.5]">
          <span className="text-neutral-550 shrink-0">{row.label}</span>
          <span className="text-account-ink text-right font-semibold break-all">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

const copy = async (text: string, done: string) => {
  try {
    await navigator.clipboard.writeText(text);
    showProfileToast(done);
  } catch {
    showProfileToast('Couldn’t copy. Please copy it by hand.', { kind: 'error' });
  }
};

export function FaqModal({ faq, onTalk, onClose }: { faq: Faq; onTalk: () => void; onClose: () => void }) {
  // Not stored anywhere yet; only thanks the student.
  const [helpful, setHelpful] = useState<'yes' | 'no' | null>(null);
  return (
    <Sheet width={560} onClose={onClose} label={faq.question}>
      <p className={overline}>{faq.topic}</p>
      <h2 className={`${sheetTitle} leading-[1.5]`}>{faq.question}</h2>
      <div className="flex flex-col gap-[10px]">
        {faq.answer.map((p) => (
          <p key={p} className={bodyText}>
            {p}
          </p>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-[10px]">
        {helpful ? (
          <p className="text-account-body text-[13px] leading-[1.5] font-medium">
            {helpful === 'yes' ? 'Thanks for telling us.' : 'Sorry about that. Talk to us and we’ll help.'}
          </p>
        ) : (
          <>
            <p className="text-account-body text-[13px] leading-[1.5] font-medium">Was this answer helpful?</p>
            {(['yes', 'no'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setHelpful(v)}
                className="border-account-outline text-account-body hover:bg-account-soft rounded-full border px-[14px] py-[6px] text-[12px] leading-[1.5] font-semibold"
              >
                {v === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </>
        )}
      </div>
      <div className={pairRow}>
        <button type="button" onClick={onTalk} className={`${outlineButton} lg:flex-1`}>
          Talk to us
        </button>
        <button type="button" onClick={onClose} className={`${primaryButton} lg:flex-1`}>
          Done
        </button>
      </div>
    </Sheet>
  );
}

export function CallModal({ loginPhone, onClose }: { loginPhone: string; onClose: () => void }) {
  return (
    <Sheet width={460} onClose={onClose} label="Call Prepzy support">
      <SheetIcon name="help/phone.svg" tone="info" />
      <h2 className={`${sheetTitle} leading-[1.5]`}>Call Prepzy support</h2>
      <p className={sheetText}>
        {CALL_HOURS.replace(' · ', ', ')}.
        {loginPhone && (
          <>
            {' '}
            Keep your login number <span className="whitespace-nowrap">{loginPhone}</span> handy.
          </>
        )}
      </p>
      <DetailRows rows={[{ label: 'Phone', value: SUPPORT_PHONE }]} />
      <div className={pairRow}>
        <button type="button" onClick={onClose} className={`${outlineButton} lg:flex-1`}>
          <span className="lg:hidden">Cancel</span>
          <span className="hidden lg:inline">Close</span>
        </button>
        {/* Phones can dial straight away; desktop copies the number */}
        <a
          href={`tel:${SUPPORT_PHONE_TEL}`}
          className={`${primaryButton} flex items-center justify-center gap-[8px] no-underline lg:hidden`}
        >
          <Icon name="help/phone-white.svg" size={16} />
          Call now
        </a>
        <button
          type="button"
          onClick={() => copy(SUPPORT_PHONE, 'Number copied')}
          className={`${primaryButton} hidden lg:block lg:flex-1`}
        >
          Copy number
        </button>
      </div>
    </Sheet>
  );
}

export function EmailModal({ loginPhone, onClose }: { loginPhone: string; onClose: () => void }) {
  const subject = encodeURIComponent('Help with Prepzy');
  const body = encodeURIComponent(loginPhone ? `\n\nMy login number: ${loginPhone}` : '');
  return (
    <Sheet width={480} onClose={onClose} label="Email Prepzy support">
      <SheetIcon name="help/mail.svg" tone="info" />
      <h2 className={`${sheetTitle} leading-[1.5]`}>Email Prepzy support</h2>
      <p className={sheetText}>
        We reply within a day. Write from your login email, or add your phone number so we can find your account.
      </p>
      <DetailRows rows={[{ label: 'Email', value: SUPPORT_EMAIL }]} />
      <div className={pairRow}>
        <button
          type="button"
          onClick={() => copy(SUPPORT_EMAIL, 'Address copied')}
          className={`${outlineButton} lg:flex-1`}
        >
          Copy address
        </button>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}
          className={`${primaryButton} flex items-center justify-center gap-[8px] no-underline lg:flex-1`}
        >
          <Icon name="help/mail-white.svg" size={16} className="lg:hidden" />
          Open mail app
        </a>
      </div>
    </Sheet>
  );
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function ReportModal({
  loginPhone,
  offline,
  onSent,
  onClose,
}: {
  loginPhone: string;
  offline: boolean;
  onSent: (request: HelpRequest) => void;
  onClose: () => void;
}) {
  const [topic, setTopic] = useState('');
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const report = useMutation({ mutationFn: profileApi.reportProblem });
  const sending = report.isPending;
  const canSend = !!topic && !!text.trim() && !sending && !offline;

  const pickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return showProfileToast('Pick an image file', { kind: 'error' });
    if (file.size > MAX_IMAGE_BYTES) return showProfileToast('Pick a screenshot under 5 MB', { kind: 'error' });
    setImage(file);
  };

  const send = async () => {
    if (!canSend) return;
    try {
      onSent(await report.mutateAsync({ topic, description: text.trim(), image }));
    } catch (error) {
      showProfileToast(
        isApiError(error) && error.status > 0 && error.status < 500
          ? userMessage(error)
          : 'Couldn’t send. Please try again.',
        {
          kind: 'error',
        },
      );
    }
  };

  return (
    <Sheet width={520} onClose={() => !sending && onClose()} label="Report a problem">
      <SheetIcon name="help/flag.svg" tone="info" />
      <h2 className={`${sheetTitle} leading-[1.5]`}>Report a problem</h2>
      <p className={sheetText}>
        Tell us what went wrong. We reply within a day
        {loginPhone && (
          <>
            {' '}
            on WhatsApp <span className="whitespace-nowrap">{loginPhone}</span>
          </>
        )}
        .
      </p>

      <div className="flex flex-col gap-[8px]">
        <p className="text-account-body text-[12px] leading-[1.5] font-medium">What is it about?</p>
        {/* Phones: 2 + 2 + 1. Desktop: 3 + 2. */}
        <div className="grid grid-cols-2 gap-[8px] lg:grid-cols-6">
          {REPORT_TOPICS.map((t, i) => {
            const selected = topic === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={selected}
                onClick={() => setTopic(t)}
                // The 1.5px selected border takes half a pixel from the padding so the height stays put.
                className={cx(
                  i === REPORT_TOPICS.length - 1 ? 'col-span-2' : 'col-span-1',
                  i < 3 ? 'lg:col-span-2' : 'lg:col-span-3',
                  'rounded-[12px] text-[12px] leading-[1.5] transition-colors',
                  selected
                    ? 'bg-account-info-soft border-brand text-brand border-[1.5px] px-[7.5px] py-[9.5px] font-semibold'
                    : 'bg-surface border-account-outline text-account-body hover:bg-account-soft border px-[8px] py-[10px] font-medium',
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-[6px]">
        <label htmlFor="help-report-text" className="text-account-body text-[12px] leading-[1.5] font-medium">
          Tell us more
        </label>
        <textarea
          id="help-report-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder="What happened, and when?"
          className="border-account-outline focus:border-brand text-account-ink placeholder:text-account-placeholder h-[96px] resize-none rounded-[12px] border px-[14px] py-[12px] text-[14px] leading-[1.5] outline-none focus:border-[1.5px] focus:px-[13.5px] focus:py-[11.5px] lg:h-[110px]"
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        aria-label="Screenshot"
        className="hidden"
        onChange={pickImage}
      />
      {image ? (
        <div className="flex min-w-0 items-center gap-[8px]">
          <Icon name="help/clip.svg" size={16} />
          <span className="text-account-ink truncate text-[13px] font-medium">{image.name}</span>
          <button
            type="button"
            onClick={() => setImage(null)}
            className="text-danger shrink-0 text-[13px] font-semibold"
          >
            Remove
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} className="flex w-fit items-center gap-[8px]">
          <Icon name="help/clip.svg" size={16} />
          <span className="text-brand text-[13px] leading-[1.5] font-semibold">Add a screenshot (optional)</span>
        </button>
      )}

      <div className={pairRow}>
        <button type="button" onClick={onClose} disabled={sending} className={`${outlineButton} lg:flex-1`}>
          Cancel
        </button>
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          className={cx(
            'bg-brand text-on-brand flex w-full items-center justify-center gap-[8px] rounded-full py-[13px] text-[14px] font-semibold transition-colors lg:flex-1',
            !sending && 'hover:bg-account-hover disabled:bg-account-track disabled:text-account-disabled-text',
          )}
        >
          {sending && <StateIcon name="loader-button" size={16} className="animate-spin" />}
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </Sheet>
  );
}

export function ReportSentModal({ request, onClose }: { request: HelpRequest; onClose: () => void }) {
  return (
    <Sheet width={460} onClose={onClose} label="We got it">
      <SheetIcon name="help/sent.svg" tone="ok" />
      <h2 className={`${sheetTitle} leading-[1.5]`}>We got it</h2>
      <p className={sheetText}>We reply within a day on WhatsApp. You can follow it under Your requests.</p>
      <DetailRows
        rows={[
          ...(request.id ? [{ label: 'Request', value: requestNumber(request.id) }] : []),
          { label: 'About', value: request.topic },
          { label: 'Status', value: statusOf(request.status).label },
        ]}
      />
      <div className="w-full pt-[6px]">
        <button type="button" onClick={onClose} className={primaryButton}>
          Done
        </button>
      </div>
    </Sheet>
  );
}

/** No replies are stored yet: shows the CMS status and the student's message. */
export function RequestModal({ request, onClose }: { request: HelpRequest; onClose: () => void }) {
  return (
    <Sheet width={520} onClose={onClose} label={request.topic}>
      <SheetIcon name="help/ticket.svg" tone="info" />
      <p className={overline}>
        {requestNumber(request.id)} · Opened {formatDay(request.createdAt)}
      </p>
      <h2 className={`${sheetTitle} leading-[1.5]`}>{request.topic}</h2>
      <DetailRows
        rows={[
          { label: 'Status', value: statusOf(request.status).label },
          { label: 'Last update', value: formatDay(request.updatedAt ?? request.createdAt) },
        ]}
      />
      <p className={`${bodyText} break-words whitespace-pre-line`}>
        {formatDay(request.createdAt, false)} · You: {request.description}
      </p>
      <div className="w-full pt-[6px]">
        <button type="button" onClick={onClose} className={outlineButton}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
