import { resolveExam } from '@/shared/config/exam-resolver';
import type { TestTypeKey } from '@/shared/config/exams';
import { availableTestTypes } from './adapters';
import { isTestTypeKey } from './test-types';

/** Validates /[exam]/tests/[testType] params on the server; null means 404. */
export async function resolveTestType(examSlug: string, testType: string): Promise<TestTypeKey | null> {
  const exam = await resolveExam(examSlug);
  if (!exam || !isTestTypeKey(testType)) return null;
  return availableTestTypes(exam).includes(testType) ? testType : null;
}
