/**
 * Server-sent events from the chat backend: `data: {json}\n\n` frames, ended by `data: [DONE]`.
 * Payload keys: `token` (next piece of the answer), `final` (whole answer, sent when nothing was streamed),
 * `followups` (suggested questions) and `error`.
 */
export interface StreamEvent {
  token?: string;
  final?: string;
  text?: string;
  followups?: string[];
  error?: string;
}

/** Splits a text buffer into complete frames; returns the frames' payloads and the unfinished remainder. */
export function splitFrames(buffer: string): { payloads: string[]; rest: string } {
  const frames = buffer.split(/\r?\n\r?\n/);
  const rest = frames.pop() ?? '';
  return { payloads: frames.map(framePayload).filter((p): p is string => p !== null), rest };
}

function framePayload(frame: string): string | null {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s?/, ''))
    .join('\n')
    .trim();
  return data || null;
}

function parsePayload(payload: string): StreamEvent | null {
  try {
    const value: unknown = JSON.parse(payload);
    return value && typeof value === 'object' ? (value as StreamEvent) : null;
  } catch {
    return null; // a malformed frame is skipped, as before
  }
}

/** Reads an SSE byte stream and calls `onEvent` for every JSON frame until `[DONE]` or the end. */
export async function readEvents(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const cancel = () => void reader.cancel().catch(() => undefined);
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    for (;;) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { done, value } = await reader.read();
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const { payloads, rest } = splitFrames(done ? `${buffer}\n\n` : buffer);
      buffer = rest;
      for (const payload of payloads) {
        if (payload === '[DONE]') return;
        const event = parsePayload(payload);
        if (event) onEvent(event);
      }
      if (done) return;
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}

export interface StreamedReply {
  text: string;
  followups: string[];
}

/**
 * Builds the reply from the events: tokens are appended as they arrive (`onText` gets the text so far);
 * `final` replaces the text only when no tokens came. A frame with `error` and no text fails the reply.
 */
export async function readReply(
  stream: ReadableStream<Uint8Array>,
  onText: (text: string) => void,
  signal?: AbortSignal,
): Promise<StreamedReply> {
  let text = '';
  let followups: string[] = [];
  let error: string | null = null;
  await readEvents(
    stream,
    (event) => {
      if (typeof event.token === 'string' && event.token) {
        text += event.token;
        onText(text);
      } else if (!text && typeof event.final === 'string' && event.final) {
        text = event.final;
        onText(text);
      } else if (!text && typeof event.text === 'string' && event.text) {
        text = event.text;
        onText(text);
      }
      if (Array.isArray(event.followups)) followups = event.followups.filter((f): f is string => typeof f === 'string');
      if (typeof event.error === 'string') error = event.error;
    },
    signal,
  );
  if (!text) throw new Error(error ?? 'The reply was empty.');
  return { text, followups };
}
