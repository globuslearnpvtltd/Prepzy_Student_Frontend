'use client';

import { cx } from '@prepzy/design-system';
import { ArrowUp, Keyboard, Loader2, Mic, PenLine, Plus, Square, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useVoiceAnswer } from '@/features/exam-engine';
import { InkPad, useInkDoc, useInkVersion } from '@/features/ink';
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
  /**
   * Pen button: write the question by hand (finger, stylus, mouse, trackpad). The writing is sent as the
   * message's image, exactly like a photo, so nothing changes on the backend. Off unless asked for.
   */
  allowInk?: boolean;
  /** Keep unfinished handwriting across a reload of this tab (e.g. the chat id). */
  inkDraftKey?: string;
  /** Name of the full-screen writing dialog. */
  inkTitle?: string;
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
  allowInk = false,
  inkDraftKey,
  inkTitle = 'Write your question',
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
  const [inkOpen, setInkOpen] = useState(false);
  const [inkFull, setInkFull] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  // Writing pad: the handwriting is one more way to attach the message's image.
  const ink = useInkDoc(allowInk ? inkDraftKey : undefined);
  const inkVersion = useInkVersion(ink);
  const hasInk = allowInk && !ink.isEmpty;

  // A small picture of the attached handwriting (the same cropped PNG that will be sent), while the pad is closed.
  const [inkPreview, setInkPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!hasInk || inkOpen) return setInkPreview(null);
    let live = true;
    let url: string | null = null;
    ink
      .toFile('preview.png')
      .then((file) => {
        if (!live || !file) return;
        url = URL.createObjectURL(file);
        setInkPreview(url);
      })
      .catch(() => undefined); // no canvas: the chip still says "Handwriting attached"
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [hasInk, inkOpen, inkVersion, ink]);

  // A message carries one image: once the student writes, the handwriting replaces a chosen photo.
  useEffect(() => {
    if (hasInk && image) setImage(null);
  }, [hasInk, image]);

  // While the pad is open, Escape steps back (full screen -> pad -> typing) instead of closing the chat panel.
  useEffect(() => {
    if (!inkOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (inkFull) setInkFull(false);
      else setInkOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [inkOpen, inkFull]);

  // Full-screen writing: the page behind it must not scroll.
  useEffect(() => {
    if (!inkFull) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [inkFull]);

  const closeInk = () => {
    setInkOpen(false);
    setInkFull(false);
  };

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

  const canSend = !disabled && !preparing && (!!text.trim() || (imageOnly && (!!image || hasInk)));
  const submit = async () => {
    if (!canSend) return;
    let attachment = image;
    if (hasInk) {
      setPreparing(true);
      try {
        attachment = await ink.toFile();
      } catch (cause) {
        return setError(userMessage(cause)); // the writing is kept: the student can try again
      } finally {
        setPreparing(false);
      }
    }
    onSend(text.trim(), attachment);
    setText('');
    setImage(null);
    setSymbols(false);
    setError(null);
    ink.reset();
    closeInk();
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
      <div
        role={inkFull ? 'dialog' : undefined}
        aria-modal={inkFull ? true : undefined}
        aria-label={inkFull ? inkTitle : undefined}
        className={cx(
          'bg-surface',
          inkFull
            ? 'fixed inset-0 z-[80] flex flex-col px-3.5 pt-[max(12px,env(safe-area-inset-top))] pb-[max(10px,env(safe-area-inset-bottom))]'
            : 'border-socrates-line relative rounded-[20px] border-[3px] px-3.5 pt-3 pb-2.5',
        )}
      >
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
        {hasInk && !inkOpen && (
          <div className="bg-socrates-soft text-socrates-text mb-2 flex w-fit max-w-full items-center gap-2 rounded-[12px] p-1 pl-1 text-[12px]">
            {inkPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview of the handwriting
              <img
                src={inkPreview}
                alt="Your handwriting"
                className="border-socrates-line bg-surface h-12 w-auto max-w-[140px] shrink-0 rounded-[8px] border object-contain p-0.5"
              />
            ) : (
              <PenLine aria-hidden className="text-brand ml-2 size-3.5 shrink-0" />
            )}
            <button type="button" onClick={() => setInkOpen(true)} className="font-medium underline-offset-2 hover:underline">
              Handwriting attached
            </button>
            <button
              type="button"
              aria-label="Remove handwriting"
              title="Remove (open the pad and undo to get it back)"
              onClick={() => ink.clear()}
              className="text-socrates-muted hover:bg-socrates-chip flex size-6 items-center justify-center rounded-full"
            >
              <X aria-hidden className="size-3" />
            </button>
          </div>
        )}
        {inkOpen && <InkPad doc={ink} expanded={inkFull} onExpandedChange={setInkFull} disabled={disabled || preparing} />}
        <textarea
          ref={area}
          rows={1}
          value={text}
          autoFocus={autoFocus}
          disabled={disabled}
          hidden={inkOpen}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
          className="text-socrates-text placeholder:text-socrates-faint w-full resize-none bg-transparent px-1 text-[14px] leading-5 outline-none"
        />
        <div className="mt-2 flex items-center gap-2">
          {allowImage && !inkOpen && (
            <>
              <button
                type="button"
                aria-label="Add a photo"
                title={hasInk ? 'Remove the handwriting to attach a photo instead' : 'Snap or upload a photo'}
                className={roundButton}
                onClick={() => fileInput.current?.click()}
                disabled={disabled || hasInk}
              >
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
          {allowInk && (
            <button
              type="button"
              aria-label={inkOpen ? 'Back to typing' : 'Write by hand'}
              aria-pressed={inkOpen}
              title={inkOpen ? 'Keyboard' : 'Write by hand'}
              className={roundButton}
              onClick={() => {
                setSymbols(false);
                if (inkOpen) {
                  closeInk();
                  requestAnimationFrame(() => area.current?.focus());
                } else {
                  area.current?.blur(); // put the on-screen keyboard away so the pad has the room
                  setInkOpen(true);
                }
              }}
              disabled={disabled}
            >
              {inkOpen ? <Keyboard aria-hidden className="size-4" /> : <PenLine aria-hidden className="size-4" />}
            </button>
          )}
          {!inkOpen && (
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
          )}
          {toolbarSlot}
          <span className="flex-1" />
          {onLiveChat && !inkFull && <LiveChatButton onClick={onLiveChat} active={liveActive} disabled={disabled || liveDisabled} />}
          {allowVoice && voice.supported && !inkFull && (
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
          {(canSend || preparing) && (
            <button
              type="button"
              aria-label="Send"
              onClick={() => void submit()}
              disabled={!canSend}
              className="from-brand-450 to-brand text-on-brand flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-b"
            >
              {preparing ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ArrowUp aria-hidden className="size-4" />}
            </button>
          )}
        </div>
        {symbols && !inkOpen && (
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
        {inkFull && error && (
          <p role="alert" className="text-socrates-error px-1 pt-1 text-[11.5px]">
            {error}
          </p>
        )}
      </div>
      {error && !inkFull && (
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
