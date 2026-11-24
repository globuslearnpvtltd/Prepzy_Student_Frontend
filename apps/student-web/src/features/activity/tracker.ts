// Learning time ("How you fare" hours). Each tab reports the intervals it was visible; the backend stores them and
// counts the union per India-time day and class, so the same minutes in two tabs, two windows or on a phone and a
// laptop count once. No tab election is needed (the previous app let only one "leader" tab count, which lost the
// time spent in a second tab while the first was in the background).

export const ACTIVITY_TIMING = {
  /** How often the open interval is reported while the tab stays visible. */
  reportEveryMs: 2 * 60_000,
  /** How often the clock is checked (also detects a sleeping computer). */
  tickMs: 15_000,
  /** A gap this long between ticks means the timers were frozen (sleep, frozen tab): that time is not counted. */
  frozenGapMs: 45_000,
  /** Intervals shorter than this are not sent (the backend skips them too). */
  minMs: 3_000,
  /** On navigation, report only when at least this much is open (keeps requests few, the dashboard current). */
  navigationMinMs: 30_000,
} as const;

export interface ActivityInterval {
  session_id: string;
  source: 'web';
  interval_start: string;
  interval_end: string;
  class_id: number;
}

export interface TrackerDeps {
  now: () => number;
  isVisible: () => boolean;
  /** Normal report (the page stays): resolves when saved. */
  send: (interval: ActivityInterval) => Promise<unknown>;
  /** The page may be going away: a request that survives it (fetch keepalive). */
  sendBeacon: (interval: ActivityInterval) => void;
  sessionId: string;
}

/** The interval bookkeeping, without React or timers, so every case can be tested. */
export class ActivityTracker {
  private startedAt: number | null = null;
  private lastTick: number;
  private classId: number | null = null;

  constructor(private readonly deps: TrackerDeps) {
    this.lastTick = deps.now();
  }

  /** The class on screen; time is recorded for it. A change reports the old class's interval first. */
  setClass(classId: number | null): void {
    if (classId === this.classId) return;
    this.close(true);
    this.classId = classId;
    this.resume();
  }

  /** Starts an interval when the tab is visible and a class is known. */
  resume(): void {
    this.lastTick = this.deps.now();
    if (this.startedAt === null && this.classId !== null && this.deps.isVisible()) this.startedAt = this.lastTick;
  }

  /** Called every few seconds. */
  tick(): void {
    const now = this.deps.now();
    const frozen = now - this.lastTick > ACTIVITY_TIMING.frozenGapMs;
    if (frozen && this.startedAt !== null) {
      // The computer slept (or the browser froze the tab) with the page on screen: count up to the last tick only.
      this.report(this.lastTick, true);
      this.startedAt = this.deps.isVisible() ? now : null;
    } else if (this.startedAt !== null && now - this.startedAt >= ACTIVITY_TIMING.reportEveryMs) {
      this.report(now, false);
      this.startedAt = now;
    }
    this.lastTick = now;
    if (this.startedAt === null) this.resume();
  }

  /** The student moved to another page: report a longer open interval so the dashboard is current. */
  navigated(): Promise<unknown> | null {
    const now = this.deps.now();
    if (this.startedAt === null || now - this.startedAt < ACTIVITY_TIMING.navigationMinMs) return null;
    const sent = this.report(now, false);
    this.startedAt = now;
    return sent;
  }

  /** Tab hidden, page closing, class switched or tracker removed: report the open interval and stop. */
  close(leaving: boolean): void {
    if (this.startedAt !== null) this.report(this.deps.now(), leaving);
    this.startedAt = null;
  }

  private report(end: number, leaving: boolean): Promise<unknown> | null {
    const start = this.startedAt;
    if (start === null || this.classId === null || end - start < ACTIVITY_TIMING.minMs) return null;
    const interval: ActivityInterval = {
      session_id: this.deps.sessionId,
      source: 'web',
      interval_start: new Date(start).toISOString(),
      interval_end: new Date(end).toISOString(),
      class_id: this.classId,
    };
    if (leaving) {
      this.deps.sendBeacon(interval);
      return null;
    }
    return this.deps.send(interval).catch(() => undefined); // a lost report only costs that interval
  }
}

const SESSION_KEY = 'prepzy-activity-session';

/** One id per tab (sessionStorage is per tab, and separate in private windows). */
export function tabSessionId(): string {
  const fresh = () => `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    const saved = window.sessionStorage.getItem(SESSION_KEY);
    if (saved) return saved;
    const id = fresh();
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return fresh();
  }
}
