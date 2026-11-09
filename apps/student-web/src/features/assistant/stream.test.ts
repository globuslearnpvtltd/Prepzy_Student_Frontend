import { readEvents, readReply, splitFrames, type StreamEvent } from './stream';

const encoder = new TextEncoder();

/** A byte stream that delivers the given chunks one by one. */
function streamOf(chunks: string[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('splitFrames', () => {
  it('returns complete frames and keeps the unfinished remainder', () => {
    expect(splitFrames('data: {"token":"a"}\n\ndata: {"tok')).toEqual({ payloads: ['{"token":"a"}'], rest: 'data: {"tok' });
  });

  it('accepts CRLF and joins multi-line data', () => {
    expect(splitFrames('data: one\r\ndata: two\r\n\r\n').payloads).toEqual(['one\ntwo']);
  });

  it('skips frames without data (comments, keep-alives)', () => {
    expect(splitFrames(': ping\n\n').payloads).toEqual([]);
  });
});

describe('readEvents', () => {
  it('parses frames split across chunks, even mid-token and mid-character', async () => {
    const bytes = encoder.encode('data: {"token":"Hé"}\n\ndata: {"token":"llo"}\n\n');
    // Split inside the two-byte "é" and inside the JSON.
    const parts = [bytes.slice(0, 18), bytes.slice(18, 30), bytes.slice(30)];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        parts.forEach((p) => controller.enqueue(p));
        controller.close();
      },
    });
    const events: StreamEvent[] = [];
    await readEvents(stream, (e) => events.push(e));
    expect(events).toEqual([{ token: 'Hé' }, { token: 'llo' }]);
  });

  it('stops at [DONE] and ignores malformed frames', async () => {
    const events: StreamEvent[] = [];
    await readEvents(streamOf(['data: not json\n\n', 'data: {"token":"x"}\n\ndata: [DONE]\n\ndata: {"token":"late"}\n\n']), (e) => events.push(e));
    expect(events).toEqual([{ token: 'x' }]);
  });

  it('reads a last frame that has no trailing blank line', async () => {
    const events: StreamEvent[] = [];
    await readEvents(streamOf(['data: {"final":"done"}']), (e) => events.push(e));
    expect(events).toEqual([{ final: 'done' }]);
  });

  it('rejects with AbortError when cancelled', async () => {
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode('data: {"token":"a"}\n\n'));
      },
    });
    const seen: StreamEvent[] = [];
    const reading = readEvents(stream, (e) => {
      seen.push(e);
      controller.abort();
    }, controller.signal);
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' });
    expect(seen).toHaveLength(1);
  });
});

describe('readReply', () => {
  it('appends tokens, reports progress and collects follow-ups', async () => {
    const progress: string[] = [];
    const reply = await readReply(
      streamOf(['data: {"token":"New"}\n\n', 'data: {"token":"ton"}\n\ndata: {"followups":["Why?",3]}\n\ndata: [DONE]\n\n']),
      (text) => progress.push(text),
    );
    expect(progress).toEqual(['New', 'Newton']);
    expect(reply).toEqual({ text: 'Newton', followups: ['Why?'] });
  });

  it('uses `final` (or `text`) only when nothing was streamed', async () => {
    expect((await readReply(streamOf(['data: {"final":"Whole answer"}\n\n']), () => undefined)).text).toBe('Whole answer');
    expect((await readReply(streamOf(['data: {"text":"Plain"}\n\n']), () => undefined)).text).toBe('Plain');
    expect((await readReply(streamOf(['data: {"token":"A"}\n\ndata: {"final":"B"}\n\n']), () => undefined)).text).toBe('A');
  });

  it('fails with the server error when no text arrived', async () => {
    await expect(readReply(streamOf(['data: {"error":"Model busy"}\n\n']), () => undefined)).rejects.toThrow('Model busy');
    await expect(readReply(streamOf([]), () => undefined)).rejects.toThrow('The reply was empty.');
  });
});
