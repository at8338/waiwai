import { ProximityVoice } from '../src/audio/ProximityVoice.ts';
import type { VoiceUI } from '../src/audio/ProximityVoice.ts';
import { OfficeConnection } from '../src/network/OfficeConnection.ts';
import type { Player } from '../src/network/protocol.ts';
const members: Array<{ connection: OfficeConnection; voice: ProximityVoice; state?: VoiceUI }> = [];
let meter: number | undefined;
const result = document.querySelector('#result')!;
const stop = () => {
  window.clearInterval(meter);
  for (const { voice, connection } of members) { voice.destroy(); connection.destroy(); }
  members.length = 0;
};
document.querySelector('#start')!.addEventListener('click', async () => {
  stop(); result.textContent = '接続中';
  try {
    for (let i = 0; i < 30; i++) {
      const players = new Map<string, Player>();
      let id: string | undefined;
      let connection: OfficeConnection;
      let member: (typeof members)[number];
      const voice = new ProximityVoice({
        sendState: (state) => connection.setVoice(state),
        sendSignal: (to, session, payload) => connection.signalVoice(to, session, payload),
        notify: (state) => { if (member) member.state = state; },
        getMicrophone: async (context) => {
          const osc = context.createOscillator(); osc.frequency.value = 440 + i * 10;
          const volume = context.createGain(); volume.gain.value = 0.08;
          const stream = context.createMediaStreamDestination(); osc.connect(volume).connect(stream); osc.start();
          return stream.stream;
        },
        audioDestination: (context) => { const silent = context.createGain(); silent.gain.value = 0; silent.connect(context.destination); return silent; },
      });
      let ready!: () => void;
      const online = new Promise<void>((resolve) => { ready = resolve; });
      const world = () => voice.setWorld(id, players);
      connection = new OfficeConnection({
        state: (state) => { voice.setConnected(state === 'online'); if (state === 'online') ready(); },
        welcome: (self, list) => { id = self; players.clear(); list.forEach((p) => players.set(p.id, p)); world(); },
        player: (p) => { players.set(p.id, p); world(); },
        left: (other) => { players.delete(other); world(); },
        voice: (snapshot) => voice.accept(snapshot), voiceSignal: (signal) => voice.signal(signal),
      });
      member = { connection, voice }; members.push(member);
      connection.setProfile({ name: `音声検証${i}`, outfit: i % 3 });
      await online; await voice.start(); await voice.toggleMicrophone();
    }
    meter = window.setInterval(() => {
      const states = members.flatMap((m) => m.state ? [m.state] : []);
      const grantEndpoints = states.reduce((sum, s) => sum + s.nearby, 0);
      const connectedEndpoints = states.reduce((sum, s) => sum + s.connected, 0);
      const audibleEndpoints = states.reduce((sum, s) => sum + Object.values(s.levels).filter((v) => v > 0.001).length, 0);
      const data = { members: members.length, microphones: states.filter((s) => s.microphone).length,
        maxPeers: Math.max(...states.map((s) => s.nearby)), grantEndpoints, connectedEndpoints, audibleEndpoints,
        status: grantEndpoints > 0 && connectedEndpoints === grantEndpoints && audibleEndpoints === grantEndpoints ? 'PASS' : 'CONNECTING',
        notices: [...new Set(states.map((s) => s.message))] };
      result.textContent = JSON.stringify(data, null, 2);
    }, 500);
  } catch (error) { result.textContent = String(error); stop(); }
});
document.querySelector('#stop')!.addEventListener('click', () => { stop(); result.textContent = '終了しました'; });
window.addEventListener('pagehide', stop);
