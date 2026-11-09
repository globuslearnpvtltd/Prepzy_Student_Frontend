import type { Answer, AttemptSnapshot, ExamQuestion, QuestionStatus, WrittenAnswer } from './model';

export const emptySnapshot = (): AttemptSnapshot => ({ answers: {}, visited: [], marked: [] });

const hasWritten = (answer: WrittenAnswer) => answer.text.trim().length > 0 || answer.images.length > 0;

export function isAnswered(answer: Answer | undefined): boolean {
  if (!answer) return false;
  switch (answer.kind) {
    case 'option':
      return answer.optionId !== '';
    case 'written':
      return hasWritten(answer);
    case 'parts':
      return Object.values(answer.parts).some(hasWritten);
  }
}

/** Palette status: review marks win, then answered, then visited-but-blank (skipped). */
export function statusOf(questionId: string, snapshot: AttemptSnapshot): QuestionStatus {
  if (snapshot.marked.includes(questionId)) return 'marked';
  if (isAnswered(snapshot.answers[questionId])) return 'answered';
  if (snapshot.visited.includes(questionId)) return 'skipped';
  return 'not-visited';
}

export function countStatuses(questions: readonly ExamQuestion[], snapshot: AttemptSnapshot) {
  const counts: Record<QuestionStatus, number> = { 'not-visited': 0, skipped: 0, answered: 0, marked: 0 };
  for (const question of questions) counts[statusOf(question.id, snapshot)] += 1;
  const answered = questions.filter((q) => isAnswered(snapshot.answers[q.id])).length;
  return { ...counts, answeredTotal: answered, unanswered: questions.length - answered };
}

export function withAnswer(snapshot: AttemptSnapshot, questionId: string, answer: Answer | null): AttemptSnapshot {
  const answers = { ...snapshot.answers };
  if (answer && isAnswered(answer)) answers[questionId] = answer;
  else if (answer && answer.kind !== 'option')
    answers[questionId] = answer; // keep a written draft that is blank
  else delete answers[questionId];
  return { ...snapshot, answers, visited: addUnique(snapshot.visited, questionId) };
}

export function withVisit(snapshot: AttemptSnapshot, questionId: string): AttemptSnapshot {
  return snapshot.visited.includes(questionId) ? snapshot : { ...snapshot, visited: [...snapshot.visited, questionId] };
}

export function withMarkToggled(snapshot: AttemptSnapshot, questionId: string): AttemptSnapshot {
  const marked = snapshot.marked.includes(questionId)
    ? snapshot.marked.filter((id) => id !== questionId)
    : [...snapshot.marked, questionId];
  return { ...snapshot, marked, visited: addUnique(snapshot.visited, questionId) };
}

function addUnique(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
}

/** Escapes plain text for embedding in HTML. */
export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

const imageHtml = (url: string) => `<p><img src="${escapeHtml(url)}" alt="Answer image"></p>`;

/**
 * Written answers are stored by the backend as HTML (paragraphs + images) for grading, with the uploaded
 * images also listed in `selected_answer.images`. Rich answers keep the editor's HTML; any listed image the
 * HTML doesn't show yet is appended so the grader always sees every photo.
 */
export function writtenToHtml(answer: WrittenAnswer): string {
  if (answer.html && answer.html.trim()) {
    const missing = answer.images.filter((img) => !answer.html!.includes(escapeHtml(img.url)) && !answer.html!.includes(img.url));
    return answer.html + missing.map((img) => imageHtml(img.url)).join('');
  }
  const paragraphs = answer.text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`);
  const images = answer.images.map((img) => imageHtml(img.url));
  return [...paragraphs, ...images].join('');
}

/** Image URLs embedded in answer HTML, in order. */
export function htmlImageUrls(html: string): string[] {
  return Array.from(html.matchAll(/<img[^>]*\ssrc=["']([^"']+)["']/gi), (m) => m[1]!.replace(/&amp;/g, '&'));
}

/** Turns stored answer HTML back into editable text (images are restored separately). */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<img[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
