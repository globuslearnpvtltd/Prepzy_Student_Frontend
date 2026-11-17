/**
 * Exams. Which exams exist comes from the backend (GET /api/v4/exams: the active rows of exam_table); how an exam
 * behaves comes from its category (CATEGORY_DEFAULTS). The registry below (EXAMS) is optional per-exam polish: a
 * short URL (/neet instead of /neet-ug), a label, a tagline, sign-up wording. An exam without an entry still works:
 * its URL is its exam_slice and its label is exam_name (examDesignFor). Adding an exam needs only DB rows.
 */

export type ExamCategory = 'board' | 'competitive' | 'reference';

/** Test types the unified exam engine supports. Labels and behaviour live in test-types.ts. */
export type TestTypeKey = 'mock' | 'pyq' | 'chapter-pyq' | 'custom' | 'mid' | 'final' | 'quiz' | 'dpp' | 'practice';

/**
 * Design and behaviour of an exam's pages. Its id is not here: pages get the backend's exam_id
 * (GET /api/v4/exams, matched by examSlice) through ExamFrame / useExam.
 */
export interface ExamDesign {
  /** URL segment: /cbse/dashboard */
  slug: string;
  /** Backend key (exam_table.exam_slice). */
  examSlice: string;
  label: string;
  /** One line under the exam on the sign-up exam picker. */
  tagline?: string;
  /** Decides the shell (navigation, header links, sidebar) and the dashboard layout. See navigation.ts. */
  category: ExamCategory;
  testTypes: readonly TestTypeKey[];
  /** design.config.ts theme applied to every page of this exam. */
  theme: string;
  /**
   * How sign-up completes for this exam:
   * - choose-class: student picks a class from GET /api/v4/learn/:category/:examId/classes
   * - choose-target-year: student picks a preparation length (target year); the class comes from the plan lengths
   *   (GET …/onboarding-options). `classId` is the exam's class for test pages while the plan is loading (optional).
   *   `bundleDetail` describes what the combo adds on the "What are you preparing for?" card (optional; else the
   *   bundled exams' names).
   */
  onboarding: { kind: 'choose-class' } | { kind: 'choose-target-year'; classId?: number; bundleDetail?: string };
}

/** An exam page's exam: its design plus the backend's exam_id (provided by ExamFrame via useExam). */
export type ExamConfig = ExamDesign & {
  /** Backend id (exam_table.exam_id), from GET /api/v4/exams. */
  examId: number;
};

export const EXAMS = {
  cbse: {
    slug: 'cbse',
    examSlice: 'cbse',
    label: 'CBSE',
    tagline: 'Class 6 to 12',
    category: 'board',
    testTypes: ['mock', 'pyq', 'chapter-pyq', 'custom', 'mid', 'final', 'quiz'],
    theme: 'board',
    onboarding: { kind: 'choose-class' },
  },
  // Jharkhand Academic Council: a board exam with the same structure, dashboard and design as CBSE.
  jac: {
    slug: 'jac',
    examSlice: 'jac',
    label: 'Jharkhand Board',
    tagline: 'Class 6 to 12',
    category: 'board',
    testTypes: ['mock', 'pyq', 'chapter-pyq', 'custom', 'mid', 'final', 'quiz'],
    theme: 'board',
    onboarding: { kind: 'choose-class' },
  },
  neet: {
    slug: 'neet',
    examSlice: 'neet-ug',
    label: 'NEET UG',
    tagline: 'Physics, Chemistry, Botany, Zoology',
    category: 'competitive',
    testTypes: ['mock', 'pyq', 'dpp', 'chapter-pyq', 'custom', 'practice'],
    theme: 'competitive',
    onboarding: {
      kind: 'choose-target-year',
      classId: 20,
      bundleDetail: 'CBSE Class 11 and 12 (PCB)',
    },
  },
} as const satisfies Record<string, ExamDesign>;

/** An exam's URL segment: a registry slug (e.g. 'neet') or, for an exam without an entry, its exam_slice. */
export type ExamSlug = string;

/** A slug of the static registry. */
export type RegistrySlug = keyof typeof EXAMS;

export const DEFAULT_EXAM: RegistrySlug = 'cbse';

/** The registry's exams only (legacy redirects and static params); every exam comes from the backend catalog. */
export const examList: readonly ExamDesign[] = Object.values(EXAMS);

/** Categories that have exam pages (reference books live outside /[exam]). */
export type PageCategory = Exclude<ExamCategory, 'reference'>;
export const isPageCategory = (category: string): category is PageCategory =>
  category === 'board' || category === 'competitive';

/** How an exam of each category behaves when the registry has no entry for it. */
export const CATEGORY_DEFAULTS: Record<PageCategory, Pick<ExamDesign, 'testTypes' | 'theme' | 'onboarding'>> = {
  board: {
    testTypes: ['mock', 'pyq', 'chapter-pyq', 'custom', 'mid', 'final', 'quiz'],
    theme: 'board',
    onboarding: { kind: 'choose-class' },
  },
  competitive: {
    testTypes: ['mock', 'pyq', 'dpp', 'chapter-pyq', 'custom', 'practice'],
    theme: 'competitive',
    onboarding: { kind: 'choose-target-year' },
  },
};

/** What GET /api/v4/exams says about an exam (the catalog row). */
export interface CatalogEntry {
  examId: number;
  name: string;
  examSlice: string;
  category: ExamCategory;
}

const URL_SAFE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * The design of a backend exam: its registry entry (matched by exam_slice, same category), else its category's
 * defaults with slug = exam_slice and label = exam_name. Null for reference exams, a registry entry of another
 * category, or a slice that can't be a URL segment / would collide with a registry slug.
 */
export function examDesignFor(entry: Pick<CatalogEntry, 'name' | 'examSlice' | 'category'>): ExamDesign | null {
  const slice = entry.examSlice.trim().toLowerCase();
  const known = examList.find((exam) => exam.examSlice === slice);
  if (known) return known.category === entry.category ? known : null;
  if (!isPageCategory(entry.category) || !URL_SAFE.test(slice) || isExamSlug(slice)) return null;
  return { slug: slice, examSlice: entry.examSlice, label: entry.name, category: entry.category, ...CATEGORY_DEFAULTS[entry.category] };
}

/** Every catalog exam that has pages, with its design and exam_id. */
export function catalogExams(catalog: readonly CatalogEntry[] | null | undefined): ExamConfig[] {
  return (catalog ?? []).flatMap((entry) => {
    const design = examDesignFor(entry);
    return design ? [{ ...design, examId: entry.examId }] : [];
  });
}

/**
 * Finds a catalog exam from any representation: its URL slug ('neet'), exam_slice ('neet-ug'), name ('NEET-UG')
 * or id ('2'). Null when the catalog has no such exam with pages.
 */
export function examFromCatalog(
  catalog: readonly CatalogEntry[] | null | undefined,
  value: string | number | null | undefined,
): ExamConfig | null {
  if (value === null || value === undefined || value === '') return null;
  const key = String(value).trim().toLowerCase();
  const registry = findExam(key);
  for (const entry of catalog ?? []) {
    const design = examDesignFor(entry);
    if (!design) continue;
    const slice = entry.examSlice.trim().toLowerCase();
    if (
      design.slug === key ||
      slice === key ||
      entry.name.trim().toLowerCase() === key ||
      String(entry.examId) === key ||
      registry?.examSlice === slice
    ) {
      return { ...design, examId: entry.examId };
    }
  }
  return null;
}

/**
 * A URL segment for any exam value without the catalog: the registry slug when the value names a registry exam,
 * else the value itself when it is URL-safe (a backend exam_slice). Null otherwise.
 */
export function examSlugOf(value: string | null | undefined): ExamSlug | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return findExam(key)?.slug ?? (URL_SAFE.test(key) ? key : null);
}

/**
 * Reference books are a category without an exam: they live at /reference-books, outside the /[exam] routes,
 * and use the `reference` theme and navigation.
 */
export const REFERENCE = { category: 'reference', theme: 'reference', label: 'Reference Books' } as const satisfies {
  category: ExamCategory;
  theme: string;
  label: string;
};

export function isExamSlug(value: string | undefined | null): value is RegistrySlug {
  return !!value && Object.hasOwn(EXAMS, value);
}

/** The registry entry of a slug (registry exams only; see examFromCatalog / resolveExam for every exam). */
export function getExam(slug: string | undefined | null): ExamDesign | null {
  return isExamSlug(slug) ? EXAMS[slug] : null;
}

/** Finds a registry exam from its slug or slice ('neet' / 'neet-ug'). Registry exams only. */
export function findExam(value: string | null | undefined): ExamDesign | null {
  if (value === null || value === undefined || value === '') return null;
  const key = value.toLowerCase();
  return examList.find((exam) => exam.slug === key || exam.examSlice === key) ?? null;
}

export function hasTestType(exam: ExamDesign, testType: string): testType is TestTypeKey {
  return (exam.testTypes as readonly string[]).includes(testType);
}

/** What a backend URL needs to know about an exam: its category and its backend exam_id. */
export type ExamRef = Pick<ExamConfig, 'category' | 'examId'>;

/** v4 dashboard base for an exam: one set of routes per category, the exam picked by its id. */
export const dashboardApiBase = (exam: ExamRef): string => `/api/v4/dashboard/${exam.category}/${exam.examId}`;

/** v4 learn routes of an exam (classes, textbooks, competitive chapters …): same shape as dashboardApiBase. */
export const learnApiBase = (exam: ExamRef): string => `/api/v4/learn/${exam.category}/${exam.examId}`;

/**
 * v4 test-library routes of an exam: `${assessmentsApiBase(exam)}/<testType>/sets` (subjects, attempts, best-score,
 * months, live …). Same shape as dashboardApiBase.
 */
export const assessmentsApiBase = (exam: ExamRef): string => `/api/v4/assessments/${exam.category}/${exam.examId}`;

/** v4 learn routes that don't depend on the exam (courses, chapters and lectures by id). */
export const LEARN_API = '/api/v4/learn';
