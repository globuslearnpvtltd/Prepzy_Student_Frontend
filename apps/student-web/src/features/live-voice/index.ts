/** Live voice talk with a tutor (WebRTC). Logic + light wrappers; the screens load on first use (./ui). */
export { LiveVoiceProvider, useLiveVoice, type LiveVoice } from './provider';
export { LiveTalkMiniBar, LiveTalkSummary, LiveVoiceLayer } from './lazy';
export { LiveWaveIcon } from './components/live-wave-icon';
export { HISTORY_LIMIT, VOICE_ENDPOINTS, liveVoiceApi, micErrorInfo, saveScope, startErrorInfo, startScope, toHistory } from './api';
export { createVoiceStore, initialVoiceState, type VoiceState, type VoiceStore } from './store';
export { formatClock, formatDuration, htmlToPlain, splitAvatarName, splitReply, tokenizeSpoken, voiceReplyToPlain } from './text';
export {
  isDashboardVariant,
  isPostAssessmentVariant,
  type NeetPostAssessmentVoiceContext,
  type PostAssessmentVoiceContext,
  type StartVoiceOptions,
  type VoiceAvatar,
  type VoiceConfig,
  type VoicePhase,
  type VoiceTurn,
  type VoiceVariant,
} from './types';
