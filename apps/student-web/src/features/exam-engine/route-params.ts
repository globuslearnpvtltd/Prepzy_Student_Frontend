import { getExam, type TestTypeKey } from '@/shared/config/exams';
import { availableTestTypes } from './adapters';
import { isTestTypeKey } from './test-types';

/** Validates /[exam]/tests/[testType] params on the server; null means 404. */
export function resolveTestType(examSlug: string, testType: string): TestTypeKey | null {
  const exam = getExam(examSlug);
  if (!exam || !isTestTypeKey(testType)) return null;
  return availableTestTypes(exam).includes(testType) ? testType : null;
}
