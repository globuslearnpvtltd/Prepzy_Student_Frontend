import type { TestTypeKey } from './exams';

/**
 * Exam-scoped pages that aren't ported yet. Until a real page exists, /[exam]/<section> renders the shared
 * "being moved" placeholder, so no link in the shell 404s. The keys are the previous app's URL segments.
 */
export const SECTION_KEYS = [
  'learn',
  'courses',
  'assessments',
  'notes',
  'study-plan',
  'refer-and-earn',
  'mock-tests',
  'pyq-library',
  'daily-practice',
  'custom-test',
  'syllabus',
  'pyq-trends',
  'doubt-solver',
  'profile',
  'plans',
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

const section = (key: SectionKey) => (exam: string) => `/${exam}/${key}`;

/** Every URL in the app is built here, so pages never hand-write paths. */
export const routes = {
  login: () => '/login',
  getStarted: () => '/get-started',
  verifyOtp: (flow: 'login' | 'signup') => `/verify-otp?flow=${flow}`,
  examSelection: () => '/exam-selection',
  setup: () => '/setup',
  /** Post-signup screen: free Topper month, coupon / referral code, usage limits. */
  welcome: (exam: string) => `/welcome?exam=${exam}`,

  dashboard: (exam: string) => `/${exam}/dashboard`,
  tests: (exam: string) => `/${exam}/tests`,
  testList: (exam: string, testType: TestTypeKey) => `/${exam}/tests/${testType}`,
  testPlayer: (exam: string, testType: TestTypeKey, setId: string | number) => `/${exam}/tests/${testType}/${setId}`,
  testResult: (exam: string, testType: TestTypeKey, attemptId: string | number) =>
    `/${exam}/tests/${testType}/result/${attemptId}`,

  // Section pages keep the previous app's URLs, so bookmarks and shared links keep working.
  learn: section('learn'),
  /** A course's chapter list (board and competitive). */
  learnCourse: (exam: string, courseId: string | number) => `/${exam}/learn/${courseId}`,
  /** One step of a chapter (competitive: video-lectures, study-notes, practice-questions, chapter-pyq). */
  learnModule: (exam: string, courseId: string | number, moduleId: string | number, step: string) =>
    `/${exam}/learn/${courseId}/${moduleId}/${step}`,
  /** Board chapter page (lectures, summary notes / video, practice). */
  boardModule: (exam: string, courseId: string | number, moduleId: string | number, tab?: 'learn' | 'practice') =>
    `/${exam}/learn/${courseId}/${moduleId}${tab ? `?tab=${tab}` : ''}`,
  lecture: (exam: string, courseId: string | number, moduleId: string | number, lectureId: string | number) =>
    `/${exam}/learn/${courseId}/${moduleId}/lecture/${lectureId}`,
  chapterPyqs: (exam: string, courseId: string | number, moduleId: string | number) =>
    `/${exam}/learn/${courseId}/${moduleId}/pyqs`,
  ncertQuestions: (exam: string, courseId: string | number, moduleId: string | number) =>
    `/${exam}/learn/${courseId}/${moduleId}/ncert-questions`,
  courseDetail: (exam: string, courseId: string | number) => `/${exam}/courses/${courseId}`,
  notesView: (exam: string, courseId: string | number, moduleId?: string | number) =>
    `/${exam}/notes/${courseId}${moduleId ? `?module_id=${moduleId}` : ''}`,
  summaryVideo: (exam: string, noteId: string | number) => `/${exam}/notes/video/${noteId}`,
  courses: section('courses'),
  assessments: section('assessments'),
  notes: section('notes'),
  studyPlan: section('study-plan'),
  studyPlanChapters: (exam: string) => `/${exam}/study-plan/chapters`,
  studyPlanCreate: (exam: string) => `/${exam}/study-plan/create`,
  diagnostic: (exam: string) => `/${exam}/diagnostic`,
  diagnosticTest: (exam: string, assessmentId: string | number) => `/${exam}/diagnostic-test/${assessmentId}`,
  diagnosticResult: (exam: string, assessmentId?: string | number) =>
    `/${exam}/diagnostic-result${assessmentId ? `?assessment_id=${assessmentId}` : ''}`,
  referAndEarn: section('refer-and-earn'),
  mockTests: section('mock-tests'),
  pyqLibrary: section('pyq-library'),
  dailyPractice: section('daily-practice'),
  customTest: section('custom-test'),
  customTestCreate: (exam: string) => `/${exam}/custom-test/create`,
  // Board paper lists per subject (previous app's mock-sets / pyq-sets URLs).
  mockSets: (exam: string, subjectId: string | number) => `/${exam}/mock-sets/${subjectId}`,
  pyqSets: (exam: string, subjectId: string | number) => `/${exam}/pyq-sets/${subjectId}`,
  syllabus: section('syllabus'),
  pyqTrends: section('pyq-trends'),
  doubtSolver: section('doubt-solver'),
  /** Ask Socrates: one step of the solver (start options, ask, question bank, the solving chat). */
  doubtSolverStep: (exam: string, step: 'start' | 'ask' | 'question-bank' | 'chat') => `/${exam}/doubt-solver?step=${step}`,
  /** Dashboard with the Atlas chat open (previous app's `?atlas=1`). */
  atlas: (exam: string) => `/${exam}/dashboard?atlas=1`,
  profile: section('profile'),
  changePassword: (exam: string) => `/${exam}/profile/change-password`,
  requestAccountDelete: (exam: string) => `/${exam}/profile/request-account-delete`,
  plans: section('plans'),
  /** Checkout. `query` keeps the previous app's preselection params (CLASSID, stream_id, exam). */
  plansPurchase: (exam: string, query?: Record<string, string | number>) =>
    `/${exam}/plans/purchase${query ? `?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}` : ''}`,
  plansBilling: (exam: string) => `/${exam}/plans/billing`,

  referenceBooks: () => '/reference-books',
} as const;

export function isSectionKey(value: string): value is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(value);
}

/** Pages reachable without a session. */
export const PUBLIC_PATHS = ['/login', '/get-started', '/verify-otp', '/exam-selection', '/setup'] as const;

export const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
