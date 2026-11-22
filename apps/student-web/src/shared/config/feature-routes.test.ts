import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { CHAPTER_STEPS } from '@/features/competitive-learn';
import { CATEGORY_DEFAULTS, type TestTypeKey } from './exams';
import { CHAPTER_STEP_FEATURE, featuresForPath, isPageRestricted, isStepRestricted } from './feature-routes';

const EXAM_ROOT = join(__dirname, '..', '..', 'app', '(student)', '[exam]');

/** Every page.tsx under app/(student)/[exam], as route segments without route groups. */
function pages(dir = EXAM_ROOT): string[][] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    if (name !== 'page.tsx') return [];
    return [
      relative(EXAM_ROOT, dir)
        .split(sep)
        .filter((segment) => segment && !/^\(.+\)$/.test(segment)),
    ];
  });
}

const TEST_TYPES = [...new Set([...CATEGORY_DEFAULTS.board.testTypes, ...CATEGORY_DEFAULTS.competitive.testTypes])];

/** Sample URLs of a page (one per test type / chapter step for those params). */
function samples(segments: string[]): string[] {
  let urls = ['/cbse'];
  for (const segment of segments) {
    const values =
      segment === '[testType]' ? TEST_TYPES : segment === '[step]' ? CHAPTER_STEPS.map((s) => s.key) : segment.startsWith('[') ? ['7'] : [segment];
    urls = urls.flatMap((url) => values.map((value) => `${url}/${value}`));
  }
  return urls;
}

/**
 * Pages that mix several features (their entry points are locked one by one) or aren't a restrictable feature.
 * A new page under [exam] must be mapped in feature-routes.ts or listed here.
 */
const NOT_ONE_FEATURE = new Set([
  '/cbse',
  '/cbse/7', // [section] placeholder
  '/cbse/dashboard',
  '/cbse/learn',
  '/cbse/learn/7',
  '/cbse/learn/7/7',
  '/cbse/learn/7/7/ncert-questions',
  '/cbse/assessments',
  '/cbse/tests',
  '/cbse/courses',
  '/cbse/courses/7',
  '/cbse/refer-and-earn',
  '/cbse/plans',
  '/cbse/plans/billing',
  '/cbse/profile',
  '/cbse/profile/change-password',
  '/cbse/profile/help',
  '/cbse/profile/parent',
  '/cbse/profile/request-account-delete',
]);

describe('feature routes', () => {
  it('maps every feature page under /[exam] to a feature key', () => {
    const urls = pages().flatMap(samples);
    expect(urls.length).toBeGreaterThan(40);
    const unmapped = urls.filter((url) => !featuresForPath(url) && !NOT_ONE_FEATURE.has(url));
    expect(unmapped).toEqual([]);
    // …and the allow-list has no stale entries.
    for (const url of NOT_ONE_FEATURE) {
      expect(urls).toContain(url);
      expect(featuresForPath(url)).toBeNull();
    }
  });

  it.each([
    ['/neet/mock-tests', [['mock_exam']]],
    ['/cbse/mock-sets/3', [['mock_exam']]],
    ['/neet/pyq-library', [['pyq_exam']]],
    ['/cbse/pyq-sets/3', [['pyq_exam']]],
    ['/cbse/tests/mock/4', [['mock_exam']]],
    ['/cbse/tests/final/result/9', [['final_exam']]],
    ['/cbse/tests/quiz/4', [['quiz', 'unit_test']]],
    ['/neet/tests/dpp/4', [['practice_dpp']]],
    ['/neet/tests/practice/4', [['chapter_practice']]],
    ['/neet/custom-test/create', [['custom_exam']]],
    ['/cbse/diagnostic', [['diagnostic_test']]],
    ['/cbse/diagnostic-test/3', [['diagnostic_test']]],
    ['/cbse/diagnostic-result?assessment_id=3', [['diagnostic_test']]],
    ['/cbse/study-plan/create', [['study_plan']]],
    ['/cbse/pyq-trends', [['pyq_trends']]],
    ['/cbse/syllabus', [['syllabus']]],
    ['/cbse/notes', [['notes', 'summary_videos']]],
    ['/cbse/notes/5', [['notes']]],
    ['/cbse/notes/video/5', [['summary_videos']]],
    ['/cbse/learn/1/2/lecture/3', [['video_lectures']]],
    ['/cbse/learn/1/2/pyqs', [['chapter_pyq']]],
    ['/neet/learn/1/2/video-lectures', ['video_lectures', 'summary_videos']],
    ['/neet/learn/1/2/study-notes', ['notes']],
    ['/neet/doubt-solver', [['doubt_solver']]],
    ['/neet/daily-practice', [['practice_dpp']]],
  ])('%s → %j', (url, expected) => {
    expect(featuresForPath(url)).toEqual(expected);
  });

  it('ignores unknown test types and chapter steps', () => {
    expect(featuresForPath('/cbse/tests/unknown/1')).toBeNull();
    expect(featuresForPath('/cbse/learn/1/2/unknown')).toBeNull();
    expect(featuresForPath('/cbse/tests')).toBeNull();
  });

  it('blocks a page when any alternative is fully restricted', () => {
    const restricted = (set: string[]) => (keys: string | readonly string[]) =>
      (typeof keys === 'string' ? [keys] : keys).every((key) => set.includes(key));
    expect(isPageRestricted(featuresForPath('/cbse/tests/quiz/1')!, restricted(['quiz']))).toBe(false);
    expect(isPageRestricted(featuresForPath('/cbse/tests/quiz/1')!, restricted(['quiz', 'unit_test']))).toBe(true);
    // The NEET video step is blocked by either key (as the backend does).
    expect(isStepRestricted('video-lectures', restricted(['summary_videos']))).toBe(true);
    expect(isStepRestricted('study-notes', restricted(['summary_videos']))).toBe(false);
  });

  it('has a feature for every chapter step and every test type', () => {
    expect(Object.keys(CHAPTER_STEP_FEATURE).sort()).toEqual(CHAPTER_STEPS.map((s) => s.key).sort());
    for (const type of TEST_TYPES as TestTypeKey[]) expect(featuresForPath(`/cbse/tests/${type}/1`)).not.toBeNull();
  });
});
