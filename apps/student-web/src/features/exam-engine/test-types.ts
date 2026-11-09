import type { TestTypeKey } from '@/shared/config/exams';

/** Display copy for each test type. Behaviour lives in the adapters. */
export const TEST_TYPES: Record<TestTypeKey, { label: string; description: string }> = {
  mock: { label: 'Mock tests', description: 'Full-length papers under real exam conditions.' },
  pyq: { label: 'Previous year papers', description: 'Solve actual papers from past years.' },
  'chapter-pyq': { label: 'Chapter PYQs', description: 'Past-year questions for one chapter.' },
  custom: { label: 'Custom tests', description: 'Build a test from the chapters you choose.' },
  mid: { label: 'Mid-term tests', description: 'Half-syllabus tests.' },
  final: { label: 'Final tests', description: 'Full-syllabus tests.' },
  quiz: { label: 'Quizzes', description: 'Quick checks after each lesson.' },
  dpp: { label: 'Daily practice', description: 'A short paper every day to keep you sharp.' },
  practice: { label: 'Practice questions', description: 'Chapter-wise practice sets.' },
};

export const isTestTypeKey = (value: string): value is TestTypeKey => Object.hasOwn(TEST_TYPES, value);
