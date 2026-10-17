import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MINUTE, DAY, dueOccurrence, nextOccurrence, parseJstInput, jstInput, parseAnnouncementAction } from './announcements.ts';
import type { ScheduleDraft } from './announcements.ts';
import { parseClientMessage } from '../network/protocol.ts';
const time = (s: string) => parseJstInput(s)!;
const meeting: ScheduleDraft = { title: '全体会議', message: '作戦室へどうぞ。', startsAt: time('2026-10-19T10:00'), repeat: 'weekly', leadMinutes: 5, displayMinutes: 3, enabled: true };
test('JST scheduling handles weekly and weekday boundaries independent of device timezone', () => {
  assert.equal(jstInput(Date.UTC(2026, 9, 18, 15, 0)), '2026-10-19T00:00');
  for (const invalid of ['2026-02-30T12:00', '2026-10-19T24:00', '2026-10-19T10:00Z', 'invalid']) assert.equal(parseJstInput(invalid), undefined);
  assert.equal(nextOccurrence(meeting, time('2026-10-19T09:59')), meeting.startsAt);
  assert.equal(nextOccurrence(meeting, meeting.startsAt + 1), meeting.startsAt + 7 * DAY);
  const weekdays = { ...meeting, repeat: 'weekdays' as const, startsAt: time('2026-10-16T10:00') };
  assert.equal(nextOccurrence(weekdays, time('2026-10-17T09:00')), time('2026-10-19T10:00'));
  const midnight = { ...meeting, repeat: 'daily' as const, startsAt: time('2026-10-19T00:02') };
  assert.equal(dueOccurrence(midnight, time('2026-10-18T23:58')), midnight.startsAt);
  assert.equal(nextOccurrence({ ...meeting, enabled: false }, meeting.startsAt), undefined);
});
test('announcements are due from the lead time through the display window and never replay old meetings', () => {
  for (const repeat of ['once', 'daily', 'weekdays', 'weekly'] as const) {
    const s = { ...meeting, repeat };
    assert.equal(dueOccurrence(s, s.startsAt - 6 * MINUTE), undefined);
    assert.equal(dueOccurrence(s, s.startsAt - 5 * MINUTE), s.startsAt);
    assert.equal(dueOccurrence(s, s.startsAt + 3 * MINUTE - 1), s.startsAt);
    assert.equal(dueOccurrence(s, s.startsAt + 3 * MINUTE), undefined);
    assert.equal(dueOccurrence(s, s.startsAt - DAY), undefined);
  }
});
test('broadcast and schedule messages enforce bounded input, normalize text and ignore forged authors and delivery state', () => {
  const actionId = randomUUID(), id = randomUUID();
  const action = { type: 'schedule-save', actionId, id, expectedVersion: 0, schedule: { ...meeting, author: 'fake', lastOccurrence: 999 } };
  assert.deepEqual(parseClientMessage(JSON.stringify(action)), { type: action.type, actionId, id, expectedVersion: 0, schedule: meeting });
  const publish = { type: 'announcement-publish', actionId, title: '  お知らせ  ', message: '<script>text only</script>', durationMinutes: 3, author: 'fake' };
  assert.deepEqual(parseClientMessage(JSON.stringify(publish)), { type: publish.type, actionId, title: 'お知らせ', message: publish.message, durationMinutes: 3 });
  for (const change of [{ title: ' ' }, { title: 'x'.repeat(61) }, { message: 'x'.repeat(241) }, { durationMinutes: 999 }, { message: 'hi\u0000' }, { actionId: 'fake' }]) assert.equal(parseAnnouncementAction({ ...publish, ...change }), undefined);
  for (const change of [{ repeat: '__proto__' }, { startsAt: Infinity }, { leadMinutes: -5 }, { enabled: 'yes' }]) assert.equal(parseClientMessage(JSON.stringify({ ...action, schedule: { ...meeting, ...change } })), undefined);
});
