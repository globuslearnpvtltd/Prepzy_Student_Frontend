import { apiClient } from '@/shared/lib/api-client';
import { assertOk } from '@/shared/lib/unwrap';
import { MAX_IMAGE_BYTES } from './upload';
import { ApiError } from '@/shared/lib/errors';

export const REPORT_SECTIONS = ['Question', 'Answer', 'Mark', 'Others'] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

/** "Report a problem" on a reviewed question (POST /api/v4/assessments/reports, multipart; screenshot optional). */
export async function reportProblem(input: { questionId: string; section: ReportSection; description: string; image?: File | null }) {
  if (input.image && input.image.size > MAX_IMAGE_BYTES) {
    throw new ApiError({ status: 400, code: 'FILE_TOO_LARGE', message: 'Images must be 5 MB or smaller.' });
  }
  const form = new FormData();
  form.append('category', 'pyq');
  form.append('section', input.section);
  form.append('question_id', input.questionId);
  form.append('description', input.description.trim());
  if (input.image) form.append('image', input.image);
  return assertOk(await apiClient.post<{ success?: boolean; message?: string }>('/api/v4/assessments/reports', form));
}
