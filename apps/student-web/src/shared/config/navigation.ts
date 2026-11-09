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
import type { ExamCategory, ExamConfig } from './exams';
import { routes, type SectionKey } from './routes';

/**
 * Why an item can be locked (the sidebar shows a padlock and the item can't be opened):
 * - plan: the student has no active plan for the exam
 * - study-plan: the student hasn't built a study plan yet (GET /api/v1/study-plan/status/{classId})
 */
export type NavLock = 'plan' | 'study-plan';

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href: (exam: string) => string;
  lock?: NavLock;
  /** Opens today's live daily practice paper (resolved when clicked); `href` is the fallback. */
  opens?: 'live-dpp';
  /** Shown in the board mobile bottom bar (the raised "Ask" button sits in the middle). */
  mobile?: boolean;
}

/** Sidebar navigation per exam category, matching the previous app's sidebars. */
export const NAVIGATION: Record<ExamCategory, readonly NavItem[]> = {
  board: [
    { key: 'dashboard', label: 'Dashboard', icon: House, href: routes.dashboard, mobile: true },
    { key: 'learn', label: 'Learn', icon: BookOpen, href: routes.learn, lock: 'plan', mobile: true },
    { key: 'assessments', label: 'Assessments', icon: ClipboardList, href: routes.assessments, lock: 'plan', mobile: true },
    { key: 'notes', label: 'Notes', icon: FileText, href: routes.notes, lock: 'plan', mobile: true },
    { key: 'study-plan', label: 'Study Plan', icon: CalendarDays, href: routes.studyPlan, lock: 'study-plan' },
    // Referring friends isn't premium content, so it's never locked.
    { key: 'refer-and-earn', label: 'Refer & Earn', icon: Gift, href: routes.referAndEarn },
  ],
  competitive: [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: routes.dashboard },
    { key: 'notes', label: 'Notes', icon: FileText, href: routes.notes },
    { key: 'mock-tests', label: 'Mock Tests', icon: ClipboardList, href: routes.mockTests },
    { key: 'pyq-library', label: 'PYQ Library', icon: BookOpen, href: routes.pyqLibrary },
    { key: 'daily-practice', label: 'Daily Practice', icon: Notebook, href: routes.dailyPractice, opens: 'live-dpp' },
    { key: 'refer-and-earn', label: 'Refer & Earn', icon: Gift, href: routes.referAndEarn },
    { key: 'custom-exam', label: 'Custom Exam', icon: FilePenLine, href: routes.customTest },
  ],
  reference: [{ key: 'reference-books', label: 'Reference Books', icon: Library, href: () => routes.referenceBooks() }],
};

export function navigationFor(exam: Pick<ExamConfig, 'category'>): readonly NavItem[] {
  return NAVIGATION[exam.category];
}

/** Text links in the desktop header. */
export const HEADER_LINKS: Record<ExamCategory, readonly { label: string; href: (exam: string) => string }[]> = {
  board: [
    { label: 'Dashboard', href: routes.dashboard },
    { label: 'Courses', href: routes.courses },
  ],
  competitive: [{ label: 'Dashboard', href: routes.dashboard }],
  reference: [{ label: 'Reference Books', href: () => routes.referenceBooks() }],
};

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

export function sectionTitle(exam: Pick<ExamConfig, 'category'>, section: string): string | null {
  return (SECTIONS[exam.category] as Record<string, string | undefined>)[section] ?? null;
}

export interface NavAccess {
  hasPlan: boolean;
  hasStudyPlan: boolean;
}

export function isNavLocked(item: Pick<NavItem, 'lock'>, access: NavAccess): boolean {
  if (item.lock === 'plan') return !access.hasPlan;
  if (item.lock === 'study-plan') return !access.hasStudyPlan;
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
