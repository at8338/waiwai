import { ProximityVoice } from '../src/audio/ProximityVoice.ts';
import { OfficeConnection } from '../src/network/OfficeConnection.ts';
import type { Player } from '../src/network/protocol.ts';

const players = new Map<string, Player>();
let id: string | undefined;
let track: MediaStreamTrack | undefined;
let moveTimer: number | undefined;
let nextMode: 'tone' | 'deny' | 'pending' = 'tone';
let resolvePending: (() => void) | undefined;
const updateWorld = () => {
  voice.setWorld(id, players);
  document.querySelector('#players')!.textContent = JSON.stringify([...players.values()]);
};
const voice = new ProximityVoice({
  sendState: (state) => connection.setVoice(state),
  sendSignal: (to, session, payload) => connection.signalVoice(to, session, payload),
  notify: (state) => {
    document.querySelector('#voice-state')!.textContent = JSON.stringify({ ...state, speakers: [...state.speakers] });
    document.querySelector('#received')!.textContent = Object.values(state.levels).some((level) => level > 0.01) ? '受信あり' : '音声なし';
    document.querySelector('#track-state')!.textContent = track?.readyState ?? '未取得';
  },
  getMicrophone: async (context) => {
    const mode = nextMode; nextMode = 'tone';
    if (mode === 'deny') throw new DOMException('Synthetic permission denial', 'NotAllowedError');
    const oscillator = context.createOscillator();
    oscillator.frequency.value = 440;
    const volume = context.createGain(); volume.gain.value = 0.08;
    const destination = context.createMediaStreamDestination();
    oscillator.connect(volume).connect(destination);
    oscillator.start();
    track = destination.stream.getAudioTracks()[0];
    if (mode === 'pending') await new Promise<void>((resolve) => { resolvePending = resolve; });
    return destination.stream;
  },
});
const connection = new OfficeConnection({
  state: (state) => voice.setConnected(state === 'online'),
  welcome: (self, list) => { id = self; players.clear(); list.forEach((player) => players.set(player.id, player)); updateWorld(); },
  player: (player) => { players.set(player.id, player); updateWorld(); },
  left: (other) => { players.delete(other); updateWorld(); },
  voice: (snapshot) => voice.accept(snapshot),
  voiceSignal: (signal) => voice.signal(signal),
});
connection.setProfile({ name: 'テスト音', outfit: 2 });
document.querySelector('#join')!.addEventListener('click', () => { void voice.start(); });
document.querySelector('#mic')!.addEventListener('click', () => { void voice.toggleMicrophone(); });
document.querySelector('#end')!.addEventListener('click', () => voice.stop());
document.querySelector('#deny')!.addEventListener('click', () => { nextMode = 'deny'; void voice.toggleMicrophone(); });
document.querySelector('#pending')!.addEventListener('click', () => { nextMode = 'pending'; void voice.toggleMicrophone(); });
document.querySelector('#resolve')!.addEventListener('click', () => {
  resolvePending?.(); resolvePending = undefined;
  window.setTimeout(() => { document.querySelector('#track-state')!.textContent = track?.readyState ?? '未取得'; }, 0);
});
const walkTo = (x: number) => {
  window.clearInterval(moveTimer);
  moveTimer = window.setInterval(() => {
    const player = id ? players.get(id) : undefined;
    if (!player || player.x === x) { window.clearInterval(moveTimer); return; }
    if (connection.readyToMove) connection.move(player.x < x ? 'right' : 'left');
  }, 170);
};
document.querySelector('#mid')!.addEventListener('click', () => walkTo(17));
document.querySelector('#far')!.addEventListener('click', () => walkTo(23));
document.querySelector('#reset')!.addEventListener('click', () => { window.clearInterval(moveTimer); connection.reset(); });
window.addEventListener('pagehide', () => { window.clearInterval(moveTimer); voice.destroy(); connection.destroy(); });
