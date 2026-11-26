import type { ScheduleBlock } from '../api/practitioners.ts';

/** The most blocks of hours the API takes for one week. */
export const MAX_BLOCKS = 50;
const END_OF_DAY = '24:00';

/** A block of hours as it is being edited: any part may still be empty. */
export interface DraftBlock {
  /** Identifies the row on screen while others are added and removed. Never sent. */
  key: string;
  /** 1 = Monday … 7 = Sunday. */
  weekday: number;
  branchId: string;
  /** `HH:mm`, or ''. */
  startsAt: string;
  /** `HH:mm`, or ''. Not used while `untilMidnight`; kept so unticking brings it back. */
  endsAt: string;
  untilMidnight: boolean;
}

export type BlockPart = 'branchId' | 'startsAt' | 'endsAt';

export type WeekProblem =
  | { key: string; part: BlockPart; kind: 'missing' | 'inactive' | 'order' | 'overlap' }
  | { key: ''; part: 'week'; kind: 'tooMany' };

const endOf = (block: DraftBlock): string => (block.untilMidnight ? END_OF_DAY : block.endsAt);

/** By weekday, then start. `HH:mm` compares as text. */
export function sortWeek(draft: DraftBlock[]): DraftBlock[] {
  return [...draft].sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt));
}

export function toDraft(schedule: ScheduleBlock[]): DraftBlock[] {
  return sortWeek(
    schedule.map((block, index) => {
      const untilMidnight = block.endsAt === END_OF_DAY;
      return {
        key: `saved-${index}`,
        weekday: block.weekday,
        branchId: block.branchId,
        startsAt: block.startsAt,
        endsAt: untilMidnight ? '' : block.endsAt,
        untilMidnight,
      };
    }),
  );
}

/** The week as the API takes it. */
export function toBlocks(draft: DraftBlock[]): ScheduleBlock[] {
  return sortWeek(draft).map((block) => ({
    branchId: block.branchId,
    weekday: block.weekday,
    startsAt: block.startsAt,
    endsAt: endOf(block),
  }));
}

export function isSameWeek(a: DraftBlock[], b: DraftBlock[]): boolean {
  const text = (draft: DraftBlock[]) =>
    toBlocks(draft)
      .map((block) => Object.values(block).join('|'))
      .sort()
      .join(';');
  return text(a) === text(b);
}

/**
 * What the API would refuse, found before sending: a missing part, a branch that is not active, an end
 * that is not after the start, hours that overlap on one weekday (at any branch; back-to-back is
 * fine, and the later start is blamed) and more than `MAX_BLOCKS` blocks.
 */
export function checkWeek({
  draft,
  activeBranchIds,
}: {
  draft: DraftBlock[];
  activeBranchIds: string[];
}): WeekProblem[] {
  const problems: WeekProblem[] = [];
  if (draft.length > MAX_BLOCKS) problems.push({ key: '', part: 'week', kind: 'tooMany' });
  for (const block of draft) {
    const { key } = block;
    if (block.branchId === '') problems.push({ key, part: 'branchId', kind: 'missing' });
    else if (!activeBranchIds.includes(block.branchId)) {
      problems.push({ key, part: 'branchId', kind: 'inactive' });
    }
    if (block.startsAt === '') problems.push({ key, part: 'startsAt', kind: 'missing' });
    const end = endOf(block);
    if (end === '') problems.push({ key, part: 'endsAt', kind: 'missing' });
    else if (block.startsAt !== '' && end <= block.startsAt) {
      problems.push({ key, part: 'endsAt', kind: 'order' });
    }
  }
  const complete = sortWeek(draft).filter(
    (block) => block.startsAt !== '' && endOf(block) > block.startsAt,
  );
  complete.forEach((block, index) => {
    const overlaps = complete
      .slice(0, index)
      .some((earlier) => earlier.weekday === block.weekday && block.startsAt < endOf(earlier));
    if (overlaps) problems.push({ key: block.key, part: 'startsAt', kind: 'overlap' });
  });
  return problems;
}

/** Replaces each day in `to` with its own copy of the blocks of day `from` (P7-13). */
export function copyDay({
  draft,
  from,
  to,
  newKey,
}: {
  draft: DraftBlock[];
  from: number;
  to: number[];
  newKey: () => string;
}): DraftBlock[] {
  const source = draft.filter((block) => block.weekday === from);
  return [
    ...draft.filter((block) => !to.includes(block.weekday)),
    ...to.flatMap((weekday) => source.map((block) => ({ ...block, weekday, key: newKey() }))),
  ];
}

/** The row an API field such as `blocks[1].startsAt` is about; `sent` is in the order sent. */
export function rowOfApiField({
  field,
  sent,
}: {
  field: string;
  sent: DraftBlock[];
}): { key: string; part: BlockPart } | undefined {
  const match = /^blocks(?:\[|\.)(\d+)\]?\.(branchId|startsAt|endsAt)$/.exec(field);
  const block = match ? sent[Number(match[1])] : undefined;
  return block ? { key: block.key, part: match?.[2] as BlockPart } : undefined;
}
