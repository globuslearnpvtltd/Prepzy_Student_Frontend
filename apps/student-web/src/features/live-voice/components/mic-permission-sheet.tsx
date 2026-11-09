'use client';

import { useLiveVoice } from '../provider';
import { splitAvatarName } from '../text';
import { HeadphonesIcon, MicStandIcon } from './icons';

/** Explains the mic prompt before the browser shows it (bottom sheet on mobile, card on desktop). */
export function MicPermissionSheet() {
  const voice = useLiveVoice();
  if (!voice?.permissionOpen) return null;
  const { name } = splitAvatarName(voice.avatar?.name);
  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center font-sans md:items-center">
      <div aria-hidden className="bg-voice-ink/45 absolute inset-0" onClick={voice.cancelPermission} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Microphone access"
        className="bg-surface text-voice-ink relative flex w-full flex-col items-center gap-[14px] rounded-t-2xl px-12 pt-4 pb-6 md:max-w-[420px] md:rounded-2xl md:pt-6"
      >
        <span aria-hidden className="bg-voice-light h-1 w-10 rounded-[2px] md:hidden" />
        <span className="bg-voice-amber-soft mt-[6px] flex size-[72px] items-center justify-center rounded-full">
          <MicStandIcon size={30} strokeWidth={2} />
        </span>
        <div className="text-center text-[20px] font-semibold">Let {name} hear you</div>
        <p className="text-voice-muted m-0 text-center text-[14px] leading-[1.55]">
          Your browser will ask for microphone access next. Prepzy only listens while live talk is on.
        </p>
        <div className="bg-voice-soft flex items-center gap-4 self-stretch rounded-[12px] px-[14px] py-4">
          <HeadphonesIcon className="text-brand flex-none" />
          <span className="text-[13px] leading-[1.45]">Earphones work best. {name} won&apos;t hear their own voice, and noisy rooms matter less.</span>
        </div>
        <button type="button" onClick={voice.confirmPermission} className="bg-brand text-on-brand h-[52px] self-stretch rounded-[12px] text-[15px] font-semibold">
          Allow microphone
        </button>
        <button type="button" onClick={voice.cancelPermission} className="text-brand h-12 self-stretch rounded-[12px] text-[14px] font-semibold">
          Not now
        </button>
      </div>
    </div>
  );
}
