import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  FilePenLine,
  FileText,
  Gift,
  House,
  LayoutDashboard,
  Library,
  Notebook,
  type LucideIcon,
} from 'lucide-react';
import type { FeatureKeys, RestrictableFeature } from '@/features/feature-access';
import type { ExamCategory, ExamConfig } from './exams';
import { routes, type SectionKey } from './routes';

/**
 * Why an item can be locked (the sidebar shows a padlock and the item can't be opened):
 * - plan: the student has no active plan for the exam
 * - study-plan: the student hasn't built a study plan yet (GET /api/v4/study-plan/classes/{classId}/status)
 */
export type NavLock = 'plan' | 'study-plan';

/** Why an item is locked right now: its own lock, or `institute` (the student's institute switched it off). */
export type NavLockReason = NavLock | 'institute';

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href: (exam: string) => string;
  lock?: NavLock;
  /** Institute-restrictable feature(s) behind the item: locked when all of them are restricted (features/feature-access). */
  feature?: FeatureKeys;
  /** Opens today's live daily practice paper (resolved when clicked); `href` is the fallback. */
  opens?: 'live-dpp';
  /** Shown in the board mobile bottom bar (the raised "Ask" button sits in the middle). */
  mobile?: boolean;
}

/** Sidebar navigation per exam category, matching the previous app's sidebars. */
export const NAVIGATION: Record<ExamCategory, readonly NavItem[]> = {
  board: [
    { key: 'dashboard', label: 'Dashboard', icon: House, href: routes.dashboard, mobile: true },
    {
      key: 'learn',
      label: 'Learn',
      icon: BookOpen,
      href: routes.learn,
      lock: 'plan',
      mobile: true,
      feature: ['video_lectures', 'summary_videos', 'notes', 'quiz', 'unit_test', 'chapter_pyq'],
    },
    {
      key: 'assessments',
      label: 'Assessments',
      icon: ClipboardList,
      href: routes.assessments,
      lock: 'plan',
      mobile: true,
      feature: ['mock_exam', 'pyq_exam', 'custom_exam'],
    },
    { key: 'notes', label: 'Notes', icon: FileText, href: routes.notes, lock: 'plan', mobile: true, feature: ['notes', 'summary_videos'] },
    { key: 'study-plan', label: 'Study Plan', icon: CalendarDays, href: routes.studyPlan, lock: 'study-plan', feature: 'study_plan' },
    // Referring friends isn't premium content, so it's never locked.
    { key: 'refer-and-earn', label: 'Refer & Earn', icon: Gift, href: routes.referAndEarn },
  ],
  competitive: [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: routes.dashboard },
    { key: 'notes', label: 'Notes', icon: FileText, href: routes.notes, feature: 'notes' },
    { key: 'mock-tests', label: 'Mock Tests', icon: ClipboardList, href: routes.mockTests, feature: 'mock_exam' },
    { key: 'pyq-library', label: 'PYQ Library', icon: BookOpen, href: routes.pyqLibrary, feature: 'pyq_exam' },
    {
      key: 'daily-practice',
      label: 'Daily Practice',
      icon: Notebook,
      href: routes.dailyPractice,
      opens: 'live-dpp',
      feature: 'practice_dpp',
    },
    { key: 'refer-and-earn', label: 'Refer & Earn', icon: Gift, href: routes.referAndEarn },
    { key: 'custom-exam', label: 'Custom Exam', icon: FilePenLine, href: routes.customTest, feature: 'custom_exam' },
  ],
  reference: [{ key: 'reference-books', label: 'Reference Books', icon: Library, href: () => routes.referenceBooks() }],
};

export function navigationFor(exam: Pick<ExamConfig, 'category'>): readonly NavItem[] {
  return NAVIGATION[exam.category];
}

/** Section pages each category serves (placeholders until ported), with the page title. */
export const SECTIONS: Record<ExamCategory, Partial<Record<SectionKey, string>>> = {
  board: {
    learn: 'Learn',
    courses: 'Courses',
    assessments: 'Assessments',
    notes: 'Notes',
    'study-plan': 'Study Plan',
    'refer-and-earn': 'Refer & Earn',
    syllabus: 'Syllabus',
    'pyq-trends': 'PYQ Trends',
    'doubt-solver': 'Ask Socrates',
    profile: 'My Profile',
    plans: 'Manage Plans',
  },
  competitive: {
    learn: 'Learn',
    notes: 'Notes',
    'mock-tests': 'Mock Tests',
    'pyq-library': 'PYQ Library',
    'daily-practice': 'Daily Practice',
    'refer-and-earn': 'Refer & Earn',
    'custom-test': 'Custom Exam',
    'doubt-solver': 'Ask Socrates',
    profile: 'My Profile',
    plans: 'My Plans',
  },
  reference: {},
};

/**
 * Sections with their own page folder under app/(student)/[exam]/ (in any route group). They must not be pre-built here too: with both,
 * Next can serve the [section] placeholder instead of the real page (seen on /neet/daily-practice and /cbse/learn).
 * Keep in sync when porting a section ([section]/page.test.ts checks it against the folders).
 */
export const PORTED_SECTIONS = new Set([
  'assessments',
  'courses',
  'custom-test',
  'daily-practice',
  'doubt-solver',
  'learn',
  'mock-tests',
  'notes',
  'plans',
  'profile',
  'pyq-library',
  'pyq-trends',
  'refer-and-earn',
  'study-plan',
  'syllabus',
]);

/** Placeholders for the sections that aren't ported yet (none at the moment; the [section] page stays for new ones). */
export function placeholderSections(category: keyof typeof SECTIONS): string[] {
  return Object.keys(SECTIONS[category]).filter((section) => !PORTED_SECTIONS.has(section));
}

export function sectionTitle(exam: Pick<ExamConfig, 'category'>, section: string): string | null {
  return (SECTIONS[exam.category] as Record<string, string | undefined>)[section] ?? null;
}

export interface NavAccess {
  hasPlan: boolean;
  hasStudyPlan: boolean;
  /** Features the student's institute switched off for this exam (empty while loading or on error). */
  restricted?: readonly RestrictableFeature[];
}

/** Restricted when every feature of the item is (an item without features never is). */
export function isNavRestricted(item: Pick<NavItem, 'feature'>, restricted: readonly RestrictableFeature[] = []): boolean {
  if (!item.feature) return false;
  const features: readonly RestrictableFeature[] = typeof item.feature === 'string' ? [item.feature] : item.feature;
  return features.length > 0 && features.every((feature) => restricted.includes(feature));
}

/** The reason the item is locked, or false. The institute comes first: its dialog says the plan wouldn't help. */
export function isNavLocked(item: Pick<NavItem, 'lock' | 'feature'>, access: NavAccess): NavLockReason | false {
  if (isNavRestricted(item, access.restricted)) return 'institute';
  if (item.lock === 'plan' && !access.hasPlan) return 'plan';
  if (item.lock === 'study-plan' && !access.hasStudyPlan) return 'study-plan';
  return false;
}

/** The current page is the item's page or one below it. */
export function isActivePath(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Competitive learn pages lay out their own padding (/neet/learn/<course>), and chapter pages
 * (/neet/learn/<course>/<module>/<step>) swap the desktop icon rail for the chapter sidebar, as before.
 */
export function competitiveChrome(pathname: string): { rail: boolean; padded: boolean } {
  const match = /^\/[^/]+\/learn\/[^/]+(\/[^/]+)?/.exec(pathname);
  if (!match) return { rail: true, padded: true };
  return { rail: !match[1], padded: false };
}
