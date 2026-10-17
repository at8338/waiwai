import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { boardInFront, objectTargets, parseFavorite, targetAt, validLinkState } from './object-links.ts';
import { parseClientMessage } from '../network/protocol.ts';
import type { RoomObject } from './objects.ts';

test('favorite URLs accept HTTPS tools and reject unsafe schemes, credentials and control characters', () => {
  assert.deepEqual(parseFavorite({ title: '  ボード  ', url: 'https://example.com/board?a=1#page' }), { title: 'ボード', url: 'https://example.com/board?a=1#page' });
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com', 'file:///etc/passwd', 'https://user:pass@example.com', 'https://example.com/\npath', ' https://example.com', 'https://example.com/a b', 'invalid']) {
    assert.equal(parseFavorite({ title: 'ボード', url }), undefined, url);
  }
  for (const title of ['', ' '.repeat(5), 'x'.repeat(61), 'foo\u0000bar']) assert.equal(parseFavorite({ title, url: 'https://example.com' }), undefined);
});

test('every furniture footprint opens a stable target; a rotated desk retains its links after moving', () => {
  const desk: RoomObject = { id: randomUUID(), roomId: 'cafe', kind: 'desk', rotation: 1, x: 18, y: 12, owner: 'guest:test' };
  const target = targetAt('cafe', [desk], { x: 19, y: 14 })!;
  assert.equal(target.id, `placed:${desk.id}`); assert.equal(target.owner, desk.owner);
  assert.equal(targetAt('cafe', [{ ...desk, x: 20, y: 11, rotation: 0 }], { x: 22, y: 12 })!.id, target.id);
  assert.equal(targetAt('office', [], { x: 4, y: 4 })!.id, 'fixed:office:desk:2:3');
  assert.equal(targetAt('office', [desk], { x: 19, y: 14 }), undefined);
  assert.ok(objectTargets('office', []).some((o) => o.kind === 'board'));
  assert.equal(boardInFront('office', { x: 15, y: 2 })!.id, 'fixed:office:board:14:1');
  assert.equal(boardInFront('office', { x: 15, y: 3 }), undefined);
});

test('link messages and saved state enforce multiple unique known favorites and room boundaries', () => {
  const ids = [randomUUID(), randomUUID()];
  const action = { type: 'object-links-set', objectId: 'fixed:office:desk:2:3', linkIds: ids, editId: randomUUID() };
  assert.deepEqual(parseClientMessage(JSON.stringify(action)), action);
  for (const change of [{ linkIds: [...ids, ids[0]] }, { linkIds: Array.from({ length: 11 }, () => randomUUID()) }, { objectId: '__proto__' }, { editId: 'bad' }]) {
    assert.equal(parseClientMessage(JSON.stringify({ ...action, ...change })), undefined);
  }
  const state = { favorites: ids.map((id, i) => ({ id, title: `ボード${i}`, url: `https://example.com/${i}` })), bindings: [{ roomId: 'office', objectId: action.objectId, linkIds: ids }] };
  assert.equal(validLinkState(state), true);
  assert.equal(validLinkState({ ...state, bindings: [{ ...state.bindings[0], linkIds: [randomUUID()] }] }), false);
  assert.equal(validLinkState({ ...state, bindings: [{ ...state.bindings[0], roomId: 'cafe' }] }), false);
  assert.equal(validLinkState({ ...state, favorites: [...state.favorites, state.favorites[0]] }), false);
});
