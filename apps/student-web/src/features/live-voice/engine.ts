import { CONNECTION_LOST, liveVoiceApi, micErrorInfo, startErrorInfo } from './api';
import { createTutorPlayout, loadTutorPlayout } from './playout';
import { LANGUAGE_STORAGE_KEY, type VoiceStore } from './store';
import { splitReply, tokenizeSpoken } from './text';
import type { StartVoiceOptions, VoiceConfig, VoiceErrorInfo, VoiceLanguage, VoicePhase, VoiceReply, VoiceServerEvent, VoiceTurn } from './types';

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
const ICE_GATHER_TIMEOUT_MS = 2500;
/** Flaky mobile networks get this long to recover from "disconnected" before the call is dropped. */
const DISCONNECT_GRACE_MS = 5000;

function waitForIceGathering(pc: RTCPeerConnection) {
  return new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const timer = setTimeout(done, ICE_GATHER_TIMEOUT_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

// Inferred rather than annotated: a bare `Uint8Array` is Uint8Array<ArrayBufferLike>, which
// AnalyserNode.getByteTimeDomainData rejects on TS 5.7+.
const createByteBuffer = (size: number) => new Uint8Array(size);
type Analyser = { node: AnalyserNode; buf: ReturnType<typeof createByteBuffer> };

function rms(analyser: Analyser | null) {
  if (!analyser) return 0;
  analyser.node.getByteTimeDomainData(analyser.buf);
  let sum = 0;
  for (let i = 0; i < analyser.buf.length; i++) {
    const v = (analyser.buf[i]! - 128) / 128;
    sum += v * v;
  }
  // Speech RMS rarely passes ~0.3; scale into a 0..1 range the animations can use.
  return Math.min(1, Math.sqrt(sum / analyser.buf.length) * 4);
}

const parseEvent = (data: unknown): VoiceServerEvent | null => {
  try {
    const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
    const event: unknown = JSON.parse(text);
    return event && typeof event === 'object' && 'type' in event ? (event as VoiceServerEvent) : null;
  } catch {
    return null;
  }
};

/**
 * One tutor's live voice call: mic, WebRTC peer connection, data-channel events, levels, transcript and
 * saving it. State goes to the store the screens read; loaded on demand (see LiveVoiceProvider).
 */
export class VoiceEngine {
  private session = 0;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private micAnalyser: Analyser | null = null;
  private botAnalyser: Analyser | null = null;
  private raf: number | null = null;
  private clock: ReturnType<typeof setInterval> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectedAt: number | null = null;
  private replyCounter = 0;
  private replyRef: VoiceReply | null = null;
  private turnsRef: VoiceTurn[] = [];
  private pendingStart: StartVoiceOptions | null = null;
  private lastStart: StartVoiceOptions | null = null;
  private chatId: number | null = null;
  /** Voice turns saved since the chat last loaded its messages; still needed as history for the next call. */
  private unsyncedTurns: VoiceTurn[] = [];
  private savePending = false;
  private segmentWords = 0;
  private playout: AudioWorkletNode | null = null;
  private tutorPausedRef = false;
  /** Paused, or still playing audio held during a pause. */
  private playoutBacklog = false;
  /** The server finished speaking while held audio was still to play; switch to "Your turn" once it has. */
  private pendingListening = false;

  constructor(
    private readonly store: VoiceStore,
    private readonly getConfig: () => VoiceConfig,
  ) {}

  private get phase() {
    return this.store.get().phase;
  }

  private setPhase(phase: VoicePhase) {
    this.store.set({ phase });
  }

  /* ------------------------------------------ audio ------------------------------------------ */

  private attachAnalyser(source: MediaStream | AudioNode, target: 'mic' | 'bot') {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
      }
      const ctx = this.ctx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
      const node = ctx.createAnalyser();
      node.fftSize = 512;
      (source instanceof MediaStream ? ctx.createMediaStreamSource(source) : source).connect(node);
      const analyser = { node, buf: createByteBuffer(node.fftSize) };
      if (target === 'mic') this.micAnalyser = analyser;
      else this.botAnalyser = analyser;
    } catch {
      // No Web Audio: the call still works, the animations just stay calm.
    }
  }

  private startMeterLoop() {
    if (typeof requestAnimationFrame === 'undefined') return;
    const tick = () => {
      this.store.meters.levels = { mic: rms(this.micAnalyser), bot: rms(this.botAnalyser) };
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private teardown() {
    if (this.raf !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.clock) clearInterval(this.clock);
    this.clock = null;
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
    try {
      this.dc?.close();
    } catch {
      /* already closed */
    }
    try {
      this.pc?.close();
    } catch {
      /* already closed */
    }
    this.dc = null;
    this.pc = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.srcObject = null;
    }
    this.audioEl = null;
    if (this.playout) this.playout.port.onmessage = null;
    this.playout = null;
    this.tutorPausedRef = false;
    this.playoutBacklog = false;
    this.pendingListening = false;
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.micAnalyser = null;
    this.botAnalyser = null;
    this.store.meters.levels = { mic: 0, bot: 0 };
  }

  private setTutorAudioPaused(paused: boolean) {
    this.tutorPausedRef = paused;
    if (this.playout) {
      this.playout.port.postMessage({ type: 'pause', paused });
      // The worklet confirms asynchronously; don't let a "listening" event slip in before it does.
      if (paused) this.playoutBacklog = true;
      else this.ctx?.resume().catch(() => undefined);
    } else if (this.audioEl) {
      // No playout worklet: the best we can do is silence the live stream.
      this.audioEl.muted = paused;
    }
    this.store.set({ tutorPaused: paused });
  }

  /** Drop audio held from a pause (the student cut in, or a new answer started) and play live again. */
  private stopHeldTutorAudio() {
    this.playout?.port.postMessage({ type: 'flush' });
    this.pendingListening = false;
    if (this.tutorPausedRef || this.store.get().tutorPaused) this.setTutorAudioPaused(false);
  }

  /* ------------------------------------------ events ------------------------------------------ */

  private pushTurn(turn: VoiceTurn) {
    this.turnsRef = [...this.turnsRef, turn];
    this.store.set({ turns: this.turnsRef });
  }

  private newReply(): VoiceReply {
    const id = ++this.replyCounter;
    this.store.meters.wordTiming = { replyId: id, anchors: [] };
    this.segmentWords = 0;
    return { id, text: '', figure: null };
  }

  private setReply(reply: VoiceReply | null) {
    this.replyRef = reply;
    this.store.set({ reply });
  }

  private finishReply(interrupted: boolean) {
    const reply = this.replyRef;
    this.replyRef = null;
    // The text usually arrives before the audio finishes, so a completed reply stays on screen for the
    // word highlighter until the student speaks or the next reply starts.
    this.store.set({ reply: reply && !interrupted ? { ...reply, done: true } : null });
    if (!reply) return;
    this.store.set({ lastReply: reply });
    if (reply.text.trim()) this.pushTurn({ role: 'assistant', text: reply.text.trim(), image: reply.figure?.url, interrupted });
  }

  /** Timings can still arrive after bot_end (the audio lags the text), so they go to the latest reply. */
  private addTimingAnchor(index: number, ms: number) {
    if (!Number.isFinite(index) || !Number.isFinite(ms) || index < 0 || ms < 0) return;
    const timing = this.store.meters.wordTiming;
    if (timing.replyId !== this.replyCounter) return;
    const anchors = timing.anchors.filter((a) => a.index !== index);
    anchors.push({ index: Math.floor(index), ms });
    anchors.sort((a, b) => a.ms - b.ms);
    this.store.meters.wordTiming = { replyId: timing.replyId, anchors };
  }

  /** The live text only renders while answering; don't depend on a "speaking" state event arriving first. */
  private showAnswering() {
    if (this.phase === 'thinking' || this.phase === 'endturn') this.setPhase('answering');
  }

  /** Applies one data-channel event (public for tests). */
  handleEvent(event: VoiceServerEvent) {
    switch (event.type) {
      case 'ready':
        // A language switch reconnects mid-call; the call clock keeps running.
        if (!this.connectedAt) {
          this.connectedAt = Date.now();
          this.store.set({ elapsed: 0 });
        }
        if (!this.clock) {
          this.clock = setInterval(() => {
            if (this.connectedAt) this.store.set({ elapsed: Math.floor((Date.now() - this.connectedAt) / 1000) });
          }, 1000);
        }
        this.setPhase('listening');
        break;
      case 'state':
        if (event.value === 'thinking') this.setPhase('thinking');
        else if (event.value === 'speaking') this.setPhase('answering');
        else if (event.value === 'listening') {
          // The server is done, but the student is still hearing (or has paused) the answer.
          if (this.phase === 'answering' && this.playoutBacklog) {
            this.pendingListening = true;
            break;
          }
          // Don't drop the live caption if the student is already mid-sentence.
          if (this.phase !== 'speaking' && this.phase !== 'interrupted') this.setPhase('listening');
        }
        break;
      case 'user_interim':
        // Student cut in: whatever the tutor had left to say is dropped.
        this.stopHeldTutorAudio();
        // Talking again: drop a finished answer that was only kept on screen.
        if (!this.replyRef) this.store.set({ reply: null });
        this.store.set({ interimText: event.text || '' });
        this.setPhase(this.phase === 'answering' || this.phase === 'interrupted' ? 'interrupted' : 'speaking');
        break;
      case 'user_final': {
        if (!this.replyRef) this.store.set({ reply: null });
        const text = event.text?.trim();
        if (text) {
          this.pushTurn({ role: 'user', text });
          this.store.set({ lastUserText: text });
        }
        this.store.set({ interimText: '' });
        this.setPhase('endturn');
        break;
      }
      case 'bot_start':
        if (this.replyRef) this.finishReply(true);
        this.setReply({ ...this.newReply(), text: event.text || '' });
        if (event.text) this.showAnswering();
        // A pause only holds that answer; the next one plays.
        this.stopHeldTutorAudio();
        break;
      case 'figure':
        this.setReply({ ...(this.replyRef ?? this.newReply()), figure: { number: event.number, url: event.url } });
        break;
      case 'bot_delta': {
        const reply = this.replyRef ?? this.newReply();
        this.setReply({ ...reply, text: reply.text + (event.text || '') });
        if (event.text) this.showAnswering();
        break;
      }
      case 'bot_end':
        // Full reply text on bot_end replaces whatever (if anything) was streamed.
        if (event.text?.trim()) {
          this.replyRef = { ...(this.replyRef ?? this.newReply()), text: event.text };
          this.showAnswering();
        }
        this.finishReply(!!event.interrupted);
        break;
      case 'bot_word':
        this.addTimingAnchor(event.index, event.start_ms);
        break;
      case 'bot_segment': {
        const start = event.index ?? this.segmentWords;
        const words = tokenizeSpoken(splitReply(event.text || '').spoken).length;
        this.segmentWords = start + words;
        if (words > 0) this.addTimingAnchor(start, event.start_ms);
        break;
      }
      default:
        break;
    }
  }

  private attachDataChannel(dc: RTCDataChannel, session: number) {
    if (dc.label !== 'events') return;
    this.dc = dc;
    dc.onmessage = (message: MessageEvent) => {
      if (session !== this.session) return;
      const event = parseEvent(message.data);
      if (event) this.handleEvent(event);
    };
  }

  private fail(info: VoiceErrorInfo | null) {
    this.session++;
    this.teardown();
    this.replyRef = null;
    this.store.set({ interimText: '', reply: null });
    if (!info) {
      this.store.set({ phase: 'idle', screenOpen: false });
      return;
    }
    this.store.set({ error: info, phase: 'error' });
  }

  /* ------------------------------------------ calls ------------------------------------------ */

  /** resume: reconnect within the same call (language switch), keeping its transcript and clock. */
  async start(opts: StartVoiceOptions, resume = false): Promise<void> {
    if (this.pc) return;
    const session = ++this.session;
    this.lastStart = opts;
    this.chatId = opts.chatId;
    if (opts.avatar) this.store.set({ avatar: opts.avatar });
    if (!resume) {
      this.turnsRef = [];
      this.connectedAt = null;
      this.store.set({ turns: [], lastReply: null, lastUserText: '', elapsed: 0, lastSession: null });
    }
    this.replyRef = null;
    this.store.set({ reply: null, interimText: '', error: null, muted: false, tutorPaused: false, screenOpen: true, phase: 'connecting', engaged: true });

    let stream: MediaStream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('No microphone', 'NotFoundError');
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (error) {
      if (session === this.session) this.fail(micErrorInfo(error));
      return;
    }
    if (session !== this.session) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    try {
      this.stream = stream;
      this.attachAnalyser(stream, 'mic');
      const playoutReady = await loadTutorPlayout(this.ctx);
      if (session !== this.session) return;

      const audioEl = new Audio();
      audioEl.autoplay = true;
      this.audioEl = audioEl;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      this.pc = pc;
      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));
      this.attachDataChannel(pc.createDataChannel('events', { ordered: true }), session);
      pc.ondatachannel = (event) => this.attachDataChannel(event.channel, session);

      pc.ontrack = (event) => {
        if (session !== this.session || event.track.kind !== 'audio') return;
        const remote = event.streams[0] ?? new MediaStream([event.track]);
        audioEl.srcObject = remote;
        const ctx = this.ctx;
        const playout = playoutReady && ctx && !this.playout ? createTutorPlayout(ctx, remote) : null;
        if (playout) {
          // The worklet plays the voice. The element stays attached (muted) because Chrome only feeds a
          // remote WebRTC stream into Web Audio while a media element is consuming it.
          audioEl.muted = true;
          playout.port.onmessage = (message: MessageEvent<{ type?: string; value?: boolean }>) => {
            if (session !== this.session || message.data?.type !== 'backlog') return;
            this.playoutBacklog = !!message.data.value;
            if (!message.data.value && this.pendingListening) {
              this.pendingListening = false;
              if (this.phase === 'answering') this.setPhase('listening');
            }
          };
          this.playout = playout;
          // Measure what the student actually hears, so the word highlight follows held audio.
          this.attachAnalyser(playout, 'bot');
        } else {
          this.attachAnalyser(remote, 'bot');
        }
        audioEl.play().catch(() => undefined);
      };

      pc.onconnectionstatechange = () => {
        if (session !== this.session) return;
        if (pc.connectionState === 'failed') {
          this.fail(CONNECTION_LOST);
        } else if (pc.connectionState === 'disconnected') {
          if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
          this.disconnectTimer = setTimeout(() => {
            if (this.pc === pc && pc.connectionState !== 'connected') this.fail(CONNECTION_LOST);
          }, DISCONNECT_GRACE_MS);
        } else if (pc.connectionState === 'connected' && this.disconnectTimer) {
          clearTimeout(this.disconnectTimer);
          this.disconnectTimer = null;
        }
      };

      await pc.setLocalDescription(await pc.createOffer());
      await waitForIceGathering(pc);
      if (session !== this.session || !pc.localDescription) return;

      const history = [...opts.history, ...this.unsyncedTurns, ...(resume ? this.turnsRef : [])];
      const answer = await liveVoiceApi.start(this.getConfig(), {
        offer: { sdp: pc.localDescription.sdp, type: pc.localDescription.type },
        language: this.store.get().language,
        history,
      });
      if (session !== this.session) return;
      await pc.setRemoteDescription(answer);
      this.startMeterLoop();
    } catch (error) {
      if (session !== this.session) return;
      this.fail(startErrorInfo(error, this.getConfig().variant));
    }
  }

  /** Opens the mic explainer first unless the browser already has mic permission. */
  requestStart(opts: StartVoiceOptions) {
    this.store.set({ engaged: true });
    if (this.pc || this.isActive()) {
      this.store.set({ screenOpen: true });
      return;
    }
    if (opts.avatar) this.store.set({ avatar: opts.avatar });
    this.pendingStart = opts;
    const permissions = typeof navigator !== 'undefined' ? navigator.permissions : undefined;
    if (!permissions?.query) {
      this.store.set({ permissionOpen: true });
      return;
    }
    permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        if (this.pendingStart !== opts) return;
        if (status.state === 'granted') {
          this.pendingStart = null;
          void this.start(opts);
        } else {
          this.store.set({ permissionOpen: true });
        }
      })
      .catch(() => this.store.set({ permissionOpen: true }));
  }

  confirmPermission() {
    this.store.set({ permissionOpen: false });
    const opts = this.pendingStart;
    this.pendingStart = null;
    if (opts) void this.start(opts);
  }

  cancelPermission() {
    this.pendingStart = null;
    this.store.set({ permissionOpen: false });
  }

  retry() {
    const opts = this.lastStart;
    this.session++;
    this.teardown();
    if (opts) void this.start(opts);
  }

  private isActive() {
    const phase = this.phase;
    return phase !== 'idle' && phase !== 'error';
  }

  private async saveSession(turns: VoiceTurn[], durationSec: number) {
    this.store.set({ lastSession: { durationSec, turns, saved: false } });
    this.unsyncedTurns = [...this.unsyncedTurns, ...turns];
    this.savePending = true;
    try {
      const id = await liveVoiceApi.save(this.getConfig(), this.chatId, turns);
      this.store.set((state) => ({
        savedChatId: id,
        lastSession: state.lastSession && state.lastSession.turns === turns ? { ...state.lastSession, saved: true } : state.lastSession,
      }));
    } catch {
      // The turns stay in this session's history and on screen; nothing else to do.
    } finally {
      this.savePending = false;
    }
  }

  /** Hangs up and saves the transcript (also used when the surface unmounts). */
  end() {
    // Keep a half-finished answer if the student hangs up mid-reply.
    if (this.replyRef) this.finishReply(true);
    const turns = this.turnsRef;
    const durationSec = this.connectedAt ? Math.floor((Date.now() - this.connectedAt) / 1000) : 0;
    this.connectedAt = null;
    this.pendingStart = null;
    this.session++;
    this.teardown();
    this.store.set({ reply: null, interimText: '', error: null, screenOpen: false, permissionOpen: false, phase: 'idle' });
    if (turns.length) void this.saveSession(turns, durationSec);
    this.turnsRef = [];
  }

  toggleMute() {
    const muted = !this.store.get().muted;
    this.stream?.getAudioTracks().forEach((track) => (track.enabled = !muted));
    this.store.set({ muted });
  }

  toggleTutorAudio() {
    this.setTutorAudioPaused(!this.tutorPausedRef);
  }

  minimise() {
    if (this.phase === 'error') this.store.set({ error: null, phase: 'idle' });
    this.store.set({ screenOpen: false });
  }

  openScreen() {
    this.store.set({ screenOpen: true });
  }

  /** The service only takes the language when a call connects, so a live call reconnects in the new one. */
  setLanguage(language: VoiceLanguage) {
    const changed = language !== this.store.get().language;
    this.store.set({ language });
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      /* storage unavailable */
    }
    const opts = this.lastStart;
    if (!changed || !this.pc || !opts) return;
    if (this.replyRef) this.finishReply(true);
    this.session++;
    this.teardown();
    void this.start(opts, true);
  }

  /** The chat reloaded from the server, so saved voice turns are part of its messages now. */
  markHistoryLoaded() {
    // If the save is still in flight, the reload didn't include these turns; keep them for history.
    if (!this.savePending) this.unsyncedTurns = [];
  }

  dismissSummary() {
    this.store.set({ lastSession: null });
  }

  /** The surface is going away: hang up (saving the transcript) and release everything. */
  dispose() {
    if (this.pc || this.isActive() || this.turnsRef.length) this.end();
    else {
      this.session++;
      this.teardown();
    }
  }
}
