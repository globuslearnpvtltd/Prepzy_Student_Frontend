'use client';

import { cx } from '@prepzy/design-system';
import { useLiveVoice } from '../provider';
import { formatClock, splitAvatarName, waveAmp } from '../text';
import { HangUpIcon } from './icons';
import { DEFAULT_TUTOR_IMAGE } from './live-talk-screen';
import { useVoiceLevels } from './use-voice-levels';

/**
 * Shown while a call runs with the talk screen minimised. "floating" sits over the page (chat closed);
 * "inline" sits at the top of the chat panel.
 */
export function LiveTalkMiniBar({ variant = 'floating' }: { variant?: 'floating' | 'inline' }) {
  const voice = useLiveVoice();
  const visible = !!voice && voice.isActive && !voice.screenOpen;
  const { t, mic, bot } = useVoiceLevels(visible);
  if (!voice || !visible) return null;

  const { name } = splitAvatarName(voice.avatar?.name);
  const studentOn = voice.phase === 'speaking' || voice.phase === 'interrupted';
  const level = studentOn ? mic : voice.phase === 'answering' ? bot : 0;
  const status =
    voice.phase === 'connecting'
      ? `Connecting to ${name}`
      : voice.phase === 'answering'
        ? `${name} is explaining`
        : voice.phase === 'thinking' || voice.phase === 'endturn'
          ? `${name} is thinking`
          : studentOn
            ? `${name} is listening`
            : `${name} is waiting for you`;

  return (
    <div
      className={cx(
        variant === 'floating' ? 'fixed right-3 bottom-[80px] left-3 z-[60] md:right-[40px] md:bottom-[40px] md:left-auto md:w-[380px]' : 'mx-4 mt-2',
        'bg-brand shadow-voice-bar flex h-[68px] shrink-0 items-center gap-1 rounded-lg pr-[10px] pl-[6px] font-sans',
      )}
    >
      <button
        type="button"
        onClick={voice.openScreen}
        aria-label={`Open live talk with ${name}`}
        className="text-on-brand flex h-14 min-w-0 flex-1 items-center gap-[10px] rounded-[12px] px-[6px] text-left"
      >
        <span className="relative size-11 flex-none">
          <span className="border-surface absolute top-0 left-0 size-11 rounded-full border-2 opacity-50" style={{ transform: `scale(${1 + 0.12 * Math.abs(Math.sin(t * 3))})` }} />
          {/* eslint-disable-next-line @next/next/no-img-element -- tutor photos come from the backend's CDN */}
          <img src={voice.avatar?.image || DEFAULT_TUTOR_IMAGE} alt="" className="absolute top-1 left-1 block size-9 rounded-full object-cover" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-semibold">{status}</span>
          <span className="text-voice-light text-[12px]">
            {voice.muted ? 'Muted · ' : ''}Live {formatClock(voice.elapsed)}, tap to open
          </span>
        </span>
        <span aria-hidden className="ml-auto flex h-[22px] items-center gap-[2px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="bg-surface block w-[3px] rounded-[2px]"
              style={{ height: 4 + 14 * waveAmp(i * 6 + 3, t + 1.7, 30) * Math.max(0.1, level), transition: 'height 110ms linear' }}
            />
          ))}
        </span>
      </button>
      <button type="button" aria-label="End live talk" onClick={voice.end} className="bg-voice-danger text-on-brand flex size-12 flex-none items-center justify-center rounded-[12px]">
        <HangUpIcon size={20} />
      </button>
    </div>
  );
}
