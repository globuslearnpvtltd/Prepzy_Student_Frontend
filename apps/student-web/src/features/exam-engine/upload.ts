import { apiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/errors';
import { assertOk } from '@/shared/lib/unwrap';
import type { UploadedImage } from './model';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Pictures (photos and handwritten pages) one answer may carry; the backend refuses more. */
export const MAX_ANSWER_IMAGES = 10;
export const TOO_MANY_IMAGES = `An answer can have up to ${MAX_ANSWER_IMAGES} pictures.`;

/** Uploads one photo of a written answer (the backend accepts a single file per request). */
export async function uploadAnswerImage(file: File): Promise<UploadedImage> {
  if (!file.type.startsWith('image/')) {
    throw new ApiError({ status: 400, code: 'INVALID_FILE', message: 'Please choose an image file.' });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ApiError({ status: 400, code: 'FILE_TOO_LARGE', message: 'Images must be 5 MB or smaller.' });
  }
  const form = new FormData();
  form.append('answerImages', file);
  const body = assertOk(
    await apiClient.post<{ success?: boolean; data?: { url: string; public_id: string } | null }>(
      '/api/v4/assessments/answer-images',
      form,
    ),
  );
  if (!body.data?.url)
    throw new ApiError({ status: 500, code: 'UPLOAD_FAILED', message: 'Upload failed. Please try again.' });
  return { url: body.data.url, publicId: body.data.public_id };
}
