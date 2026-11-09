import type { ExamCategory, ExamConfig, TestTypeKey } from '@/shared/config/exams';
import { createBoardAdapter } from './board';
import { createDppAdapter, createPracticeAdapter, createSessionAdapter } from './competitive';
import type { TestAdapter } from './types';

/**
 * Which backend endpoints serve each test type, per exam category.
 * Adding a test type to an exam = one entry here + the key in the exam registry.
 */
const ADAPTERS: Partial<Record<ExamCategory, Partial<Record<TestTypeKey, TestAdapter>>>> = {
  board: {
    mock: createBoardAdapter({
      label: 'Mock test',
      fetch: '/api/v1/exams/mock-exam/fetch-mock-questions',
      save: '/api/mock-exams/update-mock-session-questions',
      submit: '/api/v1/exams/mock-exam/submit-exam',
      result: '/api/v1/exams/mock-exam/fetch-mock-responses',
      sets: '/api/mock-exams/fetch-mock-sets',
      subjectKey: 'mock_result',
    }),
    pyq: createBoardAdapter({
      label: 'Previous year paper',
      fetch: '/api/v1/exams/pyq-exam/fetch-pyq-questions',
      save: '/api/pyq-exams/update-pyq-session-questions',
      submit: '/api/v1/exams/pyq-exam/submit-exam',
      result: '/api/pyq-exams/fetch-pyq-responses',
      sets: '/api/pyq-exams/fetch-pyq-sets',
      subjectKey: 'pyq_result',
    }),
    // Opened from Learn by set id; no student-level list.
    'chapter-pyq': createBoardAdapter({
      label: 'Chapter PYQ',
      fetch: '/api/v1/exams/chapter-pyqs/fetch-chapter-pyqs-questions',
      save: '/api/v1/exams/chapter-pyqs/update-chapter-pyqs-session-questions',
      submit: '/api/v1/exams/chapter-pyqs/submit-exam',
      result: '/api/v1/exams/chapter-pyqs/fetch-chapter-pyqs-responses',
    }),
    custom: createBoardAdapter({
      label: 'Custom test',
      fetch: '/api/v1/exams/custom-exam/fetch-custom-exam',
      save: '/api/custom-exams/update-custom-exam-session-questions',
      submit: '/api/v1/exams/custom-exam/submit-exam',
      result: '/api/v1/exams/custom-exam/fetch-custom-exam-responses',
    }),
    mid: createBoardAdapter({
      label: 'Mid-term test',
      fetch: '/api/v1/exams/mid-exam/fetch-mid-questions',
      save: '/api/mid-exams/update-mid-session-questions',
      submit: '/api/v1/exams/mid-exam/submit-exam',
      result: '/api/v1/exams/mid-exam/fetch-mid-responses',
    }),
    final: createBoardAdapter({
      label: 'Final test',
      fetch: '/api/v1/exams/final-exam/fetch-final-questions',
      save: '/api/final-exams/update-final-session-questions',
      submit: '/api/v1/exams/final-exam/submit-exam',
      result: '/api/v1/exams/final-exam/fetch-final-responses',
    }),
    quiz: createBoardAdapter({
      label: 'Quiz',
      fetch: '/api/v1/exams/quiz/fetch-quiz-questions',
      save: '/api/quiz-exams/update-quiz-session-questions',
      submit: '/api/v1/exams/quiz/submit-exam',
      result: '/api/quiz-exams/fetch-quiz-responses',
    }),
  },
  competitive: {
    mock: createSessionAdapter({
      label: 'Mock test',
      start: '/api/neet/mock-exam/start-mock-exam',
      save: '/api/neet/mock-exam/update-mock-session-questions',
      submit: '/api/neet/mock-exam/submit-mock-exam',
      result: '/api/neet/mock-exam/get-mock-result',
      list: '/api/neet/mock-exam/fetch-mock-exams',
      listKey: 'mockExams',
    }),
    pyq: createSessionAdapter({
      label: 'Previous year paper',
      start: '/api/neet/pyq-exam/start-pyq-exam',
      save: '/api/neet/pyq-exam/update-pyq-session-questions',
      submit: '/api/neet/pyq-exam/submit-pyq-exam',
      result: '/api/neet/pyq-exam/get-pyq-result',
      list: '/api/neet/pyq-exam/fetch-pyq-exams',
      listKey: 'pyqExams',
    }),
    dpp: createDppAdapter(),
    // Keyed by the chapter's module id.
    'chapter-pyq': createSessionAdapter({
      label: 'Chapter PYQ',
      idKey: 'module_id',
      start: '/api/neet/chapter-pyq-exam/start-chapter-pyq-exam',
      save: '/api/neet/chapter-pyq-exam/update-chapter-pyq-session-questions',
      submit: '/api/neet/chapter-pyq-exam/submit-chapter-pyq-exam',
      result: '/api/neet/chapter-pyq-exam/get-chapter-pyq-result',
    }),
    custom: createSessionAdapter({
      label: 'Custom test',
      start: '/api/neet/custom-exam/start-custom-exam',
      save: '/api/neet/custom-exam/update-custom-session-questions',
      submit: '/api/neet/custom-exam/submit-custom-exam',
      result: '/api/neet/custom-exam/get-custom-result',
    }),
    // Keyed by the chapter assessment id.
    practice: createPracticeAdapter(),
  },
};

export function getTestAdapter(exam: ExamConfig, testType: TestTypeKey): TestAdapter | null {
  return ADAPTERS[exam.category]?.[testType] ?? null;
}

/** Test types the exam offers and the engine can run. */
export function availableTestTypes(exam: ExamConfig): TestTypeKey[] {
  return exam.testTypes.filter((type) => getTestAdapter(exam, type) !== null);
}

/** Test types with a paper list of their own (the rest open from Learn or another hub by id). */
export function listableTestTypes(exam: ExamConfig): TestTypeKey[] {
  return availableTestTypes(exam).filter((type) => !!getTestAdapter(exam, type)?.listSets);
}

export type { TestAdapter } from './types';
