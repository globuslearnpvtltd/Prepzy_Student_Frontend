/**
 * Exam registry — the only place that knows which exams exist and how each behaves.
 * Routes, navigation, theme, available tests and API parameters are all read from here,
 * so adding an exam (e.g. JAC or JEE) is a new entry, not new pages.
 */

export type ExamCategory = 'board' | 'competitive' | 'reference';

/** Test types the unified exam engine supports. Labels and behaviour live in test-types.ts. */
export type TestTypeKey = 'mock' | 'pyq' | 'chapter-pyq' | 'custom' | 'mid' | 'final' | 'quiz' | 'dpp' | 'practice';

export interface ExamConfig {
  /** URL segment: /cbse/dashboard */
  slug: string;
  /** Backend key (exam_table.exam_slice). */
  examSlice: string;
  /** Backend id (exam_table.exam_id). */
  examId: number;
  label: string;
  /** Decides the shell (navigation, header links, sidebar) and the dashboard layout. See navigation.ts. */
  category: ExamCategory;
  testTypes: readonly TestTypeKey[];
  /** design.config.ts theme applied to every page of this exam. */
  theme: string;
  /**
   * How sign-up completes for this exam:
   * - choose-class: student picks a class from /api/class-list
   * - choose-target-year: fixed class, student picks a preparation length (target year)
   */
  onboarding: { kind: 'choose-class' } | { kind: 'choose-target-year'; classId: number; boardAddOnLabel?: string };
}

export const EXAMS = {
  cbse: {
    slug: 'cbse',
    examSlice: 'cbse',
    examId: 1,
    label: 'CBSE',
    category: 'board',
    testTypes: ['mock', 'pyq', 'chapter-pyq', 'custom', 'mid', 'final', 'quiz'],
    theme: 'board',
    onboarding: { kind: 'choose-class' },
  },
  neet: {
    slug: 'neet',
    examSlice: 'neet-ug',
    examId: 2,
    label: 'NEET UG',
    category: 'competitive',
    testTypes: ['mock', 'pyq', 'dpp', 'chapter-pyq', 'custom', 'practice'],
    theme: 'competitive',
    onboarding: {
      kind: 'choose-target-year',
      classId: 20,
      boardAddOnLabel: 'Also prepare for CBSE Class 11 & 12 (PCB)',
    },
  },
} as const satisfies Record<string, ExamConfig>;

export type ExamSlug = keyof typeof EXAMS;

export const DEFAULT_EXAM: ExamSlug = 'cbse';

export const examList: readonly ExamConfig[] = Object.values(EXAMS);

/**
 * Reference books are a category without an exam: they live at /reference-books, outside the /[exam] routes,
 * and use the `reference` theme and navigation.
 */
export const REFERENCE = { category: 'reference', theme: 'reference', label: 'Reference Books' } as const satisfies {
  category: ExamCategory;
  theme: string;
  label: string;
};

export function isExamSlug(value: string | undefined | null): value is ExamSlug {
  return !!value && Object.hasOwn(EXAMS, value);
}

export function getExam(slug: string | undefined | null): ExamConfig | null {
  return isExamSlug(slug) ? EXAMS[slug] : null;
}

/** Finds an exam from any backend representation: slice ('neet-ug'), name ('NEET-UG', 'CBSE') or id. */
export function findExam(value: string | number | null | undefined): ExamConfig | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return examList.find((exam) => exam.examId === value) ?? null;
  const key = value.toLowerCase();
  return examList.find((exam) => exam.slug === key || exam.examSlice === key) ?? null;
}

export function hasTestType(exam: ExamConfig, testType: string): testType is TestTypeKey {
  return (exam.testTypes as readonly string[]).includes(testType);
}
