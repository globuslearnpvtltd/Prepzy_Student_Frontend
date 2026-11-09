import type {
  VoiceAvatar,
  VoiceErrorInfo,
  VoiceLanguage,
  VoicePhase,
  VoiceReply,
  VoiceSessionSummary,
  VoiceTurn,
  WordTiming,
} from './types';

/** The tutor's language is remembered per browser. */
export const LANGUAGE_STORAGE_KEY = 'prepzy-live-voice-language';

export interface VoiceState {
  phase: VoicePhase;
  /** The full-screen talk view is showing (a call can run minimised). */
  screenOpen: boolean;
  /** The "Let … hear you" sheet before the browser's mic prompt. */
  permissionOpen: boolean;
  error: VoiceErrorInfo | null;
  muted: boolean;
  /** Tutor's voice held for the current answer (text keeps streaming). */
  tutorPaused: boolean;
  /** Seconds since the call connected. */
  elapsed: number;
  avatar: VoiceAvatar | null;
  language: VoiceLanguage;
  interimText: string;
  lastUserText: string;
  reply: VoiceReply | null;
  lastReply: VoiceReply | null;
  turns: VoiceTurn[];
  /** The last call, for the "Live talk ended" card. */
  lastSession: VoiceSessionSummary | null;
  savedChatId: number | null;
  /** Live talk was asked for at least once: the screens are loaded from then on. */
  engaged: boolean;
}

export const initialVoiceState: VoiceState = {
  phase: 'idle',
  screenOpen: false,
  permissionOpen: false,
  error: null,
  muted: false,
  tutorPaused: false,
  elapsed: 0,
  avatar: null,
  language: 'english',
  interimText: '',
  lastUserText: '',
  reply: null,
  lastReply: null,
  turns: [],
  lastSession: null,
  savedChatId: null,
  engaged: false,
};

/** Live mic / tutor levels (0..1), written every animation frame; read by the animations without re-rendering. */
export interface VoiceMeters {
  levels: { mic: number; bot: number };
  wordTiming: WordTiming;
}

export interface VoiceStore {
  get: () => VoiceState;
  set: (patch: Partial<VoiceState> | ((state: VoiceState) => Partial<VoiceState>)) => void;
  subscribe: (listener: () => void) => () => void;
  meters: VoiceMeters;
}

export function createVoiceStore(initial: Partial<VoiceState> = {}): VoiceStore {
  let state: VoiceState = { ...initialVoiceState, ...initial };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    meters: { levels: { mic: 0, bot: 0 }, wordTiming: { replyId: 0, anchors: [] } },
  };
}
