import { http, HttpResponse } from 'msw';
import type { RestrictableFeature } from '@/features/feature-access';
import { API } from './server';

/** The student's institute switched these features off (GET /api/v4/feature-access/:category/:examId). */
export const restrictFeatures = (...restricted: RestrictableFeature[]) =>
  http.get(`${API}/api/v4/feature-access/:category/:examId`, () =>
    HttpResponse.json({ success: true, message: 'Feature access fetched', data: { restricted } }),
  );
