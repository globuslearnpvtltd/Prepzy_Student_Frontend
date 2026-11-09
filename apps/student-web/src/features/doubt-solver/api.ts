import type { ExamConfig } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/errors';

type Raw = Record<string, unknown>;

const isRaw = (value: unknown): value is Raw => !!value && typeof value === 'object' && !Array.isArray(value);
const asRaw = (value: unknown): Raw => (isRaw(value) ? value : {});
const toArray = (value: unknown): Raw[] => (Array.isArray(value) ? value.filter(isRaw) : []);
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const num = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** Board subjects Socrates can solve (the textbook API also lists languages etc.). Competitive: all. */
const SOLVABLE_BOARD_SUBJECTS = new Set([
  'SCIENCE',
  'MATHEMATICS',
  'PHYSICS',
  'CHEMISTRY',
  'BIOLOGY',
  'ACCOUNTANCY',
  'ECONOMICS',
  'SOCIAL SCIENCE',
  'HISTORY',
  'GEOGRAPHY',
  'POLITICAL SCIENCE',
  'SOCIOLOGY',
  'ENGLISH',
  'BUSINESS STUDIES',
]);

const ACRONYMS = new Set(['NEET', 'CBSE', 'NCERT', 'PCB', 'PCM', 'PCMB']);

/** "NEET-PHYSICS" → "NEET Physics", "SOCIAL SCIENCE" → "Social Science". */
export function formatSubject(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    // Acronyms (NEET, CBSE, PCB) stay upper-case.
    .map((word) => (ACRONYMS.has(word.toUpperCase()) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(' ');
}

/** Subject label without the exam prefix ("NEET-PHYSICS" → "Physics"), for headings. */
export const shortSubject = (name: string) => formatSubject(name.replace(/^NEET[\s-]*/i, ''));

export interface SolverSubject {
  id: number;
  /** Upper-case, as the tutor endpoints expect (`sub_name`). */
  title: string;
}

export interface SolverBook {
  bookId: number;
  title: string;
  image: string | null;
  subjectId: number;
  subjectName: string;
  className: string;
}

export interface Chapter {
  id: number;
  title: string;
  order: number;
}

export interface BankQuestion {
  id: number;
  type: string;
  marks: number | null;
  html: string;
  image: string | null;
  imageDescription: string | null;
  options: string[];
  subQuestions: string[];
  /** End of chapter: 1–3; PYQs: easy / medium / hard. */
  level: string | null;
  label: string | null;
}

export type BankTab = 'end' | 'pyq';

export interface ConceptCard {
  cardNo: number;
  title: string;
  explanation: string;
  image: string | null;
}

export interface Sources {
  className: string | null;
  subject: string | null;
  book: string | null;
  chapter: string | null;
  lecture: string | null;
}

export interface TutorReply {
  chatId: number | null;
  text: string;
  image: string | null;
  isFirst: boolean;
  cardNo: number | null;
  solved: boolean;
}

export interface SolverMessage {
  id: string;
  fromStudent: boolean;
  text: string;
  images: string[];
}

export interface DoubtHistoryItem {
  chatId: number;
  title: string;
  lastMessageAt: string | null;
  subjectId: number | null;
  subjectName: string | null;
  firstMessage: string;
}

/** What the tutor gets (`problem`, with diagram descriptions) and what the student sees in the first bubble. */
export interface SolvePayload {
  problem: string;
  display: string;
  images: string[];
  /** The images were already described in `problem` (question bank): send them as attachments, not to read. */
  imagesRead?: boolean;
}

/* ---------------------------------------------- normalisers ---------------------------------------------- */

export function toBooks(body: unknown, competitive: boolean): SolverBook[] {
  return toArray(asRaw(body).subject_courses)
    .filter((group) => competitive || SOLVABLE_BOARD_SUBJECTS.has((str(group.subject_name) ?? '').toUpperCase()))
    .flatMap((group) =>
      toArray(group.textbooks).map((book) => ({
        bookId: num(book.id) ?? 0,
        title: str(book.textbook_name) ?? 'Textbook',
        image: str(book.textbook_image),
        subjectId: num(group.subject_id) ?? 0,
        subjectName: str(group.subject_name) ?? '',
        className: str(book.class_name) ?? '',
      })),
    )
    .filter((book) => book.bookId > 0);
}

export function toChapters(body: unknown): Chapter[] {
  return toArray(asRaw(asRaw(body).data).finalList)
    .filter((item) => item.category === 'module')
    .map((item) => ({ id: num(item.id) ?? 0, title: str(item.title) ?? 'Chapter', order: num(item.module_order) ?? 0 }))
    .sort((a, b) => a.order - b.order);
}

const LEVELS: Record<string, string> = { '1': 'Easy', '2': 'Medium', '3': 'Hard' };

export function toBankQuestions(body: unknown): BankQuestion[] {
  return toArray(asRaw(asRaw(body).data).questions).map((raw) => {
    const difficulty = str(raw.difficulty_level);
    const level = difficulty ? formatSubject(difficulty) : (LEVELS[String(raw.question_level)] ?? null);
    const setName = str(raw.set_name);
    const year = raw.year === null || raw.year === undefined ? null : String(raw.year);
    return {
      id: num(raw.id) ?? 0,
      type: str(raw.type) ?? '',
      marks: num(raw.marks),
      html: str(raw.question_text) ?? '',
      image: str(raw.question_image),
      imageDescription: str(raw.question_image_description),
      options: toArray(raw.options).map((o) => str(o.option_text) ?? ''),
      subQuestions: toArray(raw.sub_questions).map((s) => str(s.sub_question_text) ?? ''),
      level,
      label: [setName, year].filter(Boolean).join(' · ') || null,
    };
  });
}

export function toConceptCards(body: unknown): { cards: ConceptCard[]; sources: Sources | null } {
  const data = asRaw(body);
  const cards = toArray(data.concept_cards)
    .map((card) => ({
      cardNo: num(card.card_no) ?? 0,
      title: str(card.title) ?? '',
      explanation: str(card.explanation) ?? '',
      image: str(card.image_url),
    }))
    .filter((card) => card.cardNo > 0 && card.title)
    .sort((a, b) => a.cardNo - b.cardNo);
  const raw = isRaw(data.sources) ? data.sources : null;
  const sources = raw
    ? { className: str(raw.Class), subject: str(raw.Subject), book: str(raw.Book), chapter: str(raw.Chapter), lecture: str(raw.Lecture) }
    : null;
  return { cards, sources: sources && Object.values(sources).some(Boolean) ? sources : null };
}

export function toTutorReply(body: unknown): TutorReply {
  const data = asRaw(body);
  const text = str(data.llm_responses);
  if (!text) throw new ApiError({ status: 502, code: 'EMPTY_REPLY', message: "Socrates couldn't reply. Please try again." });
  return {
    chatId: num(data.chat_id),
    text,
    image: str(data.image),
    isFirst: data.is_first_query === true,
    cardNo: num(data.current_card_no),
    solved: data.reached_final_solution === true,
  };
}

/** Stored image column: one URL or a JSON list of URLs. */
export function parseStoredImages(value: unknown): string[] {
  const raw = str(value)?.trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    try {
      const list: unknown = JSON.parse(raw);
      return Array.isArray(list) ? list.filter((u): u is string => typeof u === 'string' && !!u) : [];
    } catch {
      return [];
    }
  }
  return [raw];
}

/** The tutor's copy of the first question carries "Diagrams: …"; the student never typed that. */
export const stripDiagrams = (text: string) => text.replace(/\s*\n\s*Diagrams:\s*\n[\s\S]*$/, '').trim() || text;

export function toSolverMessages(body: unknown): SolverMessage[] {
  const rows = toArray(asRaw(body).conversations);
  const firstStudent = rows.find((row) => row.is_student === true || row.is_student === 1);
  return rows.map((row, index) => ({
    id: String(num(row.message_id) ?? `row-${index}`),
    fromStudent: row.is_student === true || row.is_student === 1,
    text: row === firstStudent ? stripDiagrams(str(row.text) ?? '') : (str(row.text) ?? ''),
    images: parseStoredImages(row.image),
  }));
}

export function toDoubtHistory(body: unknown): DoubtHistoryItem[] {
  return toArray(asRaw(asRaw(body).data).chats)
    .map((row) => ({
      chatId: num(row.chat_id) ?? 0,
      title: str(row.title) ?? 'Untitled doubt',
      lastMessageAt: str(row.last_message_at),
      subjectId: num(row.subject_id),
      subjectName: str(row.subject_name),
      firstMessage: str(row.first_message) ?? str(row.title) ?? '',
    }))
    .filter((item) => item.chatId > 0);
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** HTML → plain text, keeping LaTeX (the tutor reads `$…$`). */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** A question from the bank, PYQs or NCERT pages → what Socrates is asked. */
export function buildSolvePayload(question: {
  html: string;
  options?: string[];
  subQuestions?: string[];
  image?: string | null;
  imageDescription?: string | null;
}): SolvePayload {
  const parts = [htmlToText(question.html)];
  if (question.options?.length) parts.push(question.options.map((o, i) => `(${OPTION_LETTERS[i] ?? i + 1}) ${htmlToText(o)}`).join('\n'));
  if (question.subQuestions?.length) parts.push(question.subQuestions.map((s, i) => `(${i + 1}) ${htmlToText(s)}`).join('\n'));
  const display = parts.filter(Boolean).join('\n');
  const description = question.imageDescription?.trim();
  return {
    problem: description ? `${display}\n\nDiagrams:\nDiagram 1: ${description}` : display,
    display,
    images: question.image ? [question.image] : [],
    imagesRead: !!description,
  };
}

/** OCR output sometimes has LaTeX tables the tutor can't use. */
export function removeLatexTables(text: string): string {
  const begin = '\\begin{tabular';
  const end = '\\end{tabular}';
  let start = text.indexOf(begin);
  while (start !== -1) {
    let depth = 1;
    let i = start + begin.length;
    while (i < text.length && depth > 0) {
      const nextBegin = text.indexOf(begin, i);
      const nextEnd = text.indexOf(end, i);
      if (nextEnd === -1) {
        i = text.length;
        break;
      }
      if (nextBegin !== -1 && nextBegin < nextEnd) {
        depth += 1;
        i = nextBegin + begin.length;
      } else {
        depth -= 1;
        i = nextEnd + end.length;
      }
    }
    text = text.slice(0, start) + text.slice(i);
    start = text.indexOf(begin);
  }
  return text.trim();
}

/* ------------------------------------------------ requests ------------------------------------------------ */

export interface TutorRequest {
  chatId: number;
  text: string;
  className: string | null;
  subject: SolverSubject | null;
  images?: File[];
  imageUrls?: string[];
  attachedImageUrls?: string[];
}

function tutorForm({ chatId, text, className, subject, images, imageUrls, attachedImageUrls }: TutorRequest) {
  const form = new FormData();
  form.append('text', text);
  form.append('chat_id', String(chatId));
  form.append('class_name', String(className ?? ''));
  form.append('sub_name', String(subject?.title ?? ''));
  images?.forEach((image) => form.append('image', image, image.name || 'image.jpg'));
  imageUrls?.forEach((url) => form.append('image_url', url));
  attachedImageUrls?.forEach((url) => form.append('attached_image_url', url));
  return form;
}

export const solverApi = {
  books: async (exam: ExamConfig, classId: number | null) =>
    toBooks(
      exam.category === 'competitive'
        ? await apiClient.get('/api/neet/doubt-solver-subjects')
        : await apiClient.get('/api/v2/get-textbooks', { params: { class_id: classId } }),
      exam.category === 'competitive',
    ),

  chapters: async (bookId: number) => toChapters(await apiClient.get(`/api/v1/learn/module-outline/${bookId}`)),

  bankQuestions: async (chapterId: number, tab: BankTab) =>
    toBankQuestions(
      tab === 'end'
        ? await apiClient.get(`/api/v1/learn/chapter-unsolved/${chapterId}`, { params: { all: 1 } })
        : await apiClient.get(`/api/v1/learn/chapter-pyqs/${chapterId}`),
    ),

  /** Is this a real question for the subject? (maths has its own checker) */
  checkQuestion: async (subject: SolverSubject | null, query: string): Promise<boolean> => {
    const body = asRaw(
      subject?.title === 'MATHEMATICS'
        ? await apiClient.post('/api/chat/check_valid_maths_query', { query }, { timeout: 60_000 })
        : await apiClient.post('/api/chat/check-valid-subject-query', { query, sub_name: subject?.title }, { timeout: 60_000 }),
    );
    return body.result === 'true' || body.result === true;
  },

  /** Reads a photo of a question (OCR): text with LaTeX, plus described diagrams. */
  extractQuestion: async (file: File): Promise<{ text: string; diagrams: { description: string; base64: string }[] }> => {
    const form = new FormData();
    form.append('image', file);
    const body = asRaw(await apiClient.post('/api/chat/extract-question-from-image', form, { timeout: 90_000 }));
    const diagrams = toArray(body.diagrams).map((d) => ({ description: str(d.description) ?? '', base64: str(d.base64) ?? '' }));
    return { text: removeLatexTables(str(body.final_string) ?? ''), diagrams };
  },

  /** Opens a solver chat (counts against the plan's doubt limit). */
  createChat: async (input: { subjectId: number | null; classId: number | null; examId: number }) => {
    const body = asRaw(
      await apiClient.post('/api/chat/step_solver_chat/create', { subject_id: input.subjectId, class_id: input.classId, exam_id: input.examId }),
    );
    const chatId = num(body.chat_id);
    if (!chatId) throw new ApiError({ status: 502, code: 'NO_CHAT', message: "Couldn't start solving. Please try again." });
    return chatId;
  },

  /** One tutoring turn (JSON reply; this endpoint doesn't stream). */
  ask: async (request: TutorRequest) =>
    toTutorReply(await apiClient.post('/api/chat/step_solver_chat_interaction/v2', tutorForm(request), { timeout: 120_000 })),

  conceptCards: async (request: TutorRequest) =>
    toConceptCards(await apiClient.post('/api/chat/step_solver_concept_card/v1', tutorForm(request), { timeout: 120_000 })),

  messages: async (chatId: number) => toSolverMessages(await apiClient.get(`/api/chat/step_solver_chat/${chatId}/messages`)),

  history: async (classId: number) =>
    toDoubtHistory(await apiClient.get('/api/chat/step_solver_chat/history', { params: { class_id: classId } })),
};
