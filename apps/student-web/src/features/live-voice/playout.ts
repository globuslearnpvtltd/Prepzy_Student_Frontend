// The tutor's voice is a live WebRTC stream: the server keeps sending audio whatever the page does, so
// muting the player can't pause her. This worklet sits between the stream and the speakers and holds the
// audio while paused, then plays it on from where she stopped. With nothing held it passes the stream
// straight through, so normal playback has no extra delay.
const PROCESSOR_SOURCE = `
const SILENT_RMS = 0.004;

class TutorPlayout extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.head = 0;
    this.paused = false;
    this.backlog = false;
    this.silentRun = 0;
    this.maxFrames = Math.ceil((sampleRate * 180) / 128);
    this.keepSilentFrames = Math.ceil((sampleRate * 0.35) / 128);
    this.port.onmessage = (e) => {
      if (e.data.type === "pause") this.paused = e.data.paused;
      else if (e.data.type === "flush") this.clear();
    };
  }

  clear() {
    this.queue = [];
    this.head = 0;
    this.silentRun = 0;
  }

  next() {
    let frame = null;
    while (this.head < this.queue.length) {
      const f = this.queue[this.head++];
      let sum = 0;
      for (let i = 0; i < f.length; i++) sum += f[i] * f[i];
      const silent = Math.sqrt(sum / f.length) < SILENT_RMS;
      this.silentRun = silent ? this.silentRun + 1 : 0;
      if (!silent || this.silentRun <= this.keepSilentFrames) {
        frame = f;
        break;
      }
    }
    if (this.head >= this.queue.length) this.clear();
    else if (this.head > 2048) {
      this.queue = this.queue.slice(this.head);
      this.head = 0;
    }
    return frame;
  }

  process(inputs, outputs) {
    const input = inputs[0] && inputs[0][0];
    const queued = this.queue.length - this.head;
    let frame = null;
    if (this.paused || queued > 0) {
      if (input && queued < this.maxFrames) this.queue.push(input.slice());
      if (!this.paused) frame = this.next();
    } else {
      frame = input || null;
    }
    for (const ch of outputs[0]) {
      if (frame) ch.set(frame);
      else ch.fill(0);
    }
    const backlog = this.paused || this.queue.length - this.head > 0;
    if (backlog !== this.backlog) {
      this.backlog = backlog;
      this.port.postMessage({ type: "backlog", value: backlog });
    }
    return true;
  }
}

registerProcessor("tutor-playout", TutorPlayout);
`;

/** false when the browser can't run it; the caller then plays the stream directly (pause = mute). */
export async function loadTutorPlayout(ctx: AudioContext | null): Promise<boolean> {
  if (!ctx?.audioWorklet || typeof AudioWorkletNode === 'undefined') return false;
  const url = URL.createObjectURL(new Blob([PROCESSOR_SOURCE], { type: 'application/javascript' }));
  try {
    await ctx.audioWorklet.addModule(url);
    // A context created after an await can stay suspended on mobile; the tutor would be silent then.
    await Promise.race([ctx.resume(), new Promise((resolve) => setTimeout(resolve, 1000))]);
    return ctx.state === 'running';
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function createTutorPlayout(ctx: AudioContext, stream: MediaStream): AudioWorkletNode | null {
  try {
    const node = new AudioWorkletNode(ctx, 'tutor-playout', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    ctx.createMediaStreamSource(stream).connect(node);
    node.connect(ctx.destination);
    return node;
  } catch {
    return null;
  }
}
