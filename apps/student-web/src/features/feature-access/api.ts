import type { ExamRef } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { unwrapData } from '@/shared/lib/unwrap';
import { isRestrictableFeature, type RestrictableFeature } from './keys';

type Envelope<T> = { success?: boolean; message?: string; data?: T };

/** Keeps the known keys only (a newer backend may send keys this app doesn't have yet). */
export function toRestricted(data: unknown): RestrictableFeature[] {
  const list = data && typeof data === 'object' ? (data as { restricted?: unknown }).restricted : undefined;
  return Array.isArray(list) ? [...new Set(list.filter(isRestrictableFeature))] : [];
}

export const featureAccessApi = {
  /**
   * Features the student's institute switched off for this exam and class
   * (GET /api/v4/feature-access/:category/:examId?class_id=). Without a class the backend applies its own rule.
   */
  async restricted(exam: ExamRef, classId?: number | null): Promise<RestrictableFeature[]> {
    const body = await apiClient.get<Envelope<unknown>>(`/api/v4/feature-access/${exam.category}/${exam.examId}`, {
      params: typeof classId === 'number' ? { class_id: classId } : undefined,
    });
    return toRestricted(unwrapData(body));
  },
};
