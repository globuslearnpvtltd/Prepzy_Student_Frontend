'use client';

import { useEffect, useState } from 'react';
import { useLiveVoice } from '../provider';

const TICK_MS = 110;

/** Polls the live mic / tutor levels at animation speed without re-rendering the provider's tree. */
export function useVoiceLevels(enabled = true) {
  const voice = useLiveVoice();
  const meters = voice?.meters;
  const [state, setState] = useState({ t: 0, mic: 0, bot: 0 });
  useEffect(() => {
    if (!enabled || !meters) return;
    const started = performance.now();
    const id = setInterval(() => {
      const { mic, bot } = meters.levels;
      setState({ t: (performance.now() - started) / 1000, mic, bot });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [enabled, meters]);
  return state;
}
