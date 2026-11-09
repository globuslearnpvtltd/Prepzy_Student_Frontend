import { examList, findExam, type ExamConfig, type ExamSlug } from '@/shared/config/exams';

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

/** The plan's display name, following the previous app's naming (getPlanName). */
export function planName(plan: ActivePlan, exam: Pick<ExamConfig, 'category'>): string {
  const board = examList.find((e) => e.category === 'board' && plan.relatedExams.includes(e.examId));
  const bundle = board ? ` + ${board.label}` : '';
  if (exam.category !== 'competitive') {
    if (plan.durationMonths === 0) return 'Basic Plan';
    return plan.durationMonths === 1 ? 'Topper Monthly Plan' : 'Topper Academic Year Plan';
  }
  if (plan.durationMonths === 0) return `Basic NEET${bundle} Plan`;
  if (plan.durationMonths === 1) return `Topper NEET${bundle} Monthly Plan`;
  return `Topper NEET${plan.year ? ` ${plan.year}` : ''}${bundle} Plan`;
}

export interface ExamOption {
  examId: number;
  name: string;
  examSlice: string;
  comingSoon: boolean;
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
  console.log('toStudent', raw );
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
    targetExam: (findExam(text(row.target_exam))?.slug as ExamSlug | undefined) ?? null,
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
