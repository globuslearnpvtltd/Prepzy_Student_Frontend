import { http, HttpResponse } from 'msw';
import type { RestrictableFeature } from '@/features/feature-access';
import { API } from './server';

const accessBody = (restricted: readonly RestrictableFeature[]) =>
  HttpResponse.json({ success: true, message: 'Feature access fetched', data: { restricted } });

/** The `class_id` the app sent (null when it sent none). */
export const accessClassId = (request: Request): number | null => {
  const value = new URL(request.url).searchParams.get('class_id');
  return value === null ? null : Number(value);
};

/**
 * The student's institute switched these features off (GET /api/v4/feature-access/:category/:examId[?class_id=]),
 * whatever the class. `restrictFeatures.perClass({ 12: ['notes'], none: ['quiz'] })` restricts per class: the key is
 * the `class_id` sent, `none` answers a request without one; a class not listed gets nothing restricted.
 */
export const restrictFeatures = Object.assign(
  (...restricted: RestrictableFeature[]) =>
    http.get(`${API}/api/v4/feature-access/:category/:examId`, () => accessBody(restricted)),
  {
    perClass: (byClass: Partial<Record<number | 'none', readonly RestrictableFeature[]>>) =>
      http.get(`${API}/api/v4/feature-access/:category/:examId`, ({ request }) =>
        accessBody(byClass[accessClassId(request) ?? 'none'] ?? []),
      ),
  },
);
