import { notFound } from 'next/navigation';
import { getExam, type ExamCategory, type ExamConfig } from '@/shared/config/exams';

/** Hub pages exist for one exam category (e.g. Mock Tests for competitive exams); other exams get a 404. */
export function examForCategory(slug: string, category: ExamCategory): ExamConfig {
  const exam = getExam(slug);
  if (!exam || exam.category !== category) notFound();
  return exam;
}
