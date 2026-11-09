import { vi } from 'vitest';

/**
 * Browser media fakes for live voice tests: RTCPeerConnection (+ data channel), getUserMedia,
 * AudioContext, <audio> and the Permissions API. `installVoiceFakes()` stubs them on the globals.
 */

export class FakeTrack {
  kind = 'audio';
  enabled = true;
  stopped = false;
  stop = vi.fn(() => {
    this.stopped = true;
  });
}

export class FakeStream {
  tracks = [new FakeTrack()];
  getTracks = () => this.tracks;
  getAudioTracks = () => this.tracks;
}

export class FakeDataChannel {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;
  constructor(public label: string) {}
  close() {
    this.closed = true;
  }
  /** Delivers one server event to the page. */
  emit(event: object) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

export class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  static get last() {
    return FakePeerConnection.instances.at(-1) ?? null;
  }
  iceGatheringState = 'complete';
  connectionState = 'new';
  localDescription: { sdp: string; type: string } | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  channels: FakeDataChannel[] = [];
  tracks: FakeTrack[] = [];
  closed = false;
  ondatachannel: ((event: { channel: FakeDataChannel }) => void) | null = null;
  ontrack: ((event: { track: { kind: string }; streams: unknown[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  constructor(public config: RTCConfiguration) {
    FakePeerConnection.instances.push(this);
  }
  addTrack(track: FakeTrack) {
    this.tracks.push(track);
  }
  createDataChannel(label: string) {
    const channel = new FakeDataChannel(label);
    this.channels.push(channel);
    return channel;
  }
  addEventListener() {}
  removeEventListener() {}
  async createOffer() {
    return { type: 'offer', sdp: 'offer-sdp' };
  }
  async setLocalDescription(description: { sdp: string; type: string }) {
    this.localDescription = description;
  }
  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescription = description;
  }
  close() {
    this.closed = true;
  }
  /** The "events" channel the page opened. */
  get events() {
    return this.channels.find((c) => c.label === 'events')!;
  }
  setConnectionState(state: string) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

class FakeNode {
  connect = vi.fn();
}

export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = 'running';
  closed = false;
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createAnalyser() {
    return Object.assign(new FakeNode(), { fftSize: 0, getByteTimeDomainData: (buf: Uint8Array) => buf.fill(128) });
  }
  createMediaStreamSource() {
    return new FakeNode();
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    this.closed = true;
    return Promise.resolve();
  }
}

export class FakeAudioElement {
  autoplay = false;
  muted = false;
  srcObject: unknown = null;
  paused = true;
  constructor(public src?: string) {}
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

export interface VoiceFakes {
  getUserMedia: ReturnType<typeof vi.fn>;
  permission: { state: PermissionState };
  streams: FakeStream[];
}

/** Stubs the browser media APIs; mic permission starts as "granted" unless given. */
export function installVoiceFakes(state: PermissionState = 'granted'): VoiceFakes {
  FakePeerConnection.instances = [];
  FakeAudioContext.instances = [];
  const streams: FakeStream[] = [];
  const getUserMedia = vi.fn(async () => {
    const stream = new FakeStream();
    streams.push(stream);
    return stream;
  });
  const permission = { state };
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('Audio', FakeAudioElement);
  vi.stubGlobal('MediaStream', FakeStream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: vi.fn(async () => ({ state: permission.state })) } });
  return { getUserMedia, permission, streams };
}

export function removeVoiceFakes() {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined });
}
