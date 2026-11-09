import type { ExamConfig, TestTypeKey } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';

/**
 * Where each test type lives in the app (the player's Back button and breadcrumb, the result's back link).
 * Board papers come from Assessments; competitive ones from their own hub pages; chapter tests from Learn.
 */
export function testHome(exam: ExamConfig, testType: TestTypeKey): { label: string; href: string } {
  if (exam.category === 'board') {
    if (testType === 'mock' || testType === 'pyq' || testType === 'custom')
      return { label: 'Assessments', href: routes.assessments(exam.slug) };
    return { label: 'Learn', href: routes.learn(exam.slug) };
  }
  switch (testType) {
    case 'mock':
      return { label: 'Mock Exams', href: routes.mockTests(exam.slug) };
    case 'pyq':
      return { label: 'PYQ Library', href: routes.pyqLibrary(exam.slug) };
    case 'dpp':
      return { label: 'Daily Practice', href: routes.dailyPractice(exam.slug) };
    case 'custom':
      return { label: 'Custom Test', href: routes.customTest(exam.slug) };
    default:
      return { label: 'Learn', href: routes.learn(exam.slug) };
  }
}
