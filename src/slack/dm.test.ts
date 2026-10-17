import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateSlackDM, parseSlackIdentity, readSlackSettings, slackDMUrl } from './dm.ts';
import { parseClientMessage } from '../network/protocol.ts';

const identity = { teamId: 'T012ABCDEF', userId: 'U012ABCDEF' };

test('the DM URL uses the official native Slack scheme and normalized IDs', () => {
  assert.equal(slackDMUrl(identity), 'slack://user?team=T012ABCDEF&id=U012ABCDEF');
  assert.equal(slackDMUrl({ teamId: ' t012abcdef ', userId: ' w012abcdef ' }), 'slack://user?team=T012ABCDEF&id=W012ABCDEF');
});

test('missing IDs and arbitrary URLs cannot become a DM destination', () => {
  for (const value of [undefined, null, {}, { teamId: identity.teamId },
    { ...identity, userId: 'javascript:alert(1)' }, { ...identity, teamId: 'https://evil.example' },
    { ...identity, userId: 'U012ABCDEF&team=TOTHER' }, { ...identity, userId: 'U' + 'A'.repeat(40) }]) {
    assert.equal(slackDMUrl(value), undefined);
  }
  assert.equal(parseClientMessage(JSON.stringify({ type: 'profile', name: 'A', outfit: 0, slack: { teamId: 'bad', userId: 'bad' } })), undefined);
  const message = parseClientMessage(JSON.stringify({ type: 'profile', name: 'A', outfit: 0, slack: { ...identity, url: 'https://evil.example' } }));
  assert.ok(message?.type === 'profile');
  assert.deepEqual(message.slack, identity);
});

test('activating a configured profile opens once, while missing or failed handlers are safe', () => {
  const opened: string[] = [];
  assert.equal(activateSlackDM(null, (url) => opened.push(url)), false);
  assert.equal(activateSlackDM(identity, (url) => opened.push(url)), true);
  assert.deepEqual(opened, ['slack://user?team=T012ABCDEF&id=U012ABCDEF']);
  assert.equal(activateSlackDM(identity, () => { throw new Error('No handler'); }), false);
});

test('clearing settings and corrupted tab storage do not restore an invalid destination', () => {
  assert.equal(parseSlackIdentity(null), null);
  assert.deepEqual(readSlackSettings(JSON.stringify(identity)), identity);
  for (const raw of [null, '{', 'null', '[]', '{"teamId":"T012ABCDEF"}', '{"url":"slack://user?team=OTHER"}']) assert.equal(readSlackSettings(raw), null);
  const legacy = parseClientMessage('{"type":"profile","name":"A","outfit":0}');
  assert.ok(legacy?.type === 'profile');
  assert.equal(legacy.slack, null);
});
