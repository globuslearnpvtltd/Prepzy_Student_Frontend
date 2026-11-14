import type { ExamRef } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/errors';
import { assertOk } from '@/shared/lib/unwrap';
import { readReply, type StreamedReply } from './stream';

type Raw = Record<string, unknown>;

const isRaw = (value: unknown): value is Raw => !!value && typeof value === 'object' && !Array.isArray(value);
const asRaw = (value: unknown): Raw => (isRaw(value) ? value : {});
const toArray = (value: unknown): Raw[] => (Array.isArray(value) ? value.filter(isRaw) : []);
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const num = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const flag = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';

/**
 * Where Atlas is talking from. Each surface keeps its own conversations on the backend:
 * - dashboard: the general assistant (dashboard card, mobile "Ask" sheet, ?atlas=1)
 * - lecture: the tutor inside a lecture / NEET video step, scoped to the course
 */
export type AtlasSurface =
  | { kind: 'dashboard' }
  | { kind: 'lecture'; courseId: number; moduleId?: number | null; lectureId?: number | null };

/** v4 chat routes of an exam: one set per category, the exam picked by its id (from the catalog). */
export const chatApiBase = (exam: ExamRef) => `/api/v4/chat/${exam.category}/${exam.examId}`;

/** Atlas routes of a surface: the dashboard chats of the exam, or the lecture tutor's chats of one course. */
export function atlasEndpoints(exam: ExamRef, surface: AtlasSurface) {
  const base = surface.kind === 'lecture' ? `${chatApiBase(exam)}/lectures/${surface.courseId}` : `${chatApiBase(exam)}/dashboard`;
  return {
    conversations: `${base}/conversation`,
    messages: (chatId: number) => `${base}/chats/${chatId}/messages`,
    history: `${base}/chats`,
    newChat: `${base}/chats`,
    send: `${base}/messages`,
    avatar: `${base}/avatar`,
  };
}

export interface ChatSources {
  book: string | null;
  subject: string | null;
  className: string | null;
  chapter: string | null;
  lecture: string | null;
}

export interface ChatMessage {
  id: string;
  fromStudent: boolean;
  text: string;
  /** Photo the student attached, or a diagram in the answer (URL or data URL). */
  image: string | null;
  textbookImage: string | null;
  sources: ChatSources | null;
  createdAt: string | null;
}

export interface Conversation {
  chatId: number | null;
  messages: ChatMessage[];
}

export interface HistoryItem {
  chatId: number;
  title: string;
  lastMessageAt: string | null;
}

export interface Avatar {
  name: string;
  image: string | null;
}

export interface AtlasAnswer {
  message: ChatMessage;
  followups: string[];
}

/** Answer images come back as raw base64, URLs or data URLs. */
export function imageSrc(value: unknown): string | null {
  const image = str(value);
  if (!image) return null;
  if (/^(https?:|data:|blob:|\/)/.test(image)) return image;
  return `data:image/png;base64,${image}`;
}

function toSources(value: unknown): ChatSources | null {
  if (!isRaw(value)) return null;
  const sources = {
    book: str(value.Book),
    subject: str(value.Subject),
    className: str(value.Class),
    chapter: str(value.Chapter),
    lecture: str(value.Lecture),
  };
  return Object.values(sources).some(Boolean) ? sources : null;
}

let localId = 0;
const nextId = () => `local-${Date.now()}-${(localId += 1)}`;

export function toMessage(raw: Raw): ChatMessage {
  return {
    id: num(raw.message_id) !== null ? String(raw.message_id) : nextId(),
    fromStudent: flag(raw.is_student ?? raw.isStudent),
    text: str(raw.text) ?? '',
    image: imageSrc(raw.image),
    textbookImage: str(raw.textbook_image),
    sources: toSources(raw.sources),
    createdAt: str(raw.created_at) ?? str(raw.updated_at),
  };
}

export function toConversation(body: unknown): Conversation {
  const data = asRaw(asRaw(body).data);
  return { chatId: num(data.latest_chat), messages: toArray(data.conversations).map(toMessage) };
}

export function toHistory(body: unknown): HistoryItem[] {
  return toArray(asRaw(asRaw(body).data).chats)
    .map((row) => ({ chatId: num(row.chat_id) ?? 0, title: str(row.title) ?? 'Untitled chat', lastMessageAt: str(row.last_message_at) }))
    .filter((item) => item.chatId > 0);
}

export function toAnswer(body: unknown): AtlasAnswer {
  const answer = asRaw(asRaw(asRaw(assertOk(body)).data).answer);
  if (!str(answer.text)) throw new ApiError({ status: 502, code: 'EMPTY_ANSWER', message: "Atlas couldn't answer that. Please try again." });
  const followups = Array.isArray(answer.followups) ? answer.followups.filter((f): f is string => typeof f === 'string') : [];
  return { message: { ...toMessage(answer), id: nextId(), fromStudent: false, createdAt: new Date().toISOString() }, followups };
}

export function toAvatar(body: unknown): Avatar | null {
  const first = toArray(asRaw(asRaw(body).data).avatar)[0];
  const name = first && str(first.name);
  return name ? { name: name.split(',')[0]!.trim(), image: str(first.image) } : null;
}

export interface SendInput {
  text: string;
  chatId: number | null;
  classId?: number | null;
  className?: string | null;
  image?: File | null;
  avatarName?: string | null;
}

export const assistantApi = {
  conversation: async (exam: ExamRef, surface: AtlasSurface) =>
    toConversation(await apiClient.get(atlasEndpoints(exam, surface).conversations)),

  messages: async (exam: ExamRef, surface: AtlasSurface, chatId: number) =>
    toConversation(await apiClient.get(atlasEndpoints(exam, surface).messages(chatId))).messages,

  history: async (exam: ExamRef, surface: AtlasSurface) =>
    toHistory(await apiClient.get(atlasEndpoints(exam, surface).history)),

  /** Starts a fresh conversation; returns its id. */
  newChat: async (exam: ExamRef, surface: AtlasSurface) => toConversation(await apiClient.post(atlasEndpoints(exam, surface).newChat)).chatId,

  send: async (exam: ExamRef, surface: AtlasSurface, input: SendInput): Promise<AtlasAnswer> => {
    const form = new FormData();
    form.append('text', input.text);
    if (input.className) form.append('class_name', input.className);
    if (input.classId) form.append('class_id', String(input.classId));
    if (input.chatId !== null) form.append('chat_id', String(input.chatId));
    if (input.image) form.append('image', input.image, input.image.name || 'image.jpg');
    if (surface.kind === 'lecture') {
      if (surface.moduleId) form.append('module_id', String(surface.moduleId));
      if (surface.lectureId) form.append('lecture_id', String(surface.lectureId));
    }
    if (input.avatarName) form.append('avatar', input.avatarName);
    return toAnswer(await apiClient.post(atlasEndpoints(exam, surface).send, form, { timeout: 90_000 }));
  },

  avatar: async (exam: ExamRef, surface: AtlasSurface) => toAvatar(await apiClient.get(atlasEndpoints(exam, surface).avatar)),

  /** Read-aloud: text → MP3 (POST /api/v4/chat/speech, base64 in `data.audio.audioContent`). */
  speech: async (text: string): Promise<Blob> => {
    const body = asRaw(await apiClient.post('/api/v4/chat/speech', { audio_text: text, identifier: 'dashboard' }, { timeout: 60_000 }));
    const content = str(asRaw(asRaw(asRaw(body.data).audio)).audioContent);
    if (!content) throw new ApiError({ status: 502, code: 'NO_AUDIO', message: "Couldn't read this answer aloud." });
    const base64 = content.includes(',') ? content.split(',')[1]! : content;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: 'audio/mpeg' });
  },
};

/* ------------------------------ Post-submission chat (result pages) ------------------------------ */

/** The question being discussed after a test, with what the student answered. */
export interface ReviewContext {
  assessmentId: number | string;
  questionId: number | string;
  attemptId: number | string;
  subQuestionId?: number | string | null;
  questionText: string;
  questionDiagram?: string | null;
  /** Board written answers. */
  sampleAnswer?: string | null;
  studentAnswer?: string | null;
  marksAwarded?: number;
  totalMarks?: number;
  feedback?: string | null;
  /** Competitive MCQs. */
  options?: { id: number | string; text: string }[];
  correctOptionId?: number | string | null;
  selectedOptionId?: number | string | null;
}

/** The review chat of one question of an attempt. */
const reviewPath = (exam: ExamRef, ctx: ReviewContext) =>
  `${chatApiBase(exam)}/review/${ctx.assessmentId}/${ctx.questionId}/${ctx.attemptId}/messages`;

export const reviewApi = {
  history: async (exam: ExamRef, ctx: ReviewContext): Promise<ChatMessage[]> => {
    const body = asRaw(
      await apiClient.get(reviewPath(exam, ctx), {
        params: exam.category === 'competitive' ? undefined : { sub_question_id: ctx.subQuestionId ?? undefined },
      }),
    );
    return toArray(asRaw(body.data).conversations).map(toMessage);
  },

  /** Streams the tutor's reply (SSE); `onText` gets the answer so far. */
  ask: async (
    exam: ExamRef,
    ctx: ReviewContext,
    text: string,
    onText: (text: string) => void,
    signal?: AbortSignal,
    /** A photo or the student's handwriting with the question. */
    image?: File | null,
  ): Promise<StreamedReply> => {
    let body: unknown;
    if (exam.category === 'competitive') {
      const fields = {
        text,
        question: ctx.questionText,
        question_diagram: ctx.questionDiagram ?? '',
        options: ctx.options ?? [],
        correct_option_id: ctx.correctOptionId ?? null,
        selected_option_id: ctx.selectedOptionId ?? null,
        explanation: ctx.feedback ?? '',
      };
      if (image) {
        // A picture goes as multipart; the options and the option ids travel as JSON strings (types kept).
        const form = new FormData();
        const { options, correct_option_id, selected_option_id, ...plain } = fields;
        for (const [key, value] of Object.entries(plain)) form.append(key, value);
        form.append('options', JSON.stringify(options));
        form.append('correct_option_id', JSON.stringify(correct_option_id));
        form.append('selected_option_id', JSON.stringify(selected_option_id));
        form.append('image', image, image.name || 'image.jpg');
        body = form;
      } else body = fields;
    } else {
      const form = new FormData();
      if (ctx.subQuestionId) form.append('sub_question_id', String(ctx.subQuestionId));
      form.append('text', text);
      form.append('question', ctx.questionText);
      form.append('question_diagram', ctx.questionDiagram ?? '');
      form.append('sample_answer', ctx.sampleAnswer ?? '');
      form.append('sample_diagram', '');
      form.append('student_answer', ctx.studentAnswer ?? '');
      form.append('student_diagram', '');
      form.append('marks_awarded', String(ctx.marksAwarded ?? 0));
      form.append('total_marks', String(ctx.totalMarks ?? 0));
      form.append('feedback', ctx.feedback ?? '');
      if (image) form.append('image', image, image.name || 'image.jpg');
      body = form;
    }
    const stream = await apiClient.stream(reviewPath(exam, ctx), body, { signal });
    return readReply(stream, onText, signal);
  },
};
