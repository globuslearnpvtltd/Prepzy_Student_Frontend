import { apiClient } from '@/shared/lib/api-client';
import { ApiError, isApiError } from '@/shared/lib/errors';
import {
  isDashboardVariant,
  isPostAssessmentVariant,
  type VoiceConfig,
  type VoiceErrorInfo,
  type VoiceLanguage,
  type VoiceTurn,
  type VoiceVariant,
} from './types';

/** Start (SDP offer → answer) and save (transcript) endpoints per tutor. */
export const VOICE_ENDPOINTS: Record<VoiceVariant, { start: string; save: string }> = {
  lecture: { start: '/api/v1/chat/lecture-voice/start', save: '/api/v1/chat/lecture-voice/save' },
  'neet-lecture': { start: '/api/neet/chat/lecture-voice/start', save: '/api/neet/chat/lecture-voice/save' },
  dashboard: { start: '/api/v1/chat/dashboard-voice/start', save: '/api/v1/chat/dashboard-voice/save' },
  'neet-dashboard': { start: '/api/neet/chat/dashboard-voice/start', save: '/api/neet/chat/dashboard-voice/save' },
  'post-assessment': { start: '/api/v1/chat/post-assessment-voice/start', save: '/api/v1/chat/post-assessment-voice/save' },
  'neet-post-assessment': { start: '/api/neet/chat/post-assessment-voice/start', save: '/api/neet/chat/post-assessment-voice/save' },
};

/** At most this many earlier turns go to the voice agent as history. */
export const HISTORY_LIMIT = 20;

/** What each tutor needs besides the SDP offer, language and history. */
export function startScope(config: VoiceConfig): Record<string, unknown> {
  const { variant, courseId, lectureId, moduleId, classId, className, postAssessment: pa } = config;
  // class_id is read by the feature meter on every variant except the board lecture.
  const meterClass = classId ? { class_id: classId } : {};
  if (isPostAssessmentVariant(variant)) {
    if (!pa) return {};
    // The voice agent only needs the question itself; the ids are for saving the transcript.
    return 'options' in pa
      ? {
          question: pa.question,
          question_diagram: pa.question_diagram,
          options: pa.options,
          correct_option_id: pa.correct_option_id,
          selected_option_id: pa.selected_option_id,
          explanation: pa.explanation,
        }
      : {
          question: pa.question,
          question_diagram: pa.question_diagram,
          sample_answer: pa.sample_answer,
          sample_diagram: pa.sample_diagram,
          student_answer: pa.student_answer,
          student_diagram: pa.student_diagram,
          marks_awarded: pa.marks_awarded,
          total_marks: pa.total_marks,
          feedback: pa.feedback,
        };
  }
  if (variant === 'dashboard') return { ...meterClass, ...(className ? { class_name: className } : {}) };
  if (variant === 'neet-dashboard') return meterClass;
  if (variant === 'neet-lecture') return { course_id: courseId, module_id: moduleId, ...meterClass };
  return { course_id: courseId, lecture_id: lectureId };
}

/** Ids the transcript is saved under. */
export function saveScope(config: VoiceConfig): Record<string, unknown> {
  const { variant, courseId, classId, postAssessment: pa } = config;
  if (isPostAssessmentVariant(variant)) {
    return {
      assessment_id: pa?.assessment_id,
      question_id: pa?.question_id,
      attempt_id: pa?.attempt_id,
      ...(pa && 'sub_question_id' in pa ? { sub_question_id: pa.sub_question_id ?? null } : {}),
    };
  }
  return isDashboardVariant(variant) ? { class_id: classId ?? null } : { course_id: courseId };
}

/** Earlier turns for the agent: non-empty, newest {@link HISTORY_LIMIT}, role + text only. */
export const toHistory = (turns: VoiceTurn[]) =>
  turns
    .filter((t) => t.text?.trim())
    .slice(-HISTORY_LIMIT)
    .map(({ role, text }) => ({ role, text }));

type Raw = Record<string, unknown>;
const asRaw = (value: unknown): Raw => (value && typeof value === 'object' ? (value as Raw) : {});

export interface StartInput {
  offer: { sdp: string; type: string };
  language: VoiceLanguage;
  history: VoiceTurn[];
}

export const liveVoiceApi = {
  /** Sends the SDP offer; returns the voice service's SDP answer. */
  start: async (config: VoiceConfig, input: StartInput): Promise<RTCSessionDescriptionInit> => {
    const body = await apiClient.post(
      VOICE_ENDPOINTS[config.variant].start,
      { sdp: input.offer.sdp, type: input.offer.type, ...startScope(config), language: input.language, history: toHistory(input.history) },
      { timeout: 30_000 },
    );
    const answer = asRaw(asRaw(body).data);
    if (typeof answer.sdp !== 'string' || !answer.sdp) {
      throw new ApiError({ status: 502, code: 'NO_ANSWER', message: 'The voice service returned no answer.' });
    }
    return { sdp: answer.sdp, type: answer.type === 'pranswer' ? 'pranswer' : 'answer' };
  },

  /** Saves the call's transcript into the text chat; returns that chat's id. */
  save: async (config: VoiceConfig, chatId: number | null, turns: VoiceTurn[]): Promise<number | null> => {
    const body = await apiClient.post(VOICE_ENDPOINTS[config.variant].save, {
      chat_id: chatId,
      ...saveScope(config),
      turns: turns.map(({ role, text, image }) => ({ role, text, image })),
    });
    const id = Number(asRaw(asRaw(body).data).chat_id);
    return Number.isFinite(id) && id > 0 ? id : null;
  },
};

/* --------------------------------------------- errors --------------------------------------------- */

export function micErrorInfo(error: unknown): VoiceErrorInfo {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      title: 'Microphone is blocked',
      message: 'Allow microphone access for Prepzy in your browser settings, then try again.',
      retryable: true,
    };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { title: 'No microphone found', message: 'Connect a microphone or earphones with a mic and try again.', retryable: true };
  }
  return { title: "Couldn't start the microphone", message: 'Close other apps using the mic and try again.', retryable: true };
}

/**
 * What to show when starting fails. null = say nothing here: 401 / 429 are handled app-wide by the api
 * client (sign-in redirect / plan limit dialog), so the call just closes.
 */
export function startErrorInfo(error: unknown, variant: VoiceVariant): VoiceErrorInfo | null {
  if (!isApiError(error)) {
    return { title: "Couldn't connect", message: "Your browser couldn't start the live talk. Please try again.", retryable: true };
  }
  if (error.status === 401 || error.status === 429) return null;
  if (error.status === 404) {
    const where = isDashboardVariant(variant) ? 'right now' : isPostAssessmentVariant(variant) ? 'for this question yet' : 'for this lecture yet';
    return { title: 'Not available yet', message: `Live talk isn't available ${where}. You can still type your doubt.`, retryable: false };
  }
  if (error.status === 503) {
    return { title: 'Live talk is unavailable', message: 'Live talk is switched off right now. Please type your doubt instead.', retryable: false };
  }
  return { title: "Couldn't connect", message: 'Something went wrong while connecting. Please try again.', retryable: true };
}

export const CONNECTION_LOST: VoiceErrorInfo = {
  title: 'Connection lost',
  message: 'The live talk got disconnected. Check your internet and try again.',
  retryable: true,
};
