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
   * The mediums an exam offers (GET /api/v4/languages/:category/:examId): the languages of its subjects'
   * books. Empty when the exam has no books yet. With `classId`, only that class's books in the exam
   * (its class_subject_mapping rows of the exam).
   */
  async forExam(exam: ExamRef, classId?: number): Promise<Language[]> {
    const path = `/api/v4/languages/${exam.category}/${exam.examId}`;
    const body =
      classId === undefined
        ? await apiClient.get<Envelope<unknown[]>>(path)
        : await apiClient.get<Envelope<unknown[]>>(path, { params: { class_id: classId } });
    return toLanguages(unwrapData(body));
  },

  /**
   * Saves the signed-in student's medium and returns it. With `examId` (the exam on screen) the backend also checks
   * that exam offers it (400 LANGUAGE_NOT_AVAILABLE); with `classId` too, that the class has books in it.
   */
  async change(languageId: number, examId?: number, classId?: number): Promise<Language> {
    const body: Record<string, number> = { language_id: languageId };
    if (examId !== undefined) {
      body.exam_id = examId;
      if (classId !== undefined) body.class_id = classId;
    }
    const data = unwrapData(await apiClient.put<Envelope<{ language?: unknown }>>('/api/v4/student/account/language', body));
    const language = toStudentLanguage(data.language);
    if (!language) throw new ApiError({ status: 500, code: 'EMPTY_RESPONSE', message: 'The server returned no language.' });
    return language;
  },
};
