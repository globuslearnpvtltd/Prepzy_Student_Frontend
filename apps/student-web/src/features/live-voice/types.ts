/** Where the call happens and what the tutor talks about. */
// "lecture": board lecture tutor (course + lecture). "neet-lecture": NEET chapter tutor (course + module).
// "dashboard": board Atlas (the student's class). "neet-dashboard": NEET Atlas (backend picks the class).
// "post-assessment": board Vedica on a result page (one evaluated question).
// "neet-post-assessment": NEET Vedica on a result page (one MCQ).
export type VoiceVariant = 'lecture' | 'neet-lecture' | 'dashboard' | 'neet-dashboard' | 'post-assessment' | 'neet-post-assessment';

export type VoicePhase =
  | 'idle'
  | 'connecting' // offer sent, waiting for "ready"
  | 'listening' // tutor waiting for the student
  | 'speaking' // student talking (user_interim arriving)
  | 'endturn' // user_final received, about to think
  | 'thinking'
  | 'answering' // tutor speaking
  | 'interrupted' // student cut in while the tutor was speaking
  | 'error';

export type VoiceLanguage = 'english' | 'hindi' | 'hinglish';

export interface VoiceAvatar {
  /** "CV Raman, The Physicist" — the part before the comma is shown. */
  name: string;
  image: string | null;
}

export interface VoiceTurn {
  role: 'user' | 'assistant';
  text: string;
  image?: string;
  interrupted?: boolean;
}

export interface VoiceFigure {
  number?: number;
  url: string;
}

export interface VoiceReply {
  /** Increments per tutor reply; lets the word highlighter reset when a new answer starts. */
  id: number;
  text: string;
  figure: VoiceFigure | null;
  /** All text received (bot_end); the reply stays on screen while the audio catches up. */
  done?: boolean;
}

export interface VoiceSessionSummary {
  durationSec: number;
  turns: VoiceTurn[];
  saved: boolean;
}

export interface VoiceErrorInfo {
  title: string;
  message: string;
  retryable: boolean;
}

/** Events the voice service sends on the "events" data channel. */
export type VoiceServerEvent =
  | { type: 'ready' }
  | { type: 'state'; value: 'listening' | 'thinking' | 'speaking' }
  | { type: 'user_interim'; text: string }
  | { type: 'user_final'; text: string }
  // bot_start / bot_end may carry the whole reply when the service doesn't stream deltas.
  | { type: 'bot_start'; text?: string }
  | { type: 'figure'; number?: number; url: string }
  | { type: 'bot_delta'; text: string }
  | { type: 'bot_end'; interrupted?: boolean; text?: string }
  // Speaking time of one word (index counts words outside <solution>, a whole \(…\) formula as one word).
  | { type: 'bot_word'; index: number; start_ms: number }
  // Sentence-level time; without index it starts right after the previous segment's words.
  | { type: 'bot_segment'; text: string; start_ms: number; index?: number };

/** Speaking times received for one reply: where in the audio each anchored word starts. */
export interface WordTiming {
  replyId: number;
  anchors: { index: number; ms: number }[];
}

/** The evaluated board question Vedica talks about (same fields as the text post-assessment chat). */
export interface PostAssessmentVoiceContext {
  assessment_id?: number | string;
  question_id?: number | string;
  attempt_id?: number | string;
  sub_question_id?: number | string | null;
  question: string;
  question_diagram: string;
  sample_answer: string;
  sample_diagram: string;
  student_answer: string;
  student_diagram: string;
  marks_awarded: number;
  total_marks: number;
  feedback: string;
}

/** The NEET MCQ Vedica talks about (same fields as the NEET text post-assessment chat). */
export interface NeetPostAssessmentVoiceContext {
  assessment_id?: number | string;
  question_id?: number | string;
  attempt_id?: number | string;
  question: string;
  question_diagram: string;
  options: { id: number | string; text: string; image_description?: string }[];
  correct_option_id: number | string | null;
  selected_option_id: number | string | null;
  explanation: string;
}

/** What a surface tells the provider: which tutor, and the ids / question it is about. */
export interface VoiceConfig {
  variant: VoiceVariant;
  courseId?: number | null;
  lectureId?: number | null;
  moduleId?: number | null;
  /** Read by the feature meter (and tags saved dashboard messages). */
  classId?: number | null;
  /** Board dashboard: the plan's class; the backend falls back to the student's own class. */
  className?: string | null;
  postAssessment?: PostAssessmentVoiceContext | NeetPostAssessmentVoiceContext;
}

export interface StartVoiceOptions {
  avatar: VoiceAvatar | null;
  /** The text chat the call continues (its transcript is saved into it). */
  chatId: number | null;
  /** Plain-text conversation so far, oldest first. */
  history: VoiceTurn[];
}

export const isDashboardVariant = (variant: VoiceVariant) => variant === 'dashboard' || variant === 'neet-dashboard';
export const isPostAssessmentVariant = (variant: VoiceVariant) => variant === 'post-assessment' || variant === 'neet-post-assessment';
