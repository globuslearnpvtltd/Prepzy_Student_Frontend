'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { VoiceEngine } from './engine';
import { createVoiceStore, LANGUAGE_STORAGE_KEY as LANGUAGE_KEY, type VoiceMeters, type VoiceState } from './store';
import type { StartVoiceOptions, VoiceConfig, VoiceLanguage, VoiceVariant } from './types';

export interface LiveVoice extends VoiceState {
  variant: VoiceVariant;
  /** A call is connecting or running. */
  isActive: boolean;
  meters: VoiceMeters;
  requestStart: (opts: StartVoiceOptions) => void;
  confirmPermission: () => void;
  cancelPermission: () => void;
  retry: () => void;
  end: () => void;
  toggleMute: () => void;
  toggleTutorAudio: () => void;
  minimise: () => void;
  openScreen: () => void;
  setLanguage: (language: VoiceLanguage) => void;
  /** The chat reloaded from the server, so saved voice turns are part of its messages now. */
  markHistoryLoaded: () => void;
  /** Hide the "Live talk ended" card (the student moved on). */
  dismissSummary: () => void;
}

const LiveVoiceContext = createContext<LiveVoice | null>(null);

/** The nearest live-voice call, or null where the surface has none. */
export const useLiveVoice = () => useContext(LiveVoiceContext);

// The WebRTC engine is only downloaded when a student asks for live talk.
const loadEngine = () => import('./engine').then((m) => m.VoiceEngine);

/**
 * Owns one tutor's live voice call for a surface (dashboard Atlas, a lecture, a Vedica chat). Mount it
 * above the chat panel so the call keeps running when the panel closes; unmounting hangs up and saves.
 */
export function LiveVoiceProvider({ config, children }: { config: VoiceConfig; children: React.ReactNode }) {
  const [store] = useState(() => createVoiceStore());
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const configRef = useRef(config);
  configRef.current = config;
  const engineRef = useRef<VoiceEngine | null>(null);
  const loadingRef = useRef<Promise<VoiceEngine> | null>(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_KEY);
      if (stored === 'english' || stored === 'hindi' || stored === 'hinglish') store.set({ language: stored });
    } catch {
      /* storage unavailable */
    }
  }, [store]);

  const ensureEngine = useCallback(() => {
    if (engineRef.current) return Promise.resolve(engineRef.current);
    loadingRef.current ??= loadEngine().then((Engine) => {
      const engine = new Engine(store, () => configRef.current);
      engineRef.current = engine;
      return engine;
    });
    return loadingRef.current;
  }, [store]);

  // Leaving the surface (route change, closing the Vedica chat) hangs up the call and saves it.
  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      engineRef.current?.dispose();
    };
  }, []);

  const requestStart = useCallback(
    (opts: StartVoiceOptions) => {
      store.set({ engaged: true });
      void ensureEngine().then((engine) => {
        if (!disposedRef.current) engine.requestStart(opts);
      });
    },
    [ensureEngine, store],
  );

  const actions = useMemo(() => {
    const call =
      <K extends 'confirmPermission' | 'cancelPermission' | 'retry' | 'end' | 'toggleMute' | 'toggleTutorAudio' | 'minimise' | 'openScreen' | 'markHistoryLoaded' | 'dismissSummary'>(
        name: K,
      ) =>
      () =>
        engineRef.current?.[name]();
    return {
      confirmPermission: call('confirmPermission'),
      cancelPermission: call('cancelPermission'),
      retry: call('retry'),
      end: call('end'),
      toggleMute: call('toggleMute'),
      toggleTutorAudio: call('toggleTutorAudio'),
      minimise: call('minimise'),
      openScreen: call('openScreen'),
      markHistoryLoaded: call('markHistoryLoaded'),
      dismissSummary: () => (engineRef.current ? engineRef.current.dismissSummary() : store.set({ lastSession: null })),
      setLanguage: (language: VoiceLanguage) => {
        if (engineRef.current) engineRef.current.setLanguage(language);
        else {
          store.set({ language });
          try {
            localStorage.setItem(LANGUAGE_KEY, language);
          } catch {
            /* storage unavailable */
          }
        }
      },
    };
  }, [store]);

  const value = useMemo<LiveVoice>(
    () => ({
      ...state,
      variant: config.variant,
      isActive: state.phase !== 'idle' && state.phase !== 'error',
      meters: store.meters,
      requestStart,
      ...actions,
    }),
    [state, config.variant, store.meters, requestStart, actions],
  );

  return <LiveVoiceContext.Provider value={value}>{children}</LiveVoiceContext.Provider>;
}
