import type { Player } from '../network/protocol.ts';
import type { IceServer, VoicePayload, VoiceSignal, VoiceSnapshot, VoiceState } from './protocol.ts';
import { MAX_VOICE_MEMBERS, proximityGain } from './proximity.ts';

export type VoiceUI = {
  active: boolean; microphone: boolean; busy: boolean;
  nearby: number; connected: number; message: string; speakers: Set<string>; levels: Record<string, number>;
};
type Options = {
  sendState: (state: VoiceState) => void;
  sendSignal: (to: string, session: string, payload: VoicePayload) => void;
  notify: (state: VoiceUI) => void;
  // Dependency injection is used by the dev-only synthetic audio test page.
  getMicrophone?: (context: AudioContext) => Promise<MediaStream>;
  audioDestination?: (context: AudioContext) => AudioNode;
};
type Peer = {
  id: string; session: string; pc: RTCPeerConnection; initiator: boolean;
  gain?: GainNode; source?: MediaStreamAudioSourceNode; analyser?: AnalyserNode;
  element?: HTMLAudioElement; candidates: RTCIceCandidateInit[];
  queue: Promise<void>; retries: number; retryTimer?: number; negotiating: boolean;
};

export class ProximityVoice {
  private options: Options;
  private context?: AudioContext;
  private stream?: MediaStream;
  private peers = new Map<string, Peer>();
  private players = new Map<string, Player>();
  private id?: string;
  private iceServers: IceServer[] = [];
  private active = false;
  private microphone = false;
  private busy = false;
  private online = false;
  private disposed = false;
  private generation = 0;
  private notice = '';
  private meterTimer?: number;
  private speakers = new Set<string>();
  private limited = false;

  constructor(options: Options) { this.options = options; }

  setConnected(online: boolean): void {
    this.online = online;
    if (!online && (this.active || this.busy)) this.stop('接続が切れたため音声を終了しました。再接続後に参加し直せます。');
    this.notify();
  }

  setWorld(id: string | undefined, players: Map<string, Player>, changedId?: string): void {
    this.id = id;
    this.players = players;
    for (const peer of this.peers.values()) {
      if (!changedId || changedId === id || changedId === peer.id) this.setGain(peer);
    }
  }

  async start(): Promise<void> {
    if (this.active || this.busy || !this.online || this.disposed) return;
    if (!window.isSecureContext || !window.RTCPeerConnection || !window.AudioContext) {
      this.notice = '音声には対応ブラウザーと、HTTPSまたはlocalhostでの接続が必要です。';
      this.notify(); return;
    }
    const generation = ++this.generation;
    this.busy = true; this.notice = ''; this.notify();
    try {
      const context = this.context = new AudioContext();
      await context.resume();
      if (generation !== this.generation || this.disposed || !this.online) { void context.close().catch(() => {}); return; }
      this.active = true;
      this.meterTimer = window.setInterval(() => this.notify(), 200);
      this.options.sendState({ listening: true, microphone: false });
    } catch { if (generation === this.generation) this.stop('音声を開始できませんでした。もう一度お試しください。'); }
    finally { if (generation === this.generation) { this.busy = false; this.notify(); } }
  }

  async toggleMicrophone(): Promise<void> {
    if (!this.active || this.busy) return;
    if (this.microphone) { this.mute(); return; }
    const generation = this.generation;
    this.busy = true; this.notice = ''; this.notify();
    try {
      const stream = this.options.getMicrophone
        ? await this.options.getMicrophone(this.context!)
        : await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false,
        });
      if (generation !== this.generation || !this.active || this.disposed) {
        stream.getTracks().forEach((track) => track.stop()); return;
      }
      const track = stream.getAudioTracks()[0];
      if (!track) { stream.getTracks().forEach((item) => item.stop()); throw new Error('No microphone track'); }
      this.stream = stream;
      this.microphone = true;
      track.addEventListener('ended', () => { if (this.stream === stream) this.mute('マイクが切断されました。接続してもう一度ONにしてください。'); });
      await Promise.all([...this.peers.values()].map((peer) => this.attachMicrophone(peer)));
      if (generation === this.generation && this.active && this.stream === stream) {
        this.options.sendState({ listening: true, microphone: true });
      }
    } catch (error) {
      if (generation === this.generation && this.active) {
        this.mute(error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'マイクが許可されていません。聞くだけでも参加できます。'
          : 'マイクを開始できませんでした。接続やブラウザーの設定を確認してください。');
      }
    } finally { if (generation === this.generation) { this.busy = false; this.notify(); } }
  }

  private mute(message = ''): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined; this.microphone = false; this.notice = message;
    for (const peer of this.peers.values()) void this.attachMicrophone(peer).catch(() => {});
    if (this.active) this.options.sendState({ listening: true, microphone: false });
    this.notify();
  }

  stop(message = ''): void {
    this.generation++;
    this.active = false; this.busy = false;
    this.limited = false;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined; this.microphone = false;
    window.clearInterval(this.meterTimer);
    for (const peer of this.peers.values()) this.closePeer(peer);
    this.peers.clear(); this.speakers.clear();
    if (this.context) void this.context.close().catch(() => {});
    this.context = undefined;
    this.notice = message;
    if (this.online) this.options.sendState({ listening: false, microphone: false });
    this.notify();
  }

  accept(snapshot: VoiceSnapshot): void {
    if (!this.active) return;
    if (!snapshot.self.listening) {
      this.stop(snapshot.error === 'capacity' ? `音声は同時に${MAX_VOICE_MEMBERS}人まで参加できます。空きができたらもう一度お試しください。` : '音声を終了しました。');
      return;
    }
    const iceChanged = JSON.stringify(this.iceServers) !== JSON.stringify(snapshot.iceServers);
    this.iceServers = snapshot.iceServers;
    this.limited = !!snapshot.limited;
    if (iceChanged) for (const [id, peer] of this.peers) {
      try { peer.pc.setConfiguration({ ...peer.pc.getConfiguration(), iceServers: this.iceServers }); }
      catch { this.closePeer(peer); this.peers.delete(id); }
    }
    const allowed = new Map(snapshot.peers.map((peer) => [peer.id, peer]));
    for (const [id, peer] of this.peers) {
      if (allowed.get(id)?.session !== peer.session) { this.closePeer(peer); this.peers.delete(id); }
    }
    for (const grant of snapshot.peers) if (!this.peers.has(grant.id)) {
      const peer = this.makePeer(grant.id, grant.session);
      this.peers.set(peer.id, peer);
      if (peer.initiator) void this.offer(peer);
    }
    this.notify();
  }

  private current(peer: Peer): boolean { return this.active && this.peers.get(peer.id) === peer; }

  private makePeer(id: string, session: string): Peer {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer: Peer = { id, session, pc, initiator: this.id! < id, candidates: [], queue: Promise.resolve(), retries: 0, negotiating: false };
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && this.current(peer)) this.options.sendSignal(id, session, {
        kind: 'candidate', candidate: candidate.candidate,
        sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex,
      });
    };
    pc.ontrack = ({ track }) => {
      if (track.kind !== 'audio' || !this.current(peer) || !this.context) { track.stop(); return; }
      peer.source?.disconnect(); peer.gain?.disconnect(); peer.analyser?.disconnect();
      const stream = new MediaStream([track]);
      // Muted element primes browser WebRTC playback; the audible path uses Web Audio gain.
      const element = peer.element ?? document.createElement('audio');
      element.muted = true; element.autoplay = true; element.setAttribute('playsinline', '');
      element.srcObject = stream; peer.element = element;
      void element.play().catch(() => {});
      peer.source = this.context.createMediaStreamSource(stream);
      peer.gain = this.context.createGain(); peer.gain.gain.value = 0;
      peer.analyser = this.context.createAnalyser(); peer.analyser.fftSize = 256;
      peer.source.connect(peer.gain).connect(peer.analyser).connect(this.options.audioDestination?.(this.context) ?? this.context.destination);
      this.setGain(peer);
    };
    pc.onconnectionstatechange = () => {
      if (!this.current(peer)) return;
      if (pc.connectionState === 'connected') { window.clearTimeout(peer.retryTimer); peer.retries = 0; this.notice = ''; }
      if (pc.connectionState === 'failed') this.notice = '相手との音声接続が切れました。ネットワーク設定を確認してください。';
      if (pc.connectionState === 'failed' && peer.initiator) {
        if (peer.retries++ < 2) peer.retryTimer = window.setTimeout(() => { if (this.current(peer) && pc.connectionState !== 'connected') void this.offer(peer, true); }, 1000);
        else this.notice = '相手と音声接続できませんでした。ネットワーク設定を確認し、音声に参加し直してください。';
      }
      this.notify();
    };
    if (peer.initiator) pc.addTransceiver('audio', { direction: 'sendrecv' });
    return peer;
  }

  private async attachMicrophone(peer: Peer): Promise<void> {
    const transceiver = peer.pc.getTransceivers().find((item) => item.receiver.track.kind === 'audio');
    if (transceiver && this.current(peer)) {
      transceiver.direction = 'sendrecv';
      await transceiver.sender.replaceTrack(this.stream?.getAudioTracks()[0] ?? null);
      const parameters = transceiver.sender.getParameters();
      if (parameters.encodings?.length) {
        for (const encoding of parameters.encodings) encoding.maxBitrate = 48_000;
        await transceiver.sender.setParameters(parameters);
      }
    }
  }

  private async offer(peer: Peer, iceRestart = false): Promise<void> {
    if (!this.current(peer) || peer.negotiating) return;
    peer.negotiating = true;
    try {
      await this.attachMicrophone(peer);
      const offer = await peer.pc.createOffer({ iceRestart });
      if (!this.current(peer)) return;
      await peer.pc.setLocalDescription(offer);
      if (this.current(peer)) this.options.sendSignal(peer.id, peer.session, { kind: 'description', type: 'offer', sdp: peer.pc.localDescription!.sdp });
    } catch { if (this.current(peer)) { this.notice = '音声接続を開始できませんでした。音声に参加し直してください。'; this.notify(); } }
    finally { peer.negotiating = false; }
  }

  signal(message: VoiceSignal): void {
    const peer = this.peers.get(message.from);
    if (!peer || peer.session !== message.session || !this.active) return;
    peer.queue = peer.queue.then(async () => {
      if (!this.current(peer)) return;
      const payload = message.payload;
      if (payload.kind === 'candidate') {
        const candidate = { candidate: payload.candidate, sdpMid: payload.sdpMid, sdpMLineIndex: payload.sdpMLineIndex };
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(candidate);
        else if (peer.candidates.length < 32) peer.candidates.push(candidate);
        return;
      }
      if ((payload.type === 'offer') === peer.initiator) return;
      await peer.pc.setRemoteDescription({ type: payload.type, sdp: payload.sdp });
      if (!this.current(peer)) return;
      if (payload.type === 'answer') await this.attachMicrophone(peer);
      for (const candidate of peer.candidates.splice(0)) await peer.pc.addIceCandidate(candidate);
      if (payload.type === 'offer') {
        await this.attachMicrophone(peer);
        const answer = await peer.pc.createAnswer();
        if (!this.current(peer)) return;
        await peer.pc.setLocalDescription(answer);
        if (this.current(peer)) this.options.sendSignal(peer.id, peer.session, { kind: 'description', type: 'answer', sdp: peer.pc.localDescription!.sdp });
      }
    }).catch(() => {
      if (this.current(peer)) { this.notice = '音声の接続に失敗しました。音声に参加し直してください。'; this.notify(); }
    });
  }

  private setGain(peer: Peer): void {
    if (!peer.gain || !this.context) return;
    const a = this.id ? this.players.get(this.id) : undefined;
    const b = this.players.get(peer.id);
    const volume = a && b ? proximityGain(a, b) : 0;
    if (!volume) peer.gain.gain.setValueAtTime(0, this.context.currentTime);
    else peer.gain.gain.setTargetAtTime(volume, this.context.currentTime, 0.06);
  }

  private closePeer(peer: Peer): void {
    window.clearTimeout(peer.retryTimer);
    peer.pc.onconnectionstatechange = null; peer.pc.ontrack = null; peer.pc.onicecandidate = null;
    peer.pc.close();
    peer.gain?.disconnect(); peer.source?.disconnect(); peer.analyser?.disconnect();
    if (peer.element) { peer.element.pause(); peer.element.srcObject = null; }
    this.speakers.delete(peer.id);
  }

  private notify(): void {
    this.speakers.clear();
    const levels: Record<string, number> = {};
    for (const peer of this.peers.values()) if (peer.analyser) {
      const data = new Uint8Array(peer.analyser.fftSize);
      peer.analyser.getByteTimeDomainData(data);
      const rms = Math.sqrt(data.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / data.length);
      levels[peer.id] = rms;
      if (rms > 0.015) this.speakers.add(peer.id);
    }
    const connected = [...this.peers.values()].filter((peer) => peer.pc.connectionState === 'connected').length;
    this.options.notify({
      active: this.active, microphone: this.microphone, busy: this.busy,
      nearby: this.peers.size, connected, speakers: new Set(this.speakers), levels,
      message: this.notice || (this.limited ? '周囲が混み合っています。5人以内のグループに分かれてお話しください。' : !this.online ? 'オフィスへの接続後に参加できます。' : !this.active ? '参加すると、近くの人の声が聞こえます。' : this.microphone ? 'マイクON · 近くの人に声が届きます。' : 'マイクOFF · 聞くだけで参加しています。'),
    });
  }

  destroy(): void { this.disposed = true; this.stop(); }
}
