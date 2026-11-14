import { dashboardApiBase, type ExamRef } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { apiClient } from '@/shared/lib/api-client';
import { unwrapData } from '@/shared/lib/unwrap';

/** syllabus_trends_table.type: the class syllabus, or the PYQ trend analysis. */
export type SyllabusKind = 'syllabus' | 'trend';

export const SYLLABUS_KINDS: readonly SyllabusKind[] = ['syllabus', 'trend'];

/** Copy and page per kind (the previous app's SyllabusModal / TrendsModal and /syllabus, /trend-analysis pages). */
export const SYLLABUS_COPY: Record<
  SyllabusKind,
  { label: string; pickerTitle: string; kicker: string; empty: string; href: (exam: string, subjectId?: string) => string }
> = {
  syllabus: {
    label: 'Syllabus',
    pickerTitle: 'Syllabus',
    kicker: 'Syllabus Analysis',
    empty: 'No syllabus analysis found.',
    href: routes.syllabus,
  },
  trend: {
    label: 'PYQ Trends',
    pickerTitle: 'Trends',
    kicker: 'Trend Analysis',
    empty: 'No trend analysis found.',
    href: routes.pyqTrends,
  },
};

export interface SyllabusSubject {
  id: string;
  name: string;
}

export interface SyllabusPdf {
  kind: SyllabusKind;
  subjectId: string;
  subjectName: string;
  className: string;
  url: string;
}

/** Class 9–12 see the syllabus card, classes 10 and 12 also PYQ trends (previous app's rule). */
export function syllabusCards(className: string | null | undefined): { syllabus: boolean; trends: boolean } {
  const grade = Number(/\d+/.exec(className ?? '')?.[0]);
  return { syllabus: [9, 10, 11, 12].includes(grade), trends: [10, 12].includes(grade) };
}

/** Only absolute http(s) URLs are shown or linked (the backend checks this too). */
export function safePdfUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const base = (exam: ExamRef, classId: number, kind: SyllabusKind) =>
  `${dashboardApiBase(exam)}/classes/${classId}/syllabus-trends/${kind}/subjects`;

export const syllabusApi = {
  /** Subjects of the class that have a PDF of this kind (the subject picker). */
  async subjects(exam: ExamRef, classId: number, kind: SyllabusKind): Promise<SyllabusSubject[]> {
    type Raw = { subject_id: number | string; subject_name?: string | null };
    const data = unwrapData(await apiClient.get<{ data?: { subjects?: Raw[] } }>(base(exam, classId, kind)));
    return (data.subjects ?? []).map((s) => ({ id: String(s.subject_id), name: s.subject_name ?? '' }));
  },

  /** One subject's PDF. Throws (404 SYLLABUS_NOT_FOUND) when there is none. */
  async pdf(exam: ExamRef, classId: number, kind: SyllabusKind, subjectId: string): Promise<SyllabusPdf> {
    type Raw = { subject_name?: string | null; class_name?: string | null; pdf_url?: unknown };
    const data = unwrapData(
      await apiClient.get<{ data?: Raw }>(`${base(exam, classId, kind)}/${encodeURIComponent(subjectId)}`),
    );
    const url = safePdfUrl(data.pdf_url);
    if (!url) throw new Error('The PDF link is not valid.');
    return { kind, subjectId, subjectName: data.subject_name ?? '', className: data.class_name ?? '', url };
  },
};
