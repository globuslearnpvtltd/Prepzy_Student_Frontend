'use client';

import { cx } from '@prepzy/design-system';
import { Plus, RotateCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RichText } from '@/features/exam-engine/ui';
import type { HistoryItem } from '../api';

export const ATLAS_IMAGE = '/illustrations/assistant/atlas.png';
export const SOCRATES_IMAGE = '/illustrations/assistant/socrates.png';

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Model replies are HTML or plain text with LaTeX; plain text keeps its line breaks. */
export function toChatHtml(text: string): string {
  return /<\/?[a-z][\s\S]*>/i.test(text) ? text : escapeHtml(text).replace(/\n/g, '<br />');
}

/** A chat message body: sanitised HTML with maths (MathJax only loads when there is maths). */
export function ChatText({ text, className }: { text: string; className?: string }) {
  return <RichText html={toChatHtml(text)} className={cx('break-words [&_p]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5', className)} />;
}

/**
 * A picture in a chat bubble: the student's photo or handwriting, or a figure in a reply. Shown whole (never
 * cropped) on white paper with a thin border, at a readable size; tapping it opens the full-size viewer.
 * Handwriting is exported at twice its written size, so the cap keeps it about as large as it was written.
 */
export function ChatImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${alt}: open full size`}
        className={cx(
          'border-socrates-line bg-surface shadow-socrates-bubble block w-fit max-w-[min(100%,280px)] overflow-hidden rounded-md border p-1.5 cursor-zoom-in',
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local preview, data URL or backend CDN */}
        <img src={src} alt={alt} loading="lazy" className="block h-auto max-h-[220px] w-auto max-w-full rounded-sm object-contain" />
      </button>
      {open && <ImageViewer src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Full-size picture over everything; Escape, the close button or a tap outside closes it (and only it). */
export function ImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation(); // the chat panel behind closes on Escape too
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  // On <body>: chat panels are fixed layers of their own (a transform would trap a fixed child).
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[110] flex items-center justify-center p-4" onClick={onClose}>
      <div aria-hidden className="bg-night-900/80 absolute inset-0" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
        className="bg-surface relative max-h-[calc(100dvh-96px)] max-w-full rounded-md object-contain p-2 shadow-lg"
      />
      <button
        type="button"
        aria-label="Close picture"
        onClick={onClose}
        className="bg-surface text-socrates-ink absolute top-[max(12px,env(safe-area-inset-top))] right-3 flex size-10 items-center justify-center rounded-full shadow-lg"
      >
        <X aria-hidden className="size-5" />
      </button>
    </div>,
    document.body,
  );
}

export function Avatar({ src, size, alt = '', pending }: { src: string | null; size: number; alt?: string; pending?: boolean }) {
  if (pending) return <span aria-hidden className="bg-socrates-chip shrink-0 animate-pulse rounded-full" style={{ width: size, height: size }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- avatars can come from the backend's CDN
    <img
      src={src ?? ATLAS_IMAGE}
      alt={alt}
      width={size}
      height={size}
      className="bg-socrates-panel-from shrink-0 rounded-full object-cover object-top"
      style={{ width: size, height: size }}
    />
  );
}

export function TypingDots({ label = 'Thinking' }: { label?: string }) {
  return (
    <span role="status" aria-label={label} className="flex items-center gap-1 py-1">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="bg-brand-400 size-1.5 animate-bounce rounded-full" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}

export function relativeDay(iso: string | null, now = new Date()): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export interface HistoryListProps {
  title: string;
  newLabel: string;
  emptyText: string;
  errorText: string;
  items: HistoryItem[] | undefined;
  loading: boolean;
  error: boolean;
  activeId: number | null;
  onSelect: (chatId: number) => void;
  onNew: () => void;
  onRetry: () => void;
  onClose?: () => void;
}

/** Past conversations (last 7 days), shared by Atlas and Socrates. */
export function HistoryList({ title, newLabel, emptyText, errorText, items, loading, error, activeId, onSelect, onNew, onRetry, onClose }: HistoryListProps) {
  return (
    <div className="bg-surface flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <h2 className="text-socrates-ink font-serif text-[17px] font-semibold">{title}</h2>
        {onClose && (
          <button type="button" aria-label="Close history" onClick={onClose} className="text-socrates-muted hover:bg-socrates-soft flex size-8 items-center justify-center rounded-full">
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
      <div className="px-4">
        <button
          type="button"
          onClick={onNew}
          className="border-socrates-line text-brand hover:bg-socrates-soft flex w-full items-center justify-center gap-2 rounded-md border py-2 text-[13px] font-semibold"
        >
          <Plus aria-hidden className="size-4" />
          {newLabel}
        </button>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {loading ? (
          <ul aria-label="Loading" className="flex flex-col gap-2 px-2">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="bg-socrates-soft h-11 animate-pulse rounded-md" />
            ))}
          </ul>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <p className="text-socrates-muted text-[13px]">{errorText}</p>
            <button type="button" onClick={onRetry} className="text-brand flex items-center gap-1 text-[13px] font-semibold">
              <RotateCw aria-hidden className="size-3.5" /> Retry
            </button>
          </div>
        ) : !items?.length ? (
          <p className="text-socrates-muted px-4 py-8 text-center text-[13px]">{emptyText}</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => (
              <li key={item.chatId}>
                <button
                  type="button"
                  aria-current={item.chatId === activeId ? 'true' : undefined}
                  onClick={() => onSelect(item.chatId)}
                  className={cx(
                    'flex w-full flex-col items-start rounded-md px-3 py-2 text-left',
                    item.chatId === activeId ? 'bg-socrates-chip' : 'hover:bg-socrates-soft',
                  )}
                >
                  <span className="text-socrates-text line-clamp-1 text-[13px] font-medium">{item.title}</span>
                  <span className="text-socrates-faint text-[11px]">{relativeDay(item.lastMessageAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Left drawer with an overlay (history on mobile and in the solver). */
export function Drawer({ open, label, onClose, children, contained }: { open: boolean; label: string; onClose: () => void; children: React.ReactNode; contained?: boolean }) {
  if (!open) return null;
  return (
    <div className={cx(contained ? 'absolute' : 'fixed', 'inset-0 z-50 overflow-hidden')} onKeyDown={(event) => event.key === 'Escape' && onClose()}>
      <div aria-hidden onClick={onClose} className="bg-socrates-overlay/35 absolute inset-0" />
      <div role="dialog" aria-modal="true" aria-label={label} className="shadow-socrates-sheet absolute inset-y-0 left-0 w-[85%] max-w-[380px] overflow-hidden rounded-r-xl md:w-[380px]">
        {children}
      </div>
    </div>
  );
}
