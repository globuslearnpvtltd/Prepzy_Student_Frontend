import { notFound } from 'next/navigation';
import { resolveExam } from '@/shared/config/exam-resolver';
import type { ExamCategory, ExamDesign } from '@/shared/config/exams';

/** Hub pages exist for one exam category (e.g. Mock Tests for competitive exams); other exams get a 404. */
export async function examForCategory(slug: string, category: ExamCategory): Promise<ExamDesign> {
  const exam = await resolveExam(slug);
  if (!exam || exam.category !== category) notFound();
  return exam;
}
