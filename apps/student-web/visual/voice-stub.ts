/**
 * Browser stub for live voice screenshots (VOICE_STUB=<mode> with compare.spec.ts). Headless browsers can't
 * hold a real WebRTC call, so this grants the mic, hands out a silent stream and fakes the peer connection.
 * After the (mocked) SDP answer it plays a script of data-channel events:
 *   connecting  — nothing (stays on "Getting ready")
 *   listening   — ready ("Your turn")
 *   answering   — ready, a question and the start of an answer ("… is explaining")
 * Runs inside the page (page.addInitScript), so it must be self-contained.
 */
export function voiceStub(mode: string) {
  const w = window as unknown as Record<string, unknown>;
  const perms = navigator.permissions;
  if (perms) {
    const query = perms.query.bind(perms);
    perms.query = (desc: PermissionDescriptor) =>
      desc.name === ('microphone' as PermissionName) ? Promise.resolve({ state: 'granted' } as PermissionStatus) : query(desc);
  }
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext();
      return ctx.createMediaStreamDestination().stream;
    };
  }
  const script: Record<string, object[]> = {
    connecting: [],
    listening: [{ type: 'ready' }],
    answering: [
      { type: 'ready' },
      { type: 'user_final', text: 'Why is the sky blue?' },
      { type: 'state', value: 'thinking' },
      { type: 'bot_start' },
      { type: 'state', value: 'speaking' },
      { type: 'bot_delta', text: 'Sunlight is scattered by the tiny molecules of air. Blue light has a shorter wavelength, so it is scattered much more than red light, and that scattered blue light reaches your eyes from every part of the sky.' },
    ],
  };
  class StubChannel {
    label: string;
    onmessage: ((event: { data: string }) => void) | null = null;
    constructor(label: string) {
      this.label = label;
    }
    close() {}
    send() {}
  }
  class StubPeerConnection {
    iceGatheringState = 'complete';
    connectionState = 'connected';
    localDescription: { sdp: string; type: string } | null = null;
    ondatachannel: unknown = null;
    ontrack: unknown = null;
    onconnectionstatechange: unknown = null;
    channel: StubChannel | null = null;
    addTrack() {}
    addEventListener() {}
    removeEventListener() {}
    createDataChannel(label: string) {
      this.channel = new StubChannel(label);
      return this.channel;
    }
    async createOffer() {
      return { type: 'offer', sdp: 'v=0 stub' };
    }
    async setLocalDescription(desc: { sdp: string; type: string }) {
      this.localDescription = desc;
    }
    async setRemoteDescription() {
      (script[mode] ?? []).forEach((event, i) => setTimeout(() => this.channel?.onmessage?.({ data: JSON.stringify(event) }), 300 + i * 150));
    }
    close() {}
  }
  w.RTCPeerConnection = StubPeerConnection;
}
