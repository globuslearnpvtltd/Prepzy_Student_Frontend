'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/errors';
import { assertOk } from '@/shared/lib/unwrap';

/** Speech-to-text for written answers (POST /api/chat/transcribe, form field `audio`). */
export async function transcribeAudio(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append('audio', new File([audio], 'answer.webm', { type: audio.type || 'audio/webm' }));
  const body = assertOk(await apiClient.post<{ success?: boolean; transcribedText?: string }>('/api/chat/transcribe', form));
  const text = body.transcribedText?.trim();
  if (!text) throw new ApiError({ status: 422, code: 'NO_SPEECH', message: "We couldn't hear anything. Please try again." });
  return text;
}

export type RecorderState = 'idle' | 'recording' | 'transcribing';

/** Records from the microphone; on stop, transcribes and hands the text to `onText`. */
export function useVoiceAnswer(onText: (text: string) => void, onError: (error: unknown) => void) {
  const [state, setState] = useState<RecorderState>('idle');
  const recorder = useRef<MediaRecorder | null>(null);
  const callbacks = useRef({ onText, onError });
  callbacks.current = { onText, onError };

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((track) => track.stop()), []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const media = new MediaRecorder(stream);
      media.ondataavailable = (event) => chunks.push(event.data);
      media.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setState('transcribing');
        try {
          callbacks.current.onText(await transcribeAudio(new Blob(chunks, { type: media.mimeType || 'audio/webm' })));
        } catch (error) {
          callbacks.current.onError(error);
        } finally {
          setState('idle');
        }
      };
      recorder.current = media;
      media.start();
      setState('recording');
    } catch (error) {
      callbacks.current.onError(error);
      setState('idle');
    }
  }, []);

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    recorder.current = null;
  }, []);

  const supported = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices;
  return { state, start, stop, supported };
}
