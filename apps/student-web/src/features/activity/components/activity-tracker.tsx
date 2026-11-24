'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTestContext } from '@/features/exam-engine';
import { activityApi } from '../api';
import { ACTIVITY_TIMING, ActivityTracker as Tracker, tabSessionId } from '../tracker';

/** The dashboard's learning-hours queries (board overview + competitive weekly activity). */
const isActivityQuery = (key: readonly unknown[]) =>
  key[0] === 'dashboard' && (key[2] === 'board-overview' || key[2] === 'activity');

/**
 * Records learning time for the class on screen (the same class the dashboard chart shows) while the tab is
 * visible. Mounted once by the exam frame, so only on exam pages of an owned exam (never the portals).
 */
export function ActivityTracker() {
  const { context } = useTestContext();
  const classId = context?.classId ?? null;
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [tracker] = useState(
    () =>
      new Tracker({
        now: () => Date.now(),
        isVisible: () => typeof document === 'undefined' || document.visibilityState === 'visible',
        send: (interval) =>
          activityApi.track(interval).then(() => queryClient.invalidateQueries({ predicate: (q) => isActivityQuery(q.queryKey) })),
        sendBeacon: activityApi.trackOnLeave,
        sessionId: typeof window === 'undefined' ? 'server' : tabSessionId(),
      })
  );

  useEffect(() => {
    tracker.setClass(classId);
  }, [tracker, classId]);

  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    void tracker.navigated();
  }, [tracker, pathname]);

  useEffect(() => {
    const onVisibility = () => (document.visibilityState === 'visible' ? tracker.resume() : tracker.close(true));
    const onLeave = () => tracker.close(true);
    tracker.resume(); // also after a remount (React strict mode runs effects twice in development)
    const timer = setInterval(() => tracker.tick(), ACTIVITY_TIMING.tickMs);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onLeave);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onLeave);
      tracker.close(true);
    };
  }, [tracker]);

  return null;
}
