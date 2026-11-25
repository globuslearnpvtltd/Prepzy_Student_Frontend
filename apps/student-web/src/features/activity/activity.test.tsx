import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { ACTIVITY_TIMING, ActivityIntervals, tabSessionId, type ActivityInterval, type TrackerDeps } from '.';

const T0 = Date.parse('2026-11-24T04:00:00.000Z');
const MIN = 60_000;

function setup(visible = true) {
  let now = T0;
  let shown = visible;
  const sent: ActivityInterval[] = [];
  const beacons: ActivityInterval[] = [];
  const deps: TrackerDeps = {
    now: () => now,
    isVisible: () => shown,
    send: async (interval) => void sent.push(interval),
    sendBeacon: (interval) => void beacons.push(interval),
    sessionId: 'tab-1',
  };
  const tracker = new ActivityIntervals(deps);
  return {
    tracker,
    sent,
    beacons,
    advance: (ms: number) => (now += ms),
    show: (on: boolean) => (shown = on),
    span: (i: ActivityInterval) => [Date.parse(i.interval_start) - T0, Date.parse(i.interval_end) - T0],
  };
}

describe('ActivityIntervals (tracker logic)', () => {
  it('reports the open interval every 2 minutes for the class on screen', () => {
    const t = setup();
    t.tracker.setClass(12);
    for (let i = 0; i < 8; i++) {
      t.advance(ACTIVITY_TIMING.tickMs);
      t.tracker.tick();
    }
    expect(t.sent).toHaveLength(1);
    expect(t.span(t.sent[0]!)).toEqual([0, 2 * MIN]);
    expect(t.sent[0]).toMatchObject({ session_id: 'tab-1', source: 'web', class_id: 12 });
  });

  it('stops while hidden and reports on hide with a keepalive request', () => {
    const t = setup();
    t.tracker.setClass(12);
    t.advance(30_000);
    t.show(false);
    t.tracker.close(true);
    expect(t.beacons.map(t.span)).toEqual([[0, 30_000]]);

    t.advance(10 * MIN);
    t.tracker.tick(); // hidden: nothing starts
    t.show(true);
    t.tracker.resume();
    t.advance(20_000);
    t.tracker.close(true);
    expect(t.beacons.map(t.span)).toEqual([
      [0, 30_000],
      [10 * MIN + 30_000, 10 * MIN + 50_000],
    ]);
  });

  it('does not count time the computer slept with the page on screen', () => {
    const t = setup();
    t.tracker.setClass(12);
    t.advance(ACTIVITY_TIMING.tickMs);
    t.tracker.tick();
    t.advance(2 * 60 * MIN); // lid closed: no ticks for two hours
    t.tracker.tick();
    expect(t.beacons.map(t.span)).toEqual([[0, ACTIVITY_TIMING.tickMs]]);
    t.advance(10_000);
    t.tracker.close(true);
    expect(t.span(t.beacons[1]!)).toEqual([ACTIVITY_TIMING.tickMs + 2 * 60 * MIN, ACTIVITY_TIMING.tickMs + 2 * 60 * MIN + 10_000]);
  });

  it('switching class reports the old class first; no class means nothing is recorded', () => {
    const t = setup();
    t.tracker.setClass(null);
    t.advance(MIN);
    t.tracker.close(true);
    expect(t.beacons).toHaveLength(0);

    t.tracker.setClass(12);
    t.advance(40_000);
    t.tracker.setClass(14);
    t.advance(20_000);
    t.tracker.close(true);
    expect(t.beacons.map((b) => b.class_id)).toEqual([12, 14]);
    expect(t.beacons.map(t.span)).toEqual([
      [MIN, MIN + 40_000],
      [MIN + 40_000, MIN + 60_000],
    ]);
  });

  it('reports on navigation only after 30 s, and never intervals under 3 s', async () => {
    const t = setup();
    t.tracker.setClass(12);
    t.advance(10_000);
    expect(t.tracker.navigated()).toBeNull();
    t.advance(25_000);
    await t.tracker.navigated();
    expect(t.sent.map(t.span)).toEqual([[0, 35_000]]);

    t.advance(2_000);
    t.tracker.close(true);
    expect(t.beacons).toHaveLength(0);
  });

  it('a failed report is dropped quietly', async () => {
    let now = T0;
    const tracker = new ActivityIntervals({
      now: () => now,
      isVisible: () => true,
      send: () => Promise.reject(new Error('offline')),
      sendBeacon: () => undefined,
      sessionId: 's',
    });
    tracker.setClass(12);
    now += MIN;
    await expect(tracker.navigated()).resolves.toBeUndefined();
  });

  it('keeps one session id per tab', () => {
    window.sessionStorage.clear();
    const id = tabSessionId();
    expect(id).toMatch(/^web_/);
    expect(tabSessionId()).toBe(id);
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(tabSessionId()).toMatch(/^web_/);
    spy.mockRestore();
  });
});

describe('<ActivityTracker />', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] }));
  afterEach(() => vi.useRealTimers());

  it('posts the visible time of the class on screen and refreshes the learning-hours chart', async () => {
    vi.doMock('@/features/exam-engine', () => ({ useTestContext: () => ({ context: { classId: 12 }, isPending: false }) }));
    vi.doMock('next/navigation', () => ({ usePathname: () => '/cbse/dashboard' }));
    const { ActivityTracker } = await import('./ui');
    const bodies: ActivityInterval[] = [];
    server.use(
      http.post('*/api/v4/dashboard/activity/track', async ({ request }) => {
        bodies.push((await request.json()) as ActivityInterval);
        return HttpResponse.json({ success: true, message: 'ok', data: { skipped: false, total_minutes: 2 } });
      })
    );
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const view = render(
      <QueryClientProvider client={client}>
        <ActivityTracker />
      </QueryClientProvider>
    );

    await act(async () => {
      vi.advanceTimersByTime(2 * MIN + ACTIVITY_TIMING.tickMs);
    });
    await vi.waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ class_id: 12, source: 'web' });
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalled());
    const predicate = (invalidate.mock.calls[0]![0] as unknown as { predicate: (q: { queryKey: unknown[] }) => boolean }).predicate;
    expect(predicate({ queryKey: ['dashboard', 'cbse', 'board-overview', 12] })).toBe(true);
    expect(predicate({ queryKey: ['dashboard', 'cbse', 'scores', 12] })).toBe(false);

    const keepalive = vi.spyOn(globalThis, 'fetch');
    vi.advanceTimersByTime(10_000);
    view.unmount();
    expect(keepalive).toHaveBeenCalledWith(expect.stringContaining('/api/v4/dashboard/activity/track'), expect.objectContaining({ keepalive: true }));
    keepalive.mockRestore();
    vi.doUnmock('@/features/exam-engine');
    vi.doUnmock('next/navigation');
  });
});
