import { LEARN_API, learnApiBase, type ExamRef } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/errors';
import { assertOk } from '@/shared/lib/unwrap';

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

/** End-of-chapter (`difficulty`: easy / medium / hard) and PYQ (`difficulty_level`) questions of a chapter. */
export function toBankQuestions(body: unknown): BankQuestion[] {
  return toArray(asRaw(asRaw(body).data).questions).map((raw) => {
    const difficulty = str(raw.difficulty) ?? str(raw.difficulty_level);
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
  const text = str(data.text);
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

/** v4 doubt solver routes of an exam (one set per category, the exam picked by its id). */
export const doubtsApiBase = (exam: ExamRef) => `/api/v4/chat/${exam.category}/${exam.examId}/doubts`;

export interface TutorRequest {
  chatId: number;
  text: string;
  className: string | null;
  subject: SolverSubject | null;
  images?: File[];
  imageUrls?: string[];
  attachedImageUrls?: string[];
}

function tutorForm({ text, className, subject, images, imageUrls, attachedImageUrls }: TutorRequest) {
  const form = new FormData();
  form.append('text', text);
  form.append('class_name', String(className ?? ''));
  form.append('sub_name', String(subject?.title ?? ''));
  images?.forEach((image) => form.append('image', image, image.name || 'image.jpg'));
  imageUrls?.forEach((url) => form.append('image_url', url));
  attachedImageUrls?.forEach((url) => form.append('attached_image_url', url));
  return form;
}

export const solverApi = {
  /** Board: the textbooks of the student's class. Competitive: every textbook of the exam. */
  books: async (exam: ExamRef, classId: number | null) =>
    toBooks(
      asRaw(
        assertOk(
          await apiClient.get(`${learnApiBase(exam)}/textbooks`, {
            params: exam.category === 'competitive' ? undefined : { class_id: classId },
          }),
        ),
      ).data,
      exam.category === 'competitive',
    ),

  chapters: async (bookId: number) => toChapters(assertOk(await apiClient.get(`${LEARN_API}/courses/${bookId}/outline`))),

  /**
   * End of chapter: the NCERT questions (board); competitive chapters have none, so a daily sample of the
   * chapter's questions. PYQs: the chapter's previous-year questions.
   */
  bankQuestions: async (exam: ExamRef, chapterId: number, tab: BankTab) => {
    const path =
      tab === 'pyq'
        ? `${LEARN_API}/modules/${chapterId}/pyqs`
        : exam.category === 'competitive'
          ? `${learnApiBase(exam)}/chapters/${chapterId}/questions`
          : `${LEARN_API}/modules/${chapterId}/ncert-questions`;
    return toBankQuestions(assertOk(await apiClient.get(path)));
  },

  /** Is this a real question for the subject? (the backend uses the maths checker for MATHEMATICS) */
  checkQuestion: async (exam: ExamRef, subject: SolverSubject | null, query: string): Promise<boolean> => {
    const body = asRaw(
      assertOk(await apiClient.post(`${doubtsApiBase(exam)}/check`, { query, sub_name: subject?.title ?? '' }, { timeout: 60_000 })),
    );
    return asRaw(body.data).valid === true;
  },

  /** Reads a photo of a question (OCR): text with LaTeX, plus described diagrams. */
  extractQuestion: async (exam: ExamRef, file: File): Promise<{ text: string; diagrams: { description: string; base64: string }[] }> => {
    const form = new FormData();
    form.append('image', file);
    const data = asRaw(asRaw(assertOk(await apiClient.post(`${doubtsApiBase(exam)}/extract-question`, form, { timeout: 90_000 }))).data);
    const diagrams = toArray(data.diagrams).map((d) => ({ description: str(d.description) ?? '', base64: str(d.base64) ?? '' }));
    return { text: removeLatexTables(str(data.text) ?? ''), diagrams };
  },

  /** Opens a solver chat (counts against the plan's doubt limit of the class). */
  createChat: async (exam: ExamRef, input: { subjectId: number | null; classId: number | null }) => {
    const body = asRaw(assertOk(await apiClient.post(`${doubtsApiBase(exam)}/chats`, { subject_id: input.subjectId, class_id: input.classId })));
    const chatId = num(asRaw(body.data).chat_id);
    if (!chatId) throw new ApiError({ status: 502, code: 'NO_CHAT', message: "Couldn't start solving. Please try again." });
    return chatId;
  },

  /** One tutoring turn (JSON reply; this endpoint doesn't stream). */
  ask: async (exam: ExamRef, request: TutorRequest) =>
    toTutorReply(
      asRaw(assertOk(await apiClient.post(`${doubtsApiBase(exam)}/chats/${request.chatId}/ask`, tutorForm(request), { timeout: 120_000 }))).data,
    ),

  conceptCards: async (exam: ExamRef, request: TutorRequest) =>
    toConceptCards(
      asRaw(
        assertOk(await apiClient.post(`${doubtsApiBase(exam)}/chats/${request.chatId}/concept-cards`, tutorForm(request), { timeout: 120_000 })),
      ).data,
    ),

  messages: async (exam: ExamRef, chatId: number) =>
    toSolverMessages(asRaw(assertOk(await apiClient.get(`${doubtsApiBase(exam)}/chats/${chatId}/messages`))).data),

  history: async (exam: ExamRef, classId: number) =>
    toDoubtHistory(assertOk(await apiClient.get(`${doubtsApiBase(exam)}/chats`, { params: { class_id: classId } }))),
};
