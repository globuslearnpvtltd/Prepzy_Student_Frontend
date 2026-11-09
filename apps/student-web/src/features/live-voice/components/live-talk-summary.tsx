'use client';

import { useLiveVoice } from '../provider';
import { formatDuration, splitAvatarName } from '../text';
import { CheckIcon, WaveformIcon } from './icons';
import { VoiceReplyText } from './voice-reply-text';

/**
 * "Live talk ended": status row + transcript card at the end of the chat thread, until the chat reloads its
 * messages from the server (which then include these turns) or the student moves on.
 */
export function LiveTalkSummary({ onBack, backLabel = 'Back to lecture' }: { onBack: () => void; backLabel?: string }) {
  const voice = useLiveVoice();
  const session = voice?.lastSession;
  if (!voice || !session || voice.isActive) return null;
  const { name } = splitAvatarName(voice.avatar?.name);
  const turnCount = session.turns.length;

  return (
    <div className="flex flex-col gap-[10px] pt-[6px] font-sans">
      <div role="status" className="bg-voice-ok-soft flex items-center gap-2 rounded-[12px] py-1 pr-1 pl-4">
        <CheckIcon size={16} strokeWidth={2.6} className="text-voice-ok" />
        <span className="text-voice-ink flex-1 text-[13px] font-medium">
          Live talk ended, {formatDuration(session.durationSec)}
          {session.saved ? '' : ' · saving…'}
        </span>
        <button type="button" onClick={onBack} className="text-brand h-11 rounded-[12px] px-[10px] text-[12px] font-semibold">
          {backLabel}
        </button>
      </div>
      <article className="border-voice-light overflow-hidden rounded-lg border">
        <div className="bg-voice-soft flex items-center gap-2 px-[14px] py-[10px]">
          <WaveformIcon className="text-brand" />
          <span className="text-brand flex-1 text-[14px] font-semibold">Live talk with {name}</span>
          <span className="text-voice-muted text-[12px]">
            {turnCount} turn{turnCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex flex-col gap-4 p-[14px]">
          {session.turns.map((turn, i) => (
            <div key={i} className="flex flex-col gap-[2px]">
              <div className="text-voice-muted flex items-center gap-[6px] text-[11px] font-semibold">
                <span className={turn.role === 'user' ? 'bg-voice-amber size-[7px] rounded-full' : 'bg-brand size-[7px] rounded-full'} />
                {turn.role === 'user' ? 'You' : name}
                {turn.interrupted && <span className="text-voice-faint font-medium">· stopped</span>}
              </div>
              {turn.role === 'user' ? (
                <div className="text-voice-ink text-[13px] leading-[1.5]">{turn.text}</div>
              ) : (
                <VoiceReplyText compact text={turn.text} figure={turn.image ? { url: turn.image } : null} />
              )}
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
