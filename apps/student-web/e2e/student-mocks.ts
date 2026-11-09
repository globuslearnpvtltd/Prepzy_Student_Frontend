import type { Page } from '@playwright/test';
import { MOCKS, plansFor } from '../visual/mocks';
import { mockApi } from './fixtures';

type Handlers = Parameters<typeof mockApi>[1];

/** The visual-compare mocks are keyed by path; every read in them is a GET. */
export const asGets = (mocks: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(mocks).map(([path, json]) => [`GET ${path}`, json as object]));

/** Reads the app sends as POST (the backend's convention for these endpoints). */
const POST_READS = ['/api/v1/chat/marketingChatImageName', '/api/neet/chat/marketingChatImageName'];
const asPosts = (paths: string[]) => Object.fromEntries(paths.map((path) => [`POST ${path}`, MOCKS[path] as object]));

/**
 * Every student read from visual/mocks*.ts, signed in as a board (CBSE, class 12) or competitive (NEET) student.
 * Pass `extra` for writes and per-test overrides; they win over the shared data.
 */
export function studentApi(exam: 'board' | 'competitive', extra: Handlers = {}): Handlers {
  return {
    ...asGets(MOCKS),
    ...asPosts(POST_READS),
    'GET /api/v1/student/plans/active': plansFor(exam),
    ...extra,
  };
}

export async function mockStudentApi(page: Page, exam: 'board' | 'competitive', extra: Handlers = {}) {
  await mockApi(page, studentApi(exam, extra));
}
