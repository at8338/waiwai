import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_EPISODES, episodeById, EVENT_THEMES } from './daily-event-catalog.ts';
import { dailyEventAt, eventHistory, eventSpot, EVENT_DAY_MS, EVENT_JOURNAL_START } from './daily-events.ts';
import { eventPixels, outsideEventPixels } from './daily-event-art.ts';
import { calendarCells, calendarDay, recordedEvent, schedulesOnDay } from './office-calendar.ts';
import { parseJstInput, DAY } from './announcements.ts';
import type { Schedule } from './announcements.ts';
import { ROOMS, getRoom } from './rooms.ts';
import { walkableWithObjects, objectContains } from './objects.ts';
import type { RoomObject } from './objects.ts';
import { seatSpots } from './seating.ts';
import { touchingVehicleDock } from './transport.ts';
const day = (value: string) => parseJstInput(value + 'T00:00')!;
test('365 authored incidents have unique stable ids, titles, discoveries and bounded artwork', () => {
  assert.equal(DAILY_EPISODES.length, 365);
  for (const field of ['id', 'title', 'discovery'] as const) assert.equal(new Set(DAILY_EPISODES.map((e) => e[field])).size, 365, field);
  assert.equal(new Set(DAILY_EPISODES.map((e) => e.theme)).size, Object.keys(EVENT_THEMES).length);
  const silhouettes = new Set<string>();
  for (const episode of DAILY_EPISODES) {
    assert.ok(episode.title && episode.discovery && !episode.title.includes('|'));
    assert.equal(episodeById(episode.id), episode);
    const pixels = eventPixels(episode, 0); assert.ok(pixels.length > 0);
    silhouettes.add(JSON.stringify(pixels));
    for (const p of pixels) assert.ok(p.x >= 0 && p.y >= 0 && p.w > 0 && p.h > 0 && p.x + p.w <= 48 && p.y + p.h <= 48, `${episode.id}: ${JSON.stringify(p)}`);
    for (const height of [56, 80, 144]) for (const width of [256, 480]) for (const frame of [0, 1, 2]) for (const p of outsideEventPixels(episode, width, height, frame))
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= width && p.y + p.h <= height, `${episode.id} outside: ${JSON.stringify(p)}`);
  }
  assert.ok(silhouettes.size >= 100); // Reusable prop icons; the full authored stages are checked separately.
});
test('server-independent daily draws switch at JST midnight and cover each deck exactly once including leap day', () => {
  for (const cycle of [-1, 0, 1, 2]) {
    const start = EVENT_JOURNAL_START + cycle * 365 * DAY;
    const events = Array.from({ length: 365 }, (_, n) => dailyEventAt(start + n * DAY));
    assert.equal(new Set(events.map((e) => e.episodeId)).size, 365);
    for (const e of events) {
      assert.deepEqual(dailyEventAt(e.startsAt), dailyEventAt(e.endsAt - 1));
      assert.notEqual(dailyEventAt(e.endsAt).day, e.day);
      assert.equal(e.endsAt - e.startsAt, EVENT_DAY_MS);
      if (episodeById(e.episodeId)!.theme === 'kaiju') assert.notEqual(getRoom(e.roomId).outlook, 'none');
    }
  }
  assert.equal(dailyEventAt(Date.parse('2028-02-28T15:00:00Z')).day, '2028-02-29');
  assert.equal(dailyEventAt(Date.parse('2026-10-17T14:59:59.999Z')).day, '2026-10-17');
  assert.equal(dailyEventAt(Date.parse('2026-10-17T15:00:00Z')).day, '2026-10-18');
  const pinned = dailyEventAt(day('2026-10-17'));
  assert.equal(pinned.episodeId, 'detective-02'); assert.equal(pinned.roomId, 'garden');
});
test('event placement stays off doors, furniture, seats and transport and all rooms have one calendar', () => {
  for (const room of ROOMS) {
    const calendars = room.furniture.filter((f) => f.kind === 'calendar'); assert.equal(calendars.length, 1); assert.equal(calendars[0].y, 0); assert.equal(calendars[0].label, '館内カレンダー');
    for (let n = 0; n < 14; n++) {
      const event = { ...dailyEventAt(day('2026-10-17') + n * DAY), roomId: room.id };
      const spot = eventSpot(event)!; assert.ok(spot, room.id);
      const added: RoomObject[] = [{ id: 'new-prop', owner: 'qa', roomId: room.id, kind: 'plant', rotation: 0, ...spot }];
      const shifted = eventSpot(event, added)!; assert.ok(shifted);
      for (const [p, objects] of [[spot, []], [shifted, added]] as const) {
        assert.ok(walkableWithObjects(p.x, p.y, room.id, objects));
        assert.ok(!objects.some((o) => objectContains(o, p.x, p.y)));
        assert.ok(!seatSpots(room.id, objects).has(`${p.x},${p.y}`));
        assert.ok(!touchingVehicleDock({ roomId: room.id, ...p }));
        assert.ok([room.spawn, room.door].every((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) > 3));
      }
      assert.deepEqual(eventSpot(event, added), shifted);
    }
  }
});
test('journal and calendar reveal past days only, are bounded, and do not fabricate pre-release events', () => {
  assert.deepEqual(eventHistory(EVENT_JOURNAL_START - 1), []);
  assert.equal(eventHistory(EVENT_JOURNAL_START).length, 1);
  const now = day('2028-03-01') + 12 * 3600_000, history = eventHistory(now);
  assert.equal(history.length, 365); assert.equal(history[0].day, '2028-03-01');
  assert.ok(history.every((e) => e.startsAt <= now));
  assert.equal(recordedEvent(now + DAY, now), undefined);
  assert.equal(recordedEvent(EVENT_JOURNAL_START - DAY, now), undefined);
  assert.equal(recordedEvent(now - 365 * DAY, now), undefined);
  assert.deepEqual(recordedEvent(now, now), history[0]);
  const feb = calendarCells(day('2028-02-15')).filter((d) => d !== null);
  assert.equal(feb.length, 29); assert.equal(calendarCells(day('2026-10-01')).length % 7, 0);
  assert.equal(calendarDay(Date.parse('2026-10-17T15:00:00Z')), day('2026-10-18'));
});
test('calendar expands single, daily, weekday and weekly schedules on JST dates, honoring pause and start dates', () => {
  const base: Schedule = { id: 's', version: 1, updatedBy: 'qa', title: '定例', message: '作戦室へ', startsAt: parseJstInput('2026-10-19T00:05')!, repeat: 'weekdays', enabled: true, leadMinutes: 5, displayMinutes: 3 };
  assert.equal(schedulesOnDay([base], day('2026-10-18')).length, 0);
  assert.equal(schedulesOnDay([base], day('2026-10-19')).length, 1);
  assert.equal(schedulesOnDay([base], day('2026-10-24')).length, 0);
  assert.equal(schedulesOnDay([{ ...base, repeat: 'weekly' }], day('2026-10-26'))[0].startsAt, base.startsAt + 7 * DAY);
  assert.equal(schedulesOnDay([{ ...base, enabled: false }], day('2026-10-19')).length, 0);
  assert.equal(schedulesOnDay([{ ...base, repeat: 'once' }], day('2026-10-20')).length, 0);
  assert.equal(schedulesOnDay([{ ...base, repeat: 'daily' }], day('2026-10-24')).length, 1);
});


test('new project and canteen incidents join only after the historical launch-day room roster', () => {
  const rooms = new Set(Array.from({ length: 365 }, (_, index) => dailyEventAt(day('2026-10-18') + index * DAY).roomId));
  assert.ok(rooms.has('project') && rooms.has('canteen'));
  assert.equal(dailyEventAt(day('2026-10-17')).roomId, 'garden');
});
