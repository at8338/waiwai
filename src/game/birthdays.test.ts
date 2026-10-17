import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { birthdayOnDay, birthdayDay, validBirthday } from './birthdays.ts';
import { parseClientMessage } from '../network/protocol.ts';

test('birthdays use JST midnight and February 29 celebrates on February 28 only in non-leap years', () => {
  const birthday = { month: 10, day: 18 };
  assert.equal(birthdayOnDay(birthday, Date.parse('2026-10-17T14:59:59Z')), false);
  assert.equal(birthdayOnDay(birthday, Date.parse('2026-10-17T15:00:00Z')), true);
  assert.equal(birthdayDay(Date.parse('2026-10-17T15:00:00Z')), '2026-10-18');
  const leap = { month: 2, day: 29 };
  for (const [day, expected] of [['2027-02-28', true], ['2027-03-01', false], ['2028-02-28', false], ['2028-02-29', true], ['2100-02-28', true]] as const)
    assert.equal(birthdayOnDay(leap, Date.parse(day + 'T00:00:00+09:00')), expected);
});
test('birthday messages validate real month/day and discard identity, name and birth year supplied by clients', () => {
  const actionId = randomUUID(), action = { type: 'birthday-save', month: 2, day: 29, expectedVersion: 0, actionId };
  assert.deepEqual(parseClientMessage(JSON.stringify({ ...action, id: 'slack:T1:U2', name: 'other', year: 1900 })), action);
  for (const [month, day] of [[0, 1], [13, 1], [2, 30], [4, 31], [1, 0], [1.1, 2], ['2', 2], [1, 1.1]]) {
    assert.equal(validBirthday(month, day), false);
    assert.equal(parseClientMessage(JSON.stringify({ ...action, month, day })), undefined);
  }
  assert.equal(parseClientMessage(JSON.stringify({ type: 'birthday-cheer', id: '__proto__', actionId })), undefined);
  assert.equal(parseClientMessage(JSON.stringify({ ...action, expectedVersion: -1 })), undefined);
});

test('comment requests validate dates and text and discard forged author identity', () => {
  const action = { type: 'birthday-comment', id: 'slack:T1:U1', date: '2026-10-17', text: 'Happy birthday!', actionId: randomUUID() };
  assert.deepEqual(parseClientMessage(JSON.stringify({ ...action, authorId: 'slack:T1:U99', authorName: 'Forged' })), action);
  for (const invalid of [{ date: '2026-02-30' }, { text: ' ' }, { text: 'x'.repeat(201) }, { text: '\u202etext' }, { id: '__proto__' }]) assert.equal(parseClientMessage(JSON.stringify({ ...action, ...invalid })), undefined);
});
