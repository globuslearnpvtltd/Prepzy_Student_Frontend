'use client';

import { useEffect, useState } from 'react';

export const RESEND_SECONDS = 30;

/** Seconds left before "Resend code" is offered again. */
export function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return { seconds, start: () => setSeconds(RESEND_SECONDS) };
}
