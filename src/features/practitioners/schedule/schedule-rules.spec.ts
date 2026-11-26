import { describe, expect, it } from 'vitest';

import {
  checkWeek,
  copyDay,
  isSameWeek,
  MAX_BLOCKS,
  rowOfApiField,
  toBlocks,
  toDraft,
  type DraftBlock,
} from './schedule-rules.ts';

let next = 0;
const block = (over: Partial<DraftBlock> = {}): DraftBlock => ({
  key: `k${(next += 1)}`,
  weekday: 1,
  branchId: 'main',
  startsAt: '09:00',
  endsAt: '12:00',
  untilMidnight: false,
  ...over,
});
const check = (draft: DraftBlock[]) => checkWeek({ draft, activeBranchIds: ['main', 'annex'] });
const found = (draft: DraftBlock[]) => check(draft).map(({ key, part, kind }) => [key, part, kind]);

describe('toDraft and toBlocks', () => {
  it('reads the saved week, Monday first and by start, with 24:00 as "until midnight"', () => {
    const draft = toDraft([
      { branchId: 'main', weekday: 3, startsAt: '18:00', endsAt: '24:00' },
      { branchId: 'main', weekday: 1, startsAt: '13:00', endsAt: '17:00' },
      { branchId: 'annex', weekday: 1, startsAt: '09:00', endsAt: '12:00' },
    ]);
    expect(draft.map((item) => [item.weekday, item.startsAt, item.endsAt])).toEqual([
      [1, '09:00', '12:00'],
      [1, '13:00', '17:00'],
      [3, '18:00', ''],
    ]);
    expect(draft[2]?.untilMidnight).toBe(true);
    expect(new Set(draft.map((item) => item.key)).size).toBe(3);
  });

  it('sends the week by weekday then start, without keys, 24:00 for until midnight', () => {
    expect(
      toBlocks([
        block({ weekday: 2, startsAt: '18:00', endsAt: '19:00', untilMidnight: true }),
        block({ weekday: 1, startsAt: '13:00', endsAt: '17:00' }),
        block({ weekday: 1, branchId: 'annex' }),
      ]),
    ).toEqual([
      { branchId: 'annex', weekday: 1, startsAt: '09:00', endsAt: '12:00' },
      { branchId: 'main', weekday: 1, startsAt: '13:00', endsAt: '17:00' },
      { branchId: 'main', weekday: 2, startsAt: '18:00', endsAt: '24:00' },
    ]);
  });

  it('knows whether two drafts are the same week, whatever the order and keys', () => {
    const a = [block(), block({ weekday: 2 })];
    expect(isSameWeek(a, [block({ weekday: 2 }), block()])).toBe(true);
    expect(isSameWeek(a, [block()])).toBe(false);
    expect(isSameWeek(a, [block(), block({ weekday: 2, endsAt: '11:00' })])).toBe(false);
    expect(isSameWeek([block()], [block({ startsAt: '' })])).toBe(false);
  });
});

describe('checkWeek', () => {
  it('accepts an empty week and a good one', () => {
    expect(check([])).toEqual([]);
    expect(check([block(), block({ weekday: 7 })])).toEqual([]);
  });

  it('asks for every missing part; until midnight needs no end', () => {
    const empty = block({ key: 'e', branchId: '', startsAt: '', endsAt: '' });
    expect(found([empty])).toEqual([
      ['e', 'branchId', 'missing'],
      ['e', 'startsAt', 'missing'],
      ['e', 'endsAt', 'missing'],
    ]);
    expect(check([block({ endsAt: '', untilMidnight: true })])).toEqual([]);
  });

  it('refuses a branch that is not active', () => {
    expect(found([block({ key: 'a', branchId: 'closed' })])).toEqual([
      ['a', 'branchId', 'inactive'],
    ]);
  });

  it.each(['09:00', '08:00'])('refuses an end of %s for a start of 09:00', (endsAt) => {
    expect(found([block({ key: 'a', endsAt })])).toEqual([['a', 'endsAt', 'order']]);
  });

  it.each(['main', 'annex'])(
    'refuses hours that overlap on the same weekday (second at %s), on the later start',
    (branchId) => {
      const draft = [
        block({ key: 'late', branchId, startsAt: '11:59', endsAt: '13:00' }),
        block({ key: 'early' }),
      ];
      expect(found(draft)).toEqual([['late', 'startsAt', 'overlap']]);
    },
  );

  it('refuses a block inside a long one, and two with the same start', () => {
    const long = block({ endsAt: '18:00' });
    expect(found([long, block({ key: 'in', startsAt: '10:00', endsAt: '11:00' })])).toEqual([
      ['in', 'startsAt', 'overlap'],
    ]);
    expect(found([block(), block({ key: 'twin' })])).toEqual([['twin', 'startsAt', 'overlap']]);
  });

  it('counts "until midnight" in overlaps', () => {
    const night = block({ startsAt: '18:00', endsAt: '', untilMidnight: true });
    expect(found([night, block({ key: 'b', startsAt: '23:00', endsAt: '23:30' })])).toEqual([
      ['b', 'startsAt', 'overlap'],
    ]);
  });

  it('allows back-to-back hours and the same hours on different days', () => {
    expect(check([block(), block({ startsAt: '12:00', endsAt: '13:00' })])).toEqual([]);
    expect(check([block(), block({ weekday: 2 })])).toEqual([]);
  });

  it(`allows ${MAX_BLOCKS} blocks and refuses one more`, () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) => {
        const hour = String(Math.floor(index / 7)).padStart(2, '0');
        return block({
          weekday: (index % 7) + 1,
          startsAt: `${hour}:00`,
          endsAt: `${hour}:30`,
        });
      });
    expect(MAX_BLOCKS).toBe(50);
    expect(check(many(50))).toEqual([]);
    expect(check(many(51))).toEqual([{ key: '', part: 'week', kind: 'tooMany' }]);
  });
});

describe('copyDay', () => {
  const source = [
    block({ key: 's1', branchId: 'annex' }),
    block({ key: 's2', startsAt: '18:00', endsAt: '', untilMidnight: true }),
  ];
  const draft = [
    ...source,
    block({ key: 'tue', weekday: 2, startsAt: '07:00', endsAt: '08:00' }),
    block({ key: 'wed', weekday: 3 }),
  ];
  let made = 0;
  const copy = () => copyDay({ draft, from: 1, to: [2, 4], newKey: () => `new${(made += 1)}` });
  const onDay = (week: DraftBlock[], weekday: number) =>
    week.filter((item) => item.weekday === weekday);
  /** What a block says, whichever row and day it is. */
  const content = ({ branchId, startsAt, endsAt, untilMidnight }: DraftBlock) => ({
    branchId,
    startsAt,
    endsAt,
    untilMidnight,
  });

  it('replaces each ticked day with the source day’s blocks and leaves the others', () => {
    const week = copy();
    for (const weekday of [2, 4]) {
      expect(onDay(week, weekday).map(content)).toEqual(source.map(content));
    }
    expect(onDay(week, 1)).toEqual(source);
    expect(onDay(week, 3)).toEqual([draft[3]]);
    expect(week.some((item) => item.key === 'tue')).toBe(false);
  });

  it('makes independent copies with their own keys, without changing the draft', () => {
    const before = structuredClone(draft);
    const week = copy();
    expect(new Set(week.map((item) => item.key)).size).toBe(week.length);
    for (const item of onDay(week, 2)) expect(source).not.toContain(item);
    expect(draft).toEqual(before);
  });

  it('empties a ticked day when the source has no hours', () => {
    expect(copyDay({ draft, from: 5, to: [2], newKey: () => 'x' })).toEqual(
      draft.filter((item) => item.weekday !== 2),
    );
  });
});

describe('rowOfApiField', () => {
  const sent = [block({ key: 'a' }), block({ key: 'b' })];

  it('maps the API’s field name onto the row that was sent at that place', () => {
    expect(rowOfApiField({ field: 'blocks[1].endsAt', sent })).toEqual({
      key: 'b',
      part: 'endsAt',
    });
    expect(rowOfApiField({ field: 'blocks.0.branchId', sent })).toEqual({
      key: 'a',
      part: 'branchId',
    });
  });

  it.each(['blocks', 'blocks[2].startsAt', 'blocks[0].weekday', 'other'])(
    'has no row for %s',
    (field) => {
      expect(rowOfApiField({ field, sent })).toBeUndefined();
    },
  );
});
