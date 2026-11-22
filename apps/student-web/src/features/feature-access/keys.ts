import type { TestTypeKey } from '@/shared/config/exams';

/**
 * Features an institute can switch off for its students (backend `feature-access` module, same keys).
 * Live voice follows its chat: dashboard voice → atlas_chat, lecture voice → lecture_chat, review voice → review_chat.
 */
export const RESTRICTABLE_FEATURES = [
  'video_lectures',
  'notes',
  'summary_videos',
  'quiz',
  'unit_test',
  'mid_term',
  'final_exam',
  'mock_exam',
  'pyq_exam',
  'chapter_pyq',
  'custom_exam',
  'practice_dpp',
  'chapter_practice',
  'diagnostic_test',
  'study_plan',
  'atlas_chat',
  'lecture_chat',
  'review_chat',
  'doubt_solver',
  'pyq_trends',
  'syllabus',
  'search',
] as const;

export type RestrictableFeature = (typeof RESTRICTABLE_FEATURES)[number];

/** One feature, or several: an entry point that leads to several features is locked only when all of them are. */
export type FeatureKeys = RestrictableFeature | readonly RestrictableFeature[];

export function isRestrictableFeature(value: unknown): value is RestrictableFeature {
  return typeof value === 'string' && (RESTRICTABLE_FEATURES as readonly string[]).includes(value);
}

export const featureList = (keys: FeatureKeys): readonly RestrictableFeature[] =>
  typeof keys === 'string' ? [keys as RestrictableFeature] : (keys as readonly RestrictableFeature[]);

/**
 * The feature(s) behind each test type. Quiz and unit test share the `quiz` route, so the route is locked only when
 * both are; the player shows the disabled screen when the backend refuses the one that was opened (403).
 */
export const TEST_TYPE_FEATURE: Record<TestTypeKey, readonly RestrictableFeature[]> = {
  mock: ['mock_exam'],
  pyq: ['pyq_exam'],
  'chapter-pyq': ['chapter_pyq'],
  custom: ['custom_exam'],
  mid: ['mid_term'],
  final: ['final_exam'],
  quiz: ['quiz', 'unit_test'],
  dpp: ['practice_dpp'],
  practice: ['chapter_practice'],
};

/** A course assessment's type (learn API `type`) → its feature. */
const ASSESSMENT_FEATURE: Record<string, RestrictableFeature> = {
  quiz: 'quiz',
  unit_test: 'unit_test',
  mid_term_exam: 'mid_term',
  final_exam: 'final_exam',
};

export const assessmentFeature = (type: string | null | undefined): RestrictableFeature | null =>
  (type && ASSESSMENT_FEATURE[type]) || null;

/** What a restricted entry point says (tooltip, dialog, full-screen message). */
export const RESTRICTED_COPY = {
  tooltip: 'Not enabled by your institute',
  dialogTitle: 'Not enabled by your institute',
  dialog: "This feature isn't enabled for your account by your institute. Please contact your institute.",
  screenTitle: 'Not enabled by your institute',
  screen: 'Contact your institute to use this feature.',
} as const;
