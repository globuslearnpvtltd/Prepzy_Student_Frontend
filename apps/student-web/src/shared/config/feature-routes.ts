import { TEST_TYPE_FEATURE, type FeatureKeys, type RestrictableFeature } from '@/features/feature-access';
import type { TestTypeKey } from './exams';

/**
 * Which institute-restrictable feature(s) a page of an exam belongs to, so opening a restricted page's URL directly
 * shows "Not enabled by your institute" (FeatureRouteGate in ExamFrame). A page with several features is blocked only
 * when all of them are restricted. Pages that mix features (dashboard, learn, a chapter, the tests hub) aren't gated:
 * their entry points are locked one by one. The coverage test (feature-routes.test.ts) lists every page.
 */

/**
 * Competitive chapter steps (/{exam}/learn/{course}/{module}/{step}, features/competitive-learn/steps.ts). A step is
 * restricted when ANY of its features is (the backend blocks the video step for either key).
 */
export const CHAPTER_STEP_FEATURE = {
  'video-lectures': ['video_lectures', 'summary_videos'],
  'study-notes': ['notes'],
  'practice-questions': ['chapter_practice'],
  'chapter-pyq': ['chapter_pyq'],
} as const satisfies Record<string, readonly RestrictableFeature[]>;

export type ChapterStepKey = keyof typeof CHAPTER_STEP_FEATURE;

/** A chapter step is locked when any of its features is restricted. */
export function isStepRestricted(step: ChapterStepKey, isRestricted: (keys: FeatureKeys) => boolean): boolean {
  return CHAPTER_STEP_FEATURE[step].some((feature) => isRestricted(feature));
}

const isStep = (value: string | undefined): value is ChapterStepKey =>
  !!value && Object.hasOwn(CHAPTER_STEP_FEATURE, value);
const isTestType = (value: string | undefined): value is TestTypeKey => !!value && Object.hasOwn(TEST_TYPE_FEATURE, value);

/**
 * A page's features as alternatives: the page is restricted when ANY alternative is, and an alternative that lists
 * several features is restricted only when ALL of them are (FeatureKeys semantics).
 */
export type PageFeatures = readonly FeatureKeys[];

type Rule = { pattern: RegExp; features: (match: RegExpExecArray) => PageFeatures | null };

const fixed =
  (...features: RestrictableFeature[]): (() => PageFeatures) =>
  () =>
    [features];

/** Patterns match the path after the /{exam} segment. First match wins. */
const RULES: Rule[] = [
  { pattern: /^\/mock-tests(\/|$)/, features: fixed('mock_exam') },
  { pattern: /^\/mock-sets(\/|$)/, features: fixed('mock_exam') },
  { pattern: /^\/pyq-library(\/|$)/, features: fixed('pyq_exam') },
  { pattern: /^\/pyq-sets(\/|$)/, features: fixed('pyq_exam') },
  {
    pattern: /^\/tests\/([^/]+)(\/|$)/,
    features: (match) => (isTestType(match[1]) ? [TEST_TYPE_FEATURE[match[1]]] : null),
  },
  { pattern: /^\/custom-test(\/|$)/, features: fixed('custom_exam') },
  { pattern: /^\/(diagnostic|diagnostic-test|diagnostic-result)(\/|$)/, features: fixed('diagnostic_test') },
  { pattern: /^\/study-plan(\/|$)/, features: fixed('study_plan') },
  { pattern: /^\/pyq-trends(\/|$)/, features: fixed('pyq_trends') },
  { pattern: /^\/syllabus(\/|$)/, features: fixed('syllabus') },
  { pattern: /^\/notes\/video(\/|$)/, features: fixed('summary_videos') },
  // The notes list (board: chapter notes and summary videos) is blocked only when both are; a book's notes by `notes`.
  { pattern: /^\/notes\/?$/, features: fixed('notes', 'summary_videos') },
  { pattern: /^\/notes\//, features: fixed('notes') },
  { pattern: /^\/learn\/[^/]+\/[^/]+\/lecture(\/|$)/, features: fixed('video_lectures') },
  { pattern: /^\/learn\/[^/]+\/[^/]+\/pyqs\/?$/, features: fixed('chapter_pyq') },
  {
    pattern: /^\/learn\/[^/]+\/[^/]+\/([^/]+)\/?$/,
    features: (match) => (isStep(match[1]) ? CHAPTER_STEP_FEATURE[match[1]] : null),
  },
  { pattern: /^\/doubt-solver(\/|$)/, features: fixed('doubt_solver') },
  { pattern: /^\/daily-practice(\/|$)/, features: fixed('practice_dpp') },
];

/** The feature(s) of an exam page (`/{exam}/…`, see PageFeatures), or null for pages that aren't one feature. */
export function featuresForPath(pathname: string): PageFeatures | null {
  const rest = pathname.replace(/^\/[^/]+/, '').split(/[?#]/)[0] ?? '';
  for (const rule of RULES) {
    const match = rule.pattern.exec(rest);
    if (match) return rule.features(match);
  }
  return null;
}

/** The page is restricted (any alternative restricted). */
export function isPageRestricted(features: PageFeatures, isRestricted: (keys: FeatureKeys) => boolean): boolean {
  return features.some((keys) => isRestricted(keys));
}
