import type { ExamCategory, ExamConfig, ExamDesign, TestTypeKey } from '@/shared/config/exams';
import { createBoardAdapter } from './board';
import { createCompetitiveAdapter, createDppAdapter } from './competitive';
import type { TestAdapter } from './types';

/**
 * Which backend endpoints serve each test type, per exam category.
 * Adding a test type to an exam = one entry here + the key in the exam registry.
 */
const ADAPTERS: Partial<Record<ExamCategory, Partial<Record<TestTypeKey, TestAdapter>>>> = {
  board: {
    mock: createBoardAdapter({ label: 'Mock test', testType: 'mock', listType: 'mock' }),
    pyq: createBoardAdapter({ label: 'Previous year paper', testType: 'pyq', listType: 'pyq' }),
    // Opened from Learn by chapter (module) id; no student-level list.
    'chapter-pyq': createBoardAdapter({ label: 'Chapter PYQ', testType: 'chapter-pyq' }),
    custom: createBoardAdapter({ label: 'Custom test', testType: 'custom' }),
    mid: createBoardAdapter({ label: 'Mid-term test', testType: 'mid' }),
    final: createBoardAdapter({ label: 'Final test', testType: 'final' }),
    // Keyed by the course assessment (quiz / unit test) id.
    quiz: createBoardAdapter({ label: 'Quiz', testType: 'quiz' }),
  },
  competitive: {
    mock: createCompetitiveAdapter({ label: 'Mock test', testType: 'mock', listType: 'mock' }),
    pyq: createCompetitiveAdapter({ label: 'Previous year paper', testType: 'pyq', listType: 'pyq' }),
    dpp: createDppAdapter(),
    // Keyed by the chapter's module id.
    'chapter-pyq': createCompetitiveAdapter({ label: 'Chapter PYQ', testType: 'chapter-pyq' }),
    custom: createCompetitiveAdapter({ label: 'Custom test', testType: 'custom' }),
    // Keyed by the chapter's practice assessment id.
    practice: createCompetitiveAdapter({ label: 'Practice questions', testType: 'practice' }),
  },
};

export function getTestAdapter(exam: Pick<ExamDesign, 'category'>, testType: TestTypeKey): TestAdapter | null {
  return ADAPTERS[exam.category]?.[testType] ?? null;
}

/** Test types the exam offers and the engine can run. */
export function availableTestTypes(exam: ExamDesign): TestTypeKey[] {
  return exam.testTypes.filter((type) => getTestAdapter(exam, type) !== null);
}

/** Test types with a paper list of their own (the rest open from Learn or another hub by id). */
export function listableTestTypes(exam: ExamConfig): TestTypeKey[] {
  return availableTestTypes(exam).filter((type) => !!getTestAdapter(exam, type)?.listSets);
}

export type { TestAdapter } from './types';
