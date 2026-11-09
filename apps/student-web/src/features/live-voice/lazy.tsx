'use client';

import dynamic from 'next/dynamic';
import type { LiveVoiceLayerProps } from './components/live-voice-layer';
import { useLiveVoice } from './provider';

// The talk screens (and MathJax for the answers) are only downloaded once a student asks for live talk.
const Layer = dynamic(() => import('./ui').then((m) => m.LiveVoiceLayer), { ssr: false });
const MiniBar = dynamic(() => import('./ui').then((m) => m.LiveTalkMiniBar), { ssr: false });
const Summary = dynamic(() => import('./ui').then((m) => m.LiveTalkSummary), { ssr: false });

/** Talk screen, mic sheet and floating mini bar for the nearest provider (nothing until live talk is used). */
export function LiveVoiceLayer(props: LiveVoiceLayerProps) {
  const voice = useLiveVoice();
  return voice?.engaged ? <Layer {...props} /> : null;
}

/** The running call's bar at the top of a chat panel, while the talk screen is minimised. */
export function LiveTalkMiniBar({ variant }: { variant?: 'floating' | 'inline' }) {
  const voice = useLiveVoice();
  return voice?.engaged && voice.isActive && !voice.screenOpen ? <MiniBar variant={variant} /> : null;
}

/** "Live talk ended" + transcript at the end of a chat thread. */
export function LiveTalkSummary(props: { onBack: () => void; backLabel?: string }) {
  const voice = useLiveVoice();
  return voice?.lastSession && !voice.isActive ? <Summary {...props} /> : null;
}
