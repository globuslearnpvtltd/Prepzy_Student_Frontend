import type { Page } from '@playwright/test';
import { MOCKS, plansFor } from '../visual/mocks';
import { mockApi } from './fixtures';

type Handlers = Parameters<typeof mockApi>[1];

/** The visual-compare mocks are keyed by path; every read in them is a GET. */
export const asGets = (mocks: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(mocks).map(([path, json]) => [`GET ${path}`, json as object]));


/**
 * Every student read from visual/mocks*.ts, signed in as a board (CBSE, class 12) or competitive (NEET) student.
 * Pass `extra` for writes and per-test overrides; they win over the shared data.
 */
export function studentApi(exam: 'board' | 'competitive', extra: Handlers = {}): Handlers {
  return {
    ...asGets(MOCKS),
    'GET /api/v4/student/plans/active': plansFor(exam),
    ...extra,
  };
}

export async function mockStudentApi(page: Page, exam: 'board' | 'competitive', extra: Handlers = {}) {
  await mockApi(page, studentApi(exam, extra));
}
