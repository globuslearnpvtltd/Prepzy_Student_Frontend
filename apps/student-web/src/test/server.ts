import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const API = 'http://api.test';

/** The exam catalog every exam page loads (GET /api/v4/exams). Tests can override it with server.use(...). */
export const EXAM_CATALOG = [
  { exam_id: 1, exam_name: 'CBSE', exam_slice: 'cbse', category: 'board' },
  { exam_id: 2, exam_name: 'NEET-UG', exam_slice: 'neet-ug', category: 'competitive' },
];

/** Mock backend for tests. Each test adds the handlers it needs with server.use(...). */
export const server = setupServer(
  http.get(`${API}/api/v4/exams`, () => HttpResponse.json({ success: true, message: 'Exams fetched', data: EXAM_CATALOG })),
);
