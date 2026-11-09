'use client';

import { LiveTalkMiniBar } from './live-talk-mini-bar';
import { LiveTalkScreen } from './live-talk-screen';
import { MicPermissionSheet } from './mic-permission-sheet';

export interface LiveVoiceLayerProps {
  /** The text chat is open (the mini bar then sits inside it instead of floating). */
  chatOpen: boolean;
  /** "Type": open / focus the text chat. */
  onOpenChat: () => void;
  expanded?: boolean;
  drawer?: boolean;
}

/** Page-level overlays for live talk; lives outside the chat panel so the call survives closing it. */
export function LiveVoiceLayer({ chatOpen, onOpenChat, expanded, drawer }: LiveVoiceLayerProps) {
  return (
    <>
      <LiveTalkScreen onType={onOpenChat} expanded={expanded} drawer={drawer} />
      <MicPermissionSheet />
      {!chatOpen && <LiveTalkMiniBar variant="floating" />}
    </>
  );
}
