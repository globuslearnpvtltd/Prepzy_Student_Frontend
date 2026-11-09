'use client';

import { cx } from '@prepzy/design-system';
import { ArrowUp, Loader2, Mic, Plus, Square, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useVoiceAnswer } from '@/features/exam-engine';
import { userMessage } from '@/shared/lib/errors';
import { MATH_SYMBOLS } from '@/shared/ui/math-symbols';


const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface ComposerProps {
  placeholder: string;
  onSend: (text: string, image: File | null) => void;
  disabled?: boolean;
  /** "+" button: attach one photo. */
  allowImage?: boolean;
  /** Mic button: speak the question (transcribed by the backend). */
  allowVoice?: boolean;
  /** Atlas "Live chat" pill (live voice). */
  onLiveChat?: () => void;
  /** A live talk is running (the pill turns green with a red dot). */
  liveActive?: boolean;
  /** Live chat can't start right now (e.g. an answer is on its way). */
  liveDisabled?: boolean;
  /** Extra buttons after "fx" (e.g. Vedica's "Talk live"). */
  toolbarSlot?: React.ReactNode;
  /** Send even with no text when a photo is attached. */
  imageOnly?: boolean;
  autoFocus?: boolean;
  /** Text to put in the box (e.g. a tapped suggestion); changes when the key changes. */
  prefill?: { key: number; text: string };
  className?: string;
}

/** The chat input card shared by Atlas and Socrates: text, "+" photo, "fx" symbols, mic. */
export function Composer({
  placeholder,
  onSend,
  disabled,
  allowImage = true,
  allowVoice = false,
  onLiveChat,
  liveActive = false,
  liveDisabled = false,
  toolbarSlot,
  imageOnly = true,
  autoFocus,
  prefill,
  className,
}: ComposerProps) {
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [symbols, setSymbols] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  useEffect(() => {
    if (prefill?.text) {
      setText(prefill.text);
      area.current?.focus();
    }
  }, [prefill?.key, prefill?.text]);

  // Grow with the text up to ~5 lines.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const voice = useVoiceAnswer(
    (spoken) => setText((current) => (current ? `${current} ${spoken}` : spoken)),
    (cause) => setError(userMessage(cause)),
  );

  const canSend = !disabled && (!!text.trim() || (imageOnly && !!image));
  const submit = () => {
    if (!canSend) return;
    onSend(text.trim(), image);
    setText('');
    setImage(null);
    setSymbols(false);
  };

  const insert = (symbol: string) => {
    const el = area.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + symbol + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + symbol.length, start + symbol.length);
    });
  };

  const pick = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.');
    if (file.size > MAX_IMAGE_BYTES) return setError('Images must be 10 MB or smaller.');
    setImage(file);
  };

  const roundButton =
    'bg-socrates-chip text-brand hover:bg-socrates-chip-hover flex size-8 shrink-0 items-center justify-center rounded-full disabled:opacity-50';

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <div className="border-socrates-line bg-surface relative rounded-[20px] border-[3px] px-3.5 pt-3 pb-2.5">
        {preview && (
          <div className="relative mb-2 w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Attached photo" className="size-16 rounded-md object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => setImage(null)}
              className="bg-socrates-ink text-on-brand absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full"
            >
              <X aria-hidden className="size-3" />
            </button>
          </div>
        )}
        <textarea
          ref={area}
          rows={1}
          value={text}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          className="text-socrates-text placeholder:text-socrates-faint w-full resize-none bg-transparent px-1 text-[14px] leading-5 outline-none"
        />
        <div className="mt-2 flex items-center gap-2">
          {allowImage && (
            <>
              <button type="button" aria-label="Add a photo" title="Snap or upload a photo" className={roundButton} onClick={() => fileInput.current?.click()} disabled={disabled}>
                <Plus aria-hidden className="size-4" />
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                data-testid="composer-file"
                onChange={(event) => {
                  pick(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </>
          )}
          <button
            type="button"
            aria-label="Math symbols"
            aria-expanded={symbols}
            title="Formulas"
            className={cx(roundButton, 'font-serif text-[14px] italic')}
            onClick={() => setSymbols((open) => !open)}
            disabled={disabled}
          >
            fx
          </button>
          {toolbarSlot}
          <span className="flex-1" />
          {onLiveChat && <LiveChatButton onClick={onLiveChat} active={liveActive} disabled={disabled || liveDisabled} />}
          {allowVoice && voice.supported && (
            <button
              type="button"
              aria-label={voice.state === 'recording' ? 'Stop recording' : 'Speak your question'}
              className={cx(roundButton, voice.state === 'recording' && 'bg-danger-50 text-danger-600')}
              disabled={disabled || voice.state === 'transcribing'}
              onClick={() => (voice.state === 'recording' ? voice.stop() : void voice.start())}
            >
              {voice.state === 'transcribing' ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : voice.state === 'recording' ? (
                <Square aria-hidden className="size-3.5" />
              ) : (
                <Mic aria-hidden className="size-4" />
              )}
            </button>
          )}
          {canSend && (
            <button
              type="button"
              aria-label="Send"
              onClick={submit}
              className="from-brand-450 to-brand text-on-brand flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-b"
            >
              <ArrowUp aria-hidden className="size-4" />
            </button>
          )}
        </div>
        {symbols && (
          <div role="group" aria-label="Math symbols" className="border-socrates-divider mt-2 flex flex-wrap gap-1.5 border-t pt-2">
            {MATH_SYMBOLS.map((symbol) => (
              <button
                key={symbol}
                type="button"
                onClick={() => insert(symbol)}
                className="bg-socrates-soft text-socrates-text hover:bg-socrates-chip min-w-8 rounded-sm px-2 py-1 text-[14px]"
              >
                {symbol}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="text-socrates-error px-1 text-[11.5px]">
          {error}
        </p>
      )}
    </div>
  );
}

/** Atlas "Live chat": a voice-bars button whose "Live chat" pill grows out of it every couple of seconds. */
function LiveChatButton({ onClick, active, disabled }: { onClick: () => void; active: boolean; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={active ? 'Open live talk' : 'Talk live with your tutor'}
      title={active ? 'Open live talk' : 'Talk live'}
      className="live-talk-btn relative flex size-8 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50"
    >
      {!disabled && <span aria-hidden className={cx('live-talk-ring absolute inset-0 rounded-full', active ? 'bg-voice-ok' : 'bg-brand')} />}
      {!disabled && (
        <span
          aria-hidden
          className={cx(
            'live-talk-pill shadow-voice-live absolute top-0 right-0 flex h-full items-center rounded-full bg-linear-to-r pr-[40px] pl-[12px] whitespace-nowrap',
            active ? 'from-voice-ok-light to-voice-ok' : 'from-brand-400 to-brand',
          )}
        >
          <span className="live-talk-pill-text text-on-brand text-[11px] leading-none font-semibold tracking-[0.2px]">Live chat</span>
        </span>
      )}
      <span aria-hidden className={cx('relative flex size-full items-center justify-center gap-[2px] rounded-full', active ? 'bg-voice-ok' : 'bg-brand')}>
        {[0, 0.2, 0.4, 0.1, 0.3].map((delay, i) => (
          <span
            key={i}
            className={cx('bg-surface w-[2.5px] rounded-full', !disabled && 'live-talk-bar')}
            style={{ height: i === 2 ? 14 : i % 2 ? 11 : 7, animationDelay: `${delay}s` }}
          />
        ))}
      </span>
      {active && <span aria-hidden className="border-surface bg-voice-danger absolute -top-px -right-px size-[9px] rounded-full border-2" />}
    </button>
  );
}
