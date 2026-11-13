import { findExam, type ExamConfig, type ExamSlug } from '@/shared/config/exams';
import { composePlanName } from '@/shared/lib/plan-name';

/** Normalised student, independent of the backend's field names. */
export interface Student {
  accountId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string;
  profilePicture: string | null;
  classId: number | null;
  classTitle: string | null;
  userType: string | null;
  gender: 'male' | 'female' | null;
  /** Exam the student is enrolled in, when the backend tells us. */
  targetExam: ExamSlug | null;
  /** Content medium (languages row): every subject / course / paper list follows it. Null when unknown. */
  language: StudentLanguage | null;
}

/** A content medium as the backend names it (`languages.language_name`, e.g. "hindi"). */
export interface StudentLanguage {
  id: number;
  name: string;
}

/** The `{ id, name }` the backend sends for a language, or null. */
export function toStudentLanguage(raw: unknown): StudentLanguage | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? Number(row.id) : row.id;
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  return typeof id === 'number' && Number.isInteger(id) && id > 0 && name ? { id, name } : null;
}

export interface PurchasedExam {
  examId: number;
  examSlice: string;
  name: string;
}

export interface ActivePlan {
  planId: number;
  examId: number | null;
  classId: number;
  className: string;
  streamName: string;
  durationMonths: number;
  expiryDate: string | null;
  status: string;
  /** Exam ids bundled with the plan (e.g. NEET + CBSE). */
  relatedExams: number[];
  /** NEET target year, when the plan has one. */
  year: number | null;
}

/** "Basic" (free, duration 0) or "Topper" (paid). */
export function planTier(plan: Pick<ActivePlan, 'durationMonths'>): 'Basic' | 'Topper' {
  return plan.durationMonths === 0 ? 'Basic' : 'Topper';
}

/**
 * The plan's name by the server's rule (see composePlanName), for screens that only have the active plan. Prefer the
 * API's `display_name` (purchases) when it is at hand. The exam and bundle names come from the backend exam list.
 */
export function planName(
  plan: ActivePlan,
  exam: Pick<ExamConfig, 'category' | 'examId'>,
  /** Exams from the backend catalog (GET /api/v4/exams): names the exam and the exams bundled with a plan. */
  catalog: readonly { examId: number; name: string; category: string }[] = [],
): string {
  return composePlanName({
    durationMonths: plan.durationMonths,
    exam: catalog.find((e) => e.examId === exam.examId)?.name,
    groupKey: exam.category === 'competitive' ? 'target_year' : 'class',
    targetYear: plan.year,
    bundles: catalog.filter((e) => e.examId !== exam.examId && plan.relatedExams.includes(e.examId)).map((e) => e.name),
  });
}

export interface ExamOption {
  examId: number;
  name: string;
  examSlice: string;
  /** Active in the backend but the app has no pages for it yet (not in the exam registry). */
  comingSoon: boolean;
}

/** A preparation length a target-year exam offers at sign-up (from the exam's active plans). */
export interface PlanLengthOption {
  planLength: number;
  /** Exam year it targets; null when the backend has no exam date. */
  targetYear: number | null;
  /** Class the free plan is granted for (sent as class_id). */
  classId: number;
  /** A combo plan exists for this length (with_bundle may be true). */
  hasBundle: boolean;
  /** Names of the exams the combo adds, e.g. ["CBSE"]. */
  bundleTitles: string[];
}

/** What sign-up asks for: a class, or a target year (plan length). Decided by the backend per exam category. */
export interface OnboardingOptions {
  choose: 'class' | 'target_year';
  planLengths: PlanLengthOption[];
}

export interface ClassOption {
  classId: number;
  title: string;
  streamName: string;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const number = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** Maps the backend account row (login, onboarding or /api/accounts) to a Student. */
export function toStudent(raw: unknown): Student {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const accountId = number(row.account_id);
  if (accountId === null) throw new Error('Account response has no account_id');
  const firstName = text(row.first_name) ?? '';
  const lastName = text(row.last_name) ?? '';
  return {
    accountId,
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' ') || 'Student',
    email: text(row.email),
    phone: text(row.phone) ?? '',
    profilePicture: text(row.profile_picture),
    classId: number(row.class),
    classTitle: text(row.class_title),
    userType: text(row.user_type),
    gender: row.gender === 'male' || row.gender === 'female' ? row.gender : null,
    // exam_slice ('jac') identifies any exam; the name ('NEET-UG', 'CBSE') is the fallback for older responses.
    targetExam: ((findExam(text(row.target_exam_slice)) ?? findExam(text(row.target_exam)))?.slug as ExamSlug | undefined) ?? null,
    language: toStudentLanguage(row.language),
  };
}

/** Indian numbers by default: "98765 43210" → "+919876543210". Numbers starting with + are kept. */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+91${digits}`;
}

export const isValidPhone = (phone: string) =>
  phone.startsWith('+91') ? /^\+91[6-9]\d{9}$/.test(phone) : /^\+\d{10,15}$/.test(phone);
