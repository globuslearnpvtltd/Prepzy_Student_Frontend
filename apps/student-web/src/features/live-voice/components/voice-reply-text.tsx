'use client';

import { cx } from '@prepzy/design-system';
import { BookOpen } from 'lucide-react';
import { RichText } from '@/features/exam-engine/ui';
import { splitReply } from '../text';
import type { VoiceFigure } from '../types';

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plain text with \( \) maths, rendered safely (escaped, then typeset). */
export function MathText({ text, className }: { text: string; className?: string }) {
  return <RichText html={escapeHtml(text)} className={cx('whitespace-pre-wrap', className)} />;
}

export interface VoiceReplyTextProps {
  text: string;
  figure?: VoiceFigure | null;
  className?: string;
  compact?: boolean;
  /** The spoken part is rendered elsewhere (word highlighting): show only solutions + figure. */
  hideSpoken?: boolean;
}

/** Tutor reply: spoken text, then any <solution> as its own card, then the figure. */
export function VoiceReplyText({ text, figure, className, compact = false, hideSpoken = false }: VoiceReplyTextProps) {
  const { spoken, solutions, solutionOpen } = splitReply(text);
  if (hideSpoken && !solutions.length && !figure?.url) return null;
  return (
    <div className={cx('flex flex-col gap-4', className)}>
      {spoken && !hideSpoken && (
        <MathText text={spoken} className={cx('text-voice-ink', compact ? 'text-[13px] leading-[1.5]' : 'text-[16px] leading-[1.55]')} />
      )}
      {solutions.map((solution, i) => (
        <div key={i} className="border-voice-light bg-surface rounded-[12px] border px-[14px] py-[12px]">
          <div className="text-brand mb-[6px] flex items-center gap-[6px] text-[11px] font-semibold tracking-[0.4px] uppercase">
            <BookOpen aria-hidden className="size-3" strokeWidth={2.6} />
            Worked solution
            {solutionOpen && i === solutions.length - 1 && <span className="text-voice-faint font-medium normal-case">· writing…</span>}
          </div>
          <MathText text={solution} className="text-voice-ink text-[14px] leading-[1.6]" />
        </div>
      ))}
      {figure?.url && (
        <figure className="border-voice-light bg-surface m-0 overflow-hidden rounded-[12px] border">
          {/* eslint-disable-next-line @next/next/no-img-element -- figures come from the voice service */}
          <img src={figure.url} alt={figure.number ? `Figure ${figure.number}` : 'Figure from the lecture'} className="block max-h-[220px] w-full object-contain" />
          {figure.number ? <figcaption className="text-voice-muted px-[10px] py-[6px] text-[11px]">Figure {figure.number}</figcaption> : null}
        </figure>
      )}
    </div>
  );
}
