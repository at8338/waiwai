import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proximityGain } from './proximity.ts';
import { parseClientMessage } from '../network/protocol.ts';

test('voice is full close by, fades with distance, and is silent at five tiles', () => {
  const a = { x: 15, y: 12 };
  assert.equal(proximityGain(a, a), 1);
  assert.equal(proximityGain(a, { x: 16, y: 12 }), 1);
  assert.ok(proximityGain(a, { x: 18, y: 12 }) > proximityGain(a, { x: 19, y: 12 }));
  assert.equal(proximityGain(a, { x: 20, y: 12 }), 0);
  assert.equal(proximityGain(a, { x: 19, y: 15 }), 0); // Euclidean distance = 5.
  assert.equal(proximityGain(a, { x: 25, y: 12 }), 0);
});

test('different rooms do not share audio, including across a wall or doorway', () => {
  assert.equal(proximityGain({ x: 9, y: 5 }, { x: 11, y: 5 }), 0);
  assert.equal(proximityGain({ x: 15, y: 9 }, { x: 15, y: 10 }), 0);
  assert.equal(proximityGain({ x: 15, y: 12 }, { x: 15, y: 13 }), 1);
});

test('voice messages require consent and valid audio-only signaling', () => {
  assert.deepEqual(parseClientMessage('{"type":"voice-state","listening":false,"microphone":true}'),
    { type: 'voice-state', listening: false, microphone: false });
  assert.equal(parseClientMessage('{"type":"voice-state","listening":"yes","microphone":false}'), undefined);
  const signal = { type: 'voice-signal', to: 'peer', session: 'session', payload: { kind: 'description', type: 'offer', sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' } };
  assert.ok(parseClientMessage(JSON.stringify(signal)));
  signal.payload.sdp += 'm=video 9 UDP/TLS/RTP/SAVPF 96\r\n';
  assert.equal(parseClientMessage(JSON.stringify(signal)), undefined);
  signal.payload.sdp = 'a'.repeat(12_001);
  assert.equal(parseClientMessage(JSON.stringify(signal)), undefined);
});
