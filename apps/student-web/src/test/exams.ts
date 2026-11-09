import { getExam, type ExamConfig } from '@/shared/config/exams';
import { EXAM_CATALOG } from './server';

/**
 * The exam a page would get in the app: its design from the registry plus the exam_id from the
 * (mock) backend catalog, GET /api/v4/exams. Tests use this instead of hard-coded ids.
 */
export function testExam(slug: 'cbse' | 'neet'): ExamConfig {
  const design = getExam(slug);
  const fromBackend = EXAM_CATALOG.find((e) => e.exam_slice === design?.examSlice);
  if (!design || !fromBackend) throw new Error(`No test exam '${slug}'`);
  return { ...design, examId: fromBackend.exam_id };
}
