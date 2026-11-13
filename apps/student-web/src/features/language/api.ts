import { toStudentLanguage, type StudentLanguage } from '@/features/auth';
import type { ExamRef } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/errors';
import { unwrapData } from '@/shared/lib/unwrap';

/** A content medium (languages row): `name` is as stored, e.g. "hindi". */
export type Language = StudentLanguage;

type Envelope<T> = { success?: boolean; message?: string; data?: T };

const toLanguages = (data: unknown): Language[] =>
  (Array.isArray(data) ? data : []).map(toStudentLanguage).filter((language): language is Language => language !== null);

export const languageApi = {
  /** Every medium, by id (GET /api/v4/languages, public). */
  async list(): Promise<Language[]> {
    return toLanguages(unwrapData(await apiClient.get<Envelope<unknown[]>>('/api/v4/languages')));
  },

  /**
   * The mediums an exam offers, by id (GET /api/v4/languages/:category/:examId): the languages of its subjects'
   * books. Empty when the exam has no books yet.
   */
  async forExam(exam: ExamRef): Promise<Language[]> {
    return toLanguages(unwrapData(await apiClient.get<Envelope<unknown[]>>(`/api/v4/languages/${exam.category}/${exam.examId}`)));
  },

  /**
   * Saves the signed-in student's medium and returns it. With `examId` (the exam on screen) the backend also checks
   * that exam offers it (400 LANGUAGE_NOT_AVAILABLE).
   */
  async change(languageId: number, examId?: number): Promise<Language> {
    const data = unwrapData(
      await apiClient.put<Envelope<{ language?: unknown }>>(
        '/api/v4/student/account/language',
        examId === undefined ? { language_id: languageId } : { language_id: languageId, exam_id: examId },
      ),
    );
    const language = toStudentLanguage(data.language);
    if (!language) throw new ApiError({ status: 500, code: 'EMPTY_RESPONSE', message: 'The server returned no language.' });
    return language;
  },
};
