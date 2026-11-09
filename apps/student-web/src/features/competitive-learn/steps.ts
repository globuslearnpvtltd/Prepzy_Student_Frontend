/** A chapter's four steps, in order (sidebar, Prev / Next and the URL's last segment). */
export const CHAPTER_STEPS = [
  { key: 'video-lectures', title: 'Video Lectures', crumb: 'Video Lecture' },
  { key: 'study-notes', title: 'Study Notes', crumb: 'Study Notes' },
  { key: 'practice-questions', title: 'Practice Questions', crumb: 'Assessment Test' },
  { key: 'chapter-pyq', title: 'Previous Year Questions', crumb: 'Chapter PYQ' },
] as const;

export type ChapterStep = (typeof CHAPTER_STEPS)[number]['key'];

export const FIRST_STEP: ChapterStep = 'video-lectures';

export function isChapterStep(value: string): value is ChapterStep {
  return CHAPTER_STEPS.some((step) => step.key === value);
}

/** The steps before and after `step` (null at either end). */
export function adjacentSteps(step: ChapterStep): { prev: ChapterStep | null; next: ChapterStep | null } {
  const index = CHAPTER_STEPS.findIndex((s) => s.key === step);
  return { prev: CHAPTER_STEPS[index - 1]?.key ?? null, next: CHAPTER_STEPS[index + 1]?.key ?? null };
}
