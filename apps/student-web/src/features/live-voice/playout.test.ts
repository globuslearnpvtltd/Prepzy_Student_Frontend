import { createTutorPlayout, loadTutorPlayout } from './playout';

const ctx = (overrides: Record<string, unknown> = {}) =>
  ({
    state: 'running',
    audioWorklet: { addModule: vi.fn(async () => undefined) },
    resume: vi.fn(async () => undefined),
    ...overrides,
  }) as unknown as AudioContext;

describe('tutor playout worklet', () => {
  const original = globalThis.AudioWorkletNode;
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:playout');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    globalThis.AudioWorkletNode = original;
  });

  it('is unavailable without a context or AudioWorklet support', async () => {
    expect(await loadTutorPlayout(null)).toBe(false);
    globalThis.AudioWorkletNode = undefined as unknown as typeof AudioWorkletNode;
    expect(await loadTutorPlayout(ctx())).toBe(false);
  });

  it('loads the processor and reports whether the context runs; a failed load counts as unavailable', async () => {
    globalThis.AudioWorkletNode = class {} as unknown as typeof AudioWorkletNode;
    expect(await loadTutorPlayout(ctx())).toBe(true);
    expect(await loadTutorPlayout(ctx({ state: 'suspended' }))).toBe(false);
    const failing = ctx({ audioWorklet: { addModule: vi.fn(async () => Promise.reject(new Error('blocked'))) } });
    expect(await loadTutorPlayout(failing)).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  it('wires the stream through the node, or returns null when the node cannot be created', () => {
    const connect = vi.fn();
    const nodeConnect = vi.fn();
    globalThis.AudioWorkletNode = vi.fn(function (this: { connect: typeof nodeConnect }) {
      this.connect = nodeConnect;
    }) as unknown as typeof AudioWorkletNode;
    const audio = ctx({ createMediaStreamSource: () => ({ connect }), destination: 'out' });
    const node = createTutorPlayout(audio, {} as MediaStream);
    expect(node).not.toBeNull();
    expect(connect).toHaveBeenCalledWith(node);
    expect(nodeConnect).toHaveBeenCalledWith('out');

    globalThis.AudioWorkletNode = vi.fn(function () {
      throw new Error('no processor');
    }) as unknown as typeof AudioWorkletNode;
    expect(createTutorPlayout(audio, {} as MediaStream)).toBeNull();
  });
});
