import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import { resolveExam } from './exam-resolver';
import { CATEGORY_DEFAULTS, getExam } from './exams';

describe('resolveExam (server pages)', () => {
  it('answers registry exams without asking the backend', async () => {
    let asked = false;
    server.use(http.get(`${API}/api/v4/exams`, () => ((asked = true), HttpResponse.json({ success: true, data: [] }))));
    expect(await resolveExam('neet')).toBe(getExam('neet'));
    expect(await resolveExam(undefined)).toBeNull();
    expect(asked).toBe(false);
  });

  it("finds any other active exam by its slice, with its category's design", async () => {
    server.use(
      http.get(`${API}/api/v4/exams`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { exam_id: 8, exam_name: 'ICSE', exam_slice: 'icse', category: 'board' },
            { exam_id: 9, exam_name: 'JEE Main', exam_slice: 'jee-main', category: 'competitive' },
          ],
        }),
      ),
    );
    expect(await resolveExam('JEE-Main')).toEqual({
      slug: 'jee-main',
      examSlice: 'jee-main',
      label: 'JEE Main',
      category: 'competitive',
      ...CATEGORY_DEFAULTS.competitive,
    });
    expect((await resolveExam('icse'))?.category).toBe('board');
    expect(await resolveExam('gate')).toBeNull();
  });

  it('throws when the backend fails, so a page is never cached as a 404', async () => {
    server.use(http.get(`${API}/api/v4/exams`, () => HttpResponse.json({ message: 'down' }, { status: 500 })));
    await expect(resolveExam('icse')).rejects.toThrow('GET /api/v4/exams failed with 500');
  });
});
