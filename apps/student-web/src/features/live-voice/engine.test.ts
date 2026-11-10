import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { onApiEvent } from '@/shared/lib/api-client';
import { FakeAudioContext, FakePeerConnection, installVoiceFakes, removeVoiceFakes, type VoiceFakes } from '@/test/fake-webrtc';
import { API, server } from '@/test/server';
import { voiceEndpoints } from './api';
import { VoiceEngine } from './engine';
import { createVoiceStore, LANGUAGE_STORAGE_KEY, type VoiceStore } from './store';
import type { VoiceConfig, VoiceVariant } from './types';

const BOARD_QUESTION = {
  assessment_id: 3,
  question_id: 8,
  attempt_id: 21,
  sub_question_id: 5,
  question: 'Define work.',
  question_diagram: '',
  sample_answer: 'Work = F·d',
  sample_diagram: '',
  student_answer: 'Force times distance',
  student_diagram: '',
  marks_awarded: 1,
  total_marks: 2,
  feedback: 'Units missing',
};
const NEET_QUESTION = {
  assessment_id: 4,
  question_id: 9,
  attempt_id: 22,
  question: 'Which organelle makes ATP?',
  question_diagram: '',
  options: [
    { id: 1, text: 'Ribosome' },
    { id: 2, text: 'Mitochondria' },
  ],
  correct_option_id: 2,
  selected_option_id: 1,
  explanation: 'Mitochondria are the powerhouse.',
};

const BOARD = { category: 'board', examId: 1 } as const;
const NEET = { category: 'competitive', examId: 2 } as const;

const CONFIGS: Record<VoiceVariant, VoiceConfig> = {
  lecture: { variant: 'lecture', exam: BOARD, courseId: 7, lectureId: 70 },
  'neet-lecture': { variant: 'neet-lecture', exam: NEET, courseId: 8, moduleId: 80, classId: 12 },
  dashboard: { variant: 'dashboard', exam: BOARD, classId: 10, className: 'Class 10' },
  'neet-dashboard': { variant: 'neet-dashboard', exam: NEET, classId: 12 },
  'post-assessment': { variant: 'post-assessment', exam: BOARD, postAssessment: BOARD_QUESTION },
  'neet-post-assessment': { variant: 'neet-post-assessment', exam: NEET, postAssessment: NEET_QUESTION },
};

const OPTS = { avatar: { name: 'CV Raman, The Physicist', image: 'raman.png' }, chatId: 41, history: [{ role: 'user' as const, text: 'What is light?' }] };

let fakes: VoiceFakes;
let starts: { path: string; body: Record<string, unknown> }[];
let saves: { path: string; body: Record<string, unknown> }[];

/** Answers every start / save endpoint (or a given status for start). */
function backend(startStatus = 200, startData: unknown = { sdp: 'answer-sdp', type: 'answer' }) {
  for (const { start, save } of Object.values(CONFIGS).map(voiceEndpoints)) {
    server.use(
      http.post(`${API}${start}`, async ({ request }) => {
        starts.push({ path: start, body: (await request.json()) as Record<string, unknown> });
        return startStatus === 200 ? HttpResponse.json({ success: true, data: startData }) : HttpResponse.json({ message: 'nope' }, { status: startStatus });
      }),
      http.post(`${API}${save}`, async ({ request }) => {
        saves.push({ path: save, body: (await request.json()) as Record<string, unknown> });
        return HttpResponse.json({ success: true, data: { chat_id: 99, saved: 2 } });
      }),
    );
  }
}

function setup(config: VoiceConfig = CONFIGS.dashboard): { store: VoiceStore; engine: VoiceEngine } {
  const store = createVoiceStore();
  return { store, engine: new VoiceEngine(store, () => config) };
}

/** Starts a call and waits until the SDP answer is applied. */
async function connect(engine: VoiceEngine) {
  await engine.start(OPTS);
  expect(FakePeerConnection.last?.remoteDescription).toEqual({ sdp: 'answer-sdp', type: 'answer' });
  return FakePeerConnection.last!;
}

beforeEach(() => {
  fakes = installVoiceFakes();
  starts = [];
  saves = [];
  localStorage.clear();
});
afterEach(() => removeVoiceFakes());

describe('VoiceEngine: start', () => {
  it.each([
    ['lecture', '/api/v4/chat/board/1/voice/lectures/7/start', { course_id: 7, lecture_id: 70 }],
    ['neet-lecture', '/api/v4/chat/competitive/2/voice/lectures/8/start', { course_id: 8, module_id: 80, class_id: 12 }],
    ['dashboard', '/api/v4/chat/board/1/voice/dashboard/start', { class_id: 10, class_name: 'Class 10' }],
    ['neet-dashboard', '/api/v4/chat/competitive/2/voice/dashboard/start', { class_id: 12 }],
    [
      'post-assessment',
      '/api/v4/chat/board/1/voice/review/3/8/21/start',
      {
        question: 'Define work.',
        sample_answer: 'Work = F·d',
        student_answer: 'Force times distance',
        marks_awarded: 1,
        total_marks: 2,
        feedback: 'Units missing',
        sample_diagram: '',
        student_diagram: '',
        question_diagram: '',
      },
    ],
    [
      'neet-post-assessment',
      '/api/v4/chat/competitive/2/voice/review/4/9/22/start',
      { question: 'Which organelle makes ATP?', question_diagram: '', options: NEET_QUESTION.options, correct_option_id: 2, selected_option_id: 1, explanation: 'Mitochondria are the powerhouse.' },
    ],
  ] as const)('%s sends the SDP offer with its scope, language and history', async (variant, path, scope) => {
    backend();
    const { store, engine } = setup(CONFIGS[variant]);
    const pc = await connect(engine);
    expect(starts).toHaveLength(1);
    expect(starts[0]!.path).toBe(path);
    expect(starts[0]!.body).toEqual({ sdp: 'offer-sdp', type: 'offer', ...scope, language: 'english', history: OPTS.history });
    // The ids are only for saving; the agent never gets them.
    expect(starts[0]!.body).not.toHaveProperty('assessment_id');
    expect(pc.config.iceServers?.[0]?.urls).toContain('stun:');
    expect(fakes.getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    expect(store.get()).toMatchObject({ phase: 'connecting', screenOpen: true, engaged: true, avatar: OPTS.avatar });
    engine.dispose();
  });

  it('goes through the call phases, keeps the transcript and saves it on end', async () => {
    backend();
    const { store, engine } = setup(CONFIGS.dashboard);
    const pc = await connect(engine);
    const events = pc.events;

    events.emit({ type: 'ready' });
    expect(store.get().phase).toBe('listening');
    events.emit({ type: 'user_interim', text: 'What is' });
    expect(store.get()).toMatchObject({ phase: 'speaking', interimText: 'What is' });
    events.emit({ type: 'user_final', text: 'What is refraction?' });
    expect(store.get()).toMatchObject({ phase: 'endturn', interimText: '', lastUserText: 'What is refraction?' });
    events.emit({ type: 'state', value: 'thinking' });
    expect(store.get().phase).toBe('thinking');
    events.emit({ type: 'bot_start' });
    events.emit({ type: 'bot_delta', text: 'Light bends ' });
    expect(store.get().phase).toBe('answering');
    events.emit({ type: 'figure', number: 3, url: 'fig.png' });
    events.emit({ type: 'bot_delta', text: 'at a boundary.' });
    events.emit({ type: 'bot_segment', text: 'Light bends at a boundary.', start_ms: 0 });
    events.emit({ type: 'bot_word', index: 2, start_ms: 400 });
    expect(store.meters.wordTiming.anchors).toEqual([
      { index: 0, ms: 0 },
      { index: 2, ms: 400 },
    ]);
    expect(store.get().reply).toMatchObject({ text: 'Light bends at a boundary.', figure: { number: 3, url: 'fig.png' } });
    events.emit({ type: 'bot_end' });
    // The finished answer stays on screen for the highlighter.
    expect(store.get().reply).toMatchObject({ done: true });
    events.emit({ type: 'state', value: 'listening' });
    expect(store.get().phase).toBe('listening');

    // The student cuts in on the next answer.
    events.emit({ type: 'state', value: 'speaking' });
    events.emit({ type: 'bot_start', text: 'Also, ' });
    expect(store.get().phase).toBe('answering');
    events.emit({ type: 'user_interim', text: 'Wait' });
    expect(store.get().phase).toBe('interrupted');
    events.emit({ type: 'bot_end', interrupted: true });
    events.emit({ type: 'not-a-known-event' });
    pc.events.onmessage?.({ data: 'not json' });

    expect(store.get().turns).toEqual([
      { role: 'user', text: 'What is refraction?' },
      { role: 'assistant', text: 'Light bends at a boundary.', image: 'fig.png', interrupted: false },
      { role: 'assistant', text: 'Also,', image: undefined, interrupted: true },
    ]);

    engine.end();
    expect(store.get()).toMatchObject({ phase: 'idle', screenOpen: false, reply: null });
    expect(pc.closed).toBe(true);
    expect(fakes.streams[0]!.tracks[0]!.stopped).toBe(true);
    expect(FakeAudioContext.instances[0]!.closed).toBe(true);
    await waitFor(() => expect(store.get().lastSession?.saved).toBe(true));
    expect(store.get().savedChatId).toBe(99);
    expect(saves[0]!.path).toBe('/api/v4/chat/board/1/voice/dashboard/save');
    expect(saves[0]!.body).toEqual({
      chat_id: 41,
      class_id: 10,
      turns: [
        { role: 'user', text: 'What is refraction?' },
        { role: 'assistant', text: 'Light bends at a boundary.', image: 'fig.png' },
        { role: 'assistant', text: 'Also,' },
      ],
    });
  });

  it.each([
    ['lecture', { course_id: 7 }],
    ['neet-dashboard', { class_id: 12 }],
    ['post-assessment', { assessment_id: 3, question_id: 8, attempt_id: 21, sub_question_id: 5 }],
    ['neet-post-assessment', { assessment_id: 4, question_id: 9, attempt_id: 22 }],
  ] as const)('%s saves the transcript under its ids', async (variant, scope) => {
    backend();
    const { engine } = setup(CONFIGS[variant]);
    const pc = await connect(engine);
    pc.events.emit({ type: 'ready' });
    pc.events.emit({ type: 'user_final', text: 'Hi' });
    pc.events.emit({ type: 'bot_end', text: 'Hello! <solution>x = 2</solution>' });
    engine.end();
    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0]!.path).toBe(voiceEndpoints(CONFIGS[variant]).save);
    expect(saves[0]!.body).toEqual({
      chat_id: 41,
      ...scope,
      turns: [
        { role: 'user', text: 'Hi' },
        { role: 'assistant', text: 'Hello! <solution>x = 2</solution>' },
      ],
    });
  });

  it('does not save an empty call, and sends saved-but-unsynced turns as history next time', async () => {
    backend();
    const { engine } = setup();
    let pc = await connect(engine);
    engine.end();
    expect(saves).toHaveLength(0);

    pc = await connect(engine);
    pc.events.emit({ type: 'user_final', text: 'First call' });
    engine.end();
    await waitFor(() => expect(saves).toHaveLength(1));
    await connect(engine);
    expect(starts.at(-1)!.body.history).toEqual([...OPTS.history, { role: 'user', text: 'First call' }]);
    engine.end();

    engine.markHistoryLoaded();
    await connect(engine);
    expect(starts.at(-1)!.body.history).toEqual(OPTS.history);
    engine.dispose();
  });
});

describe('VoiceEngine: failures', () => {
  it.each([
    ['NotAllowedError', 'Microphone is blocked'],
    ['NotFoundError', 'No microphone found'],
    ['NotReadableError', "Couldn't start the microphone"],
  ])('shows the mic error for %s and can retry', async (name, title) => {
    backend();
    fakes.getUserMedia.mockRejectedValueOnce(new DOMException('mic', name));
    const { store, engine } = setup();
    await engine.start(OPTS);
    expect(store.get()).toMatchObject({ phase: 'error', error: { title, retryable: true } });
    expect(starts).toHaveLength(0);

    engine.retry();
    await waitFor(() => expect(FakePeerConnection.last?.remoteDescription).toBeTruthy());
    expect(starts).toHaveLength(1);
    expect(store.get()).toMatchObject({ phase: 'connecting', error: null });
    engine.minimise();
    expect(store.get().screenOpen).toBe(false);
    engine.dispose();
  });

  it('reports a browser without a microphone API', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    const { store, engine } = setup();
    await engine.start(OPTS);
    expect(store.get().error?.title).toBe('No microphone found');
  });

  it('closes quietly on 401 / 429 (handled app-wide) and reports the rest', async () => {
    const limits = vi.fn();
    const off = onApiEvent('rateLimited', limits);
    backend(429);
    const { store, engine } = setup();
    store.set({ screenOpen: true });
    await engine.start(OPTS);
    expect(starts).toHaveLength(1);
    expect(limits).toHaveBeenCalledTimes(1);
    expect(store.get()).toMatchObject({ phase: 'idle', screenOpen: false, error: null });
    expect(FakePeerConnection.last!.closed).toBe(true);
    expect(fakes.streams[0]!.tracks[0]!.stopped).toBe(true);
    off();

    backend(401);
    await engine.start(OPTS);
    expect(store.get()).toMatchObject({ phase: 'idle', error: null });

    backend(404);
    await engine.start(OPTS);
    expect(store.get().error).toEqual({ title: 'Not available yet', message: "Live talk isn't available right now. You can still type your doubt.", retryable: false });

    backend(503);
    await engine.start(OPTS);
    expect(store.get().error?.title).toBe('Live talk is unavailable');

    backend(500);
    await engine.start(OPTS);
    expect(store.get().error).toMatchObject({ title: "Couldn't connect", retryable: true });

    backend(200, {});
    await engine.start(OPTS);
    expect(store.get().error?.title).toBe("Couldn't connect");
  });

  it.each([
    ['lecture', 'for this lecture yet'],
    ['post-assessment', 'for this question yet'],
  ] as const)('404 on %s names the surface', async (variant, where) => {
    backend(404);
    const { store, engine } = setup(CONFIGS[variant]);
    await engine.start(OPTS);
    expect(store.get().error?.message).toContain(where);
  });

  it('drops the call when the connection fails, or stays disconnected', async () => {
    backend();
    const { store, engine } = setup();
    let pc = await connect(engine);
    pc.setConnectionState('failed');
    expect(store.get()).toMatchObject({ phase: 'error', error: { title: 'Connection lost' } });
    expect(pc.closed).toBe(true);

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      pc = await connect(engine);
      pc.setConnectionState('disconnected');
      pc.setConnectionState('connected');
      vi.advanceTimersByTime(6000);
      expect(store.get().phase).toBe('connecting');
      pc.setConnectionState('disconnected');
      vi.advanceTimersByTime(6000);
      expect(store.get().error?.title).toBe('Connection lost');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('VoiceEngine: controls', () => {
  it('asks before the mic prompt unless permission is granted', async () => {
    backend();
    fakes.permission.state = 'prompt';
    const { store, engine } = setup();
    engine.requestStart(OPTS);
    await waitFor(() => expect(store.get().permissionOpen).toBe(true));
    expect(store.get().avatar).toEqual(OPTS.avatar);
    engine.cancelPermission();
    expect(store.get().permissionOpen).toBe(false);
    expect(fakes.getUserMedia).not.toHaveBeenCalled();

    engine.requestStart(OPTS);
    await waitFor(() => expect(store.get().permissionOpen).toBe(true));
    engine.confirmPermission();
    await waitFor(() => expect(starts).toHaveLength(1));

    // Asking again during a call just reopens the screen.
    engine.minimise();
    engine.requestStart(OPTS);
    expect(store.get().screenOpen).toBe(true);
    engine.dispose();
  });

  it('starts straight away when the mic is already allowed, and opens the sheet without a Permissions API', async () => {
    backend();
    const { store, engine } = setup();
    engine.requestStart(OPTS);
    await waitFor(() => expect(starts).toHaveLength(1));
    engine.dispose();

    Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined });
    const other = setup();
    other.engine.requestStart(OPTS);
    expect(other.store.get().permissionOpen).toBe(true);
    expect(store.get().phase).toBe('idle');
  });

  it('mutes the mic, pauses the tutor and reconnects in a new language', async () => {
    backend();
    const { store, engine } = setup();
    const pc = await connect(engine);
    pc.events.emit({ type: 'ready' });
    pc.events.emit({ type: 'user_final', text: 'Explain' });

    engine.toggleMute();
    expect(store.get().muted).toBe(true);
    expect(fakes.streams[0]!.tracks[0]!.enabled).toBe(false);
    engine.toggleMute();
    expect(fakes.streams[0]!.tracks[0]!.enabled).toBe(true);

    // Without the playout worklet, pausing silences the stream.
    pc.ontrack?.({ track: { kind: 'audio' }, streams: [] });
    engine.toggleTutorAudio();
    expect(store.get().tutorPaused).toBe(true);
    engine.toggleTutorAudio();
    expect(store.get().tutorPaused).toBe(false);

    engine.setLanguage('hindi');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('hindi');
    expect(pc.closed).toBe(true);
    await waitFor(() => expect(starts).toHaveLength(2));
    expect(starts[1]!.body).toMatchObject({ language: 'hindi', history: [...OPTS.history, { role: 'user', text: 'Explain' }] });
    // The same call goes on: transcript kept.
    expect(store.get().turns).toEqual([{ role: 'user', text: 'Explain' }]);
    engine.setLanguage('hindi');
    expect(starts).toHaveLength(2);

    engine.openScreen();
    engine.dismissSummary();
    engine.dispose();
    expect(FakePeerConnection.last!.closed).toBe(true);
    await waitFor(() => expect(saves).toHaveLength(1));
  });

  it('holds the tutor\'s voice in the playout worklet while paused, then finishes the answer before "Your turn"', async () => {
    const posted: unknown[] = [];
    class FakeWorkletNode {
      port = { postMessage: (message: unknown) => posted.push(message), onmessage: null as ((event: { data: unknown }) => void) | null };
      connect = vi.fn();
    }
    vi.stubGlobal('AudioWorkletNode', FakeWorkletNode);
    const addModule = vi.fn(async () => undefined);
    Object.defineProperty(FakeAudioContext.prototype, 'audioWorklet', { configurable: true, get: () => ({ addModule }) });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:worklet') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    try {
      backend();
      const { store, engine } = setup();
      const pc = await connect(engine);
      expect(addModule).toHaveBeenCalledWith('blob:worklet');
      pc.ontrack?.({ track: { kind: 'audio' }, streams: [new MediaStream()] });
      pc.ontrack?.({ track: { kind: 'video' }, streams: [] });
      pc.events.emit({ type: 'ready' });
      pc.events.emit({ type: 'state', value: 'speaking' });
      pc.events.emit({ type: 'bot_delta', text: 'One. Two.' });

      engine.toggleTutorAudio();
      expect(posted).toContainEqual({ type: 'pause', paused: true });
      expect(store.get().tutorPaused).toBe(true);
      // The server is done but the student hasn't heard it all: keep "answering".
      pc.events.emit({ type: 'state', value: 'listening' });
      expect(store.get().phase).toBe('answering');
      engine.toggleTutorAudio();
      const node = (engine as unknown as { playout: FakeWorkletNode }).playout;
      node.port.onmessage?.({ data: { type: 'backlog', value: false } });
      expect(store.get().phase).toBe('listening');

      // A new answer (or the student cutting in) drops held audio.
      engine.toggleTutorAudio();
      pc.events.emit({ type: 'bot_start', text: 'Next' });
      expect(posted).toContainEqual({ type: 'flush' });
      expect(store.get().tutorPaused).toBe(false);
      engine.dispose();
    } finally {
      delete (FakeAudioContext.prototype as { audioWorklet?: unknown }).audioWorklet;
    }
  });

  it('stops the mic when the surface goes away while the mic prompt is open', async () => {
    let release: (stream: MediaStream) => void = () => undefined;
    fakes.getUserMedia.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const { store, engine } = setup();
    const starting = engine.start(OPTS);
    engine.dispose();
    const track = { stop: vi.fn() };
    release({ getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream);
    await starting;
    expect(track.stop).toHaveBeenCalled();
    expect(FakePeerConnection.instances).toHaveLength(0);
    expect(store.get().phase).toBe('idle');
  });
});
