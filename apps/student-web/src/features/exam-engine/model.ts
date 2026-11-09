import type { ExamConfig } from '@/shared/config/exams';

/**
 * One question model for every exam and test type. Adapters translate each backend's shape
 * into this, so the player and result screens never see backend field names.
 */
export type QuestionKind = 'mcq' | 'written' | 'multipart';

export interface ExamOption {
  id: string;
  html: string;
  image: string | null;
}

export interface QuestionPart {
  id: string;
  html: string;
  image: string | null;
  marks: number | null;
}

export interface ExamQuestion {
  id: string;
  kind: QuestionKind;
  typeLabel: string;
  html: string;
  image: string | null;
  marks: number | null;
  options: ExamOption[];
  parts: QuestionPart[];
}

export interface UploadedImage {
  url: string;
  publicId: string;
}

export interface WrittenAnswer {
  /** Plain text (what counts as "answered"; also the fallback when there is no rich HTML). */
  text: string;
  images: UploadedImage[];
  /**
   * Rich-text answer from the player's editor (paragraphs, lists, inline images), stored by the backend
   * as `selected_answer.text`. Absent for answers that only have plain text.
   */
  html?: string;
}

export type Answer =
  | { kind: 'option'; optionId: string }
  | ({ kind: 'written' } & WrittenAnswer)
  | { kind: 'parts'; parts: Record<string, WrittenAnswer> };

export type QuestionStatus = 'not-visited' | 'skipped' | 'answered' | 'marked';

/** Everything the student has done in an attempt; what gets saved and submitted. */
export interface AttemptSnapshot {
  answers: Record<string, Answer>;
  visited: string[];
  marked: string[];
}

export interface ExamSession {
  /** Stable key of this attempt (set id or attempt id). */
  key: string;
  title: string;
  questions: ExamQuestion[];
  /** Epoch ms when time runs out, or null when untimed. */
  deadline: number | null;
  /** Answers restored from the server when resuming. */
  initial: AttemptSnapshot;
  /** Adapter-private data needed to save/submit (raw questions, attempt ids …). */
  context: unknown;
}

export type Outcome = 'correct' | 'incorrect' | 'partial' | 'unattempted';

export interface ResultOption extends ExamOption {
  isCorrect: boolean;
  isSelected: boolean;
}

export interface ResultQuestion {
  id: string;
  kind: QuestionKind;
  typeLabel: string;
  html: string;
  image: string | null;
  marks: number | null;
  obtained: number | null;
  outcome: Outcome;
  options: ResultOption[];
  answerHtml: string | null;
  feedbackHtml: string | null;
  sampleAnswerHtml: string | null;
  explanationImage: string | null;
  parts: ResultQuestion[];
}

export interface ExamResult {
  title: string;
  totalMarks: number;
  obtained: number;
  counts: Record<Outcome, number>;
  questions: ResultQuestion[];
  attemptedAt: string | null;
  /** Paper / set id, used by the post-submission chat (absent when the backend doesn't send it). */
  assessmentId?: string | null;
}

export type SetStatus = 'new' | 'in-progress' | 'completed';

export interface TestSetSummary {
  id: string;
  title: string;
  subtitle: string | null;
  questionCount: number | null;
  durationMinutes: number | null;
  status: SetStatus;
  lastScore: { obtained: number; total: number } | null;
  lastAttemptId: string | null;
}

export interface SubjectGroup {
  id: string;
  title: string;
  count: number;
}

/** Score the backend returns straight after submitting, shown in the completion dialog. */
export interface SubmitSummary {
  totalQuestions: number | null;
  totalMarks: number | null;
  obtained: number | null;
  correct: number | null;
  incorrect: number | null;
  partial: number | null;
}

export interface SubmitOutcome {
  attemptId: string;
  summary?: SubmitSummary | null;
}

/** Who is taking the test: the exam from the registry and the class from the student's plan. */
export interface TestContext {
  exam: ExamConfig;
  classId: number;
}

/** The backend says this set was already submitted (e.g. today's DPP): show its result instead. */
export class AlreadySubmittedError extends Error {
  readonly attemptId: string;
  constructor(attemptId: string) {
    super('This test has already been submitted.');
    this.name = 'AlreadySubmittedError';
    this.attemptId = attemptId;
  }
}
