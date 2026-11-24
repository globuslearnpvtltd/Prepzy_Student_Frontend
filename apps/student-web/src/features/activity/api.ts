import { apiClient } from '@/shared/lib/api-client';
import type { ActivityInterval } from './tracker';

const TRACK_PATH = '/api/v4/dashboard/activity/track';

export const activityApi = {
  track: (interval: ActivityInterval) => apiClient.post(TRACK_PATH, interval),
  /** Survives the page closing (fetch keepalive). */
  trackOnLeave: (interval: ActivityInterval) => apiClient.keepalive('POST', TRACK_PATH, interval),
};
