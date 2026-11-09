import { act, renderHook } from '@testing-library/react';
import { formatDuration, useCountdown } from './hooks';

describe('useCountdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts down from the wall-clock deadline and fires once at zero', () => {
    const onExpire = vi.fn();
    const deadline = Date.now() + 3000;
    const { result } = renderHook(() => useCountdown(deadline, onExpire));
    expect(result.current).toBe(3);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toBe(0);
    act(() => vi.advanceTimersByTime(5000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('is null for untimed papers', () => {
    const { result } = renderHook(() => useCountdown(null, vi.fn()));
    expect(result.current).toBeNull();
  });
});

describe('formatDuration', () => {
  it.each([
    [59, '00:59'],
    [600, '10:00'],
    [3725, '1:02:05'],
  ])('%i seconds → %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});
