import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directoryPeople, memberId, searchPeople } from './directory.ts';
import type { Member, Person } from './directory.ts';
import type { Player } from '../network/protocol.ts';

const slack = { teamId: 'T012ABCDEF', userId: 'U012ABCDEF' };
const member: Member = { id: memberId(slack), name: 'はな', slack };
const player: Player = { id: 'tab-a', slot: 1, name: 'はな', outfit: 0, roomId: 'office', x: 15, y: 12, facing: 'down', slack, slackVerified: true };

test('the directory merges verified tabs, keeps remaining connections online, and remembers offline members', () => {
  const tabB = { ...player, id: 'tab-b', roomId: 'cafe' as const };
  const guest = { ...player, id: 'guest', slackVerified: false, name: '手動IDのゲスト' };
  const people = directoryPeople([member], [player, tabB, guest]);
  assert.equal(people.length, 2);
  assert.deepEqual([people[0].online, people[0].playerId, people[0].roomId], [true, 'tab-b', 'cafe']);
  assert.equal(people[1].verified, false); assert.equal(people[1].slack, null);
  assert.equal(directoryPeople([member], [player])[0].online, true);
  assert.deepEqual(directoryPeople([member], []), [{ ...member, verified: true, online: false }]);
});

test('name and Slack ID search normalize width and case, apply status filters and sort online first', () => {
  const people: Person[] = [{ ...member, name: 'Alice はな', online: false, verified: true },
    { ...member, id: 'other', name: 'たろう', online: true, verified: true }];
  assert.equal(searchPeople(people, 'ＡＬＩＣＥ　はな')[0].id, member.id);
  assert.equal(searchPeople(people, 'u012abc')[0].name, 'たろう');
  assert.equal(searchPeople(people, '', 'offline').length, 1);
  assert.equal(searchPeople(people, 'Alice', 'online').length, 0);
  assert.equal(searchPeople(people, '')[0].id, 'other');
  assert.equal(searchPeople(people, 'unknown').length, 0);
});
