import { useLingui } from '@lingui/react/macro';
import { useId } from 'react';

import { cn } from '@/lib/cn.ts';

import { usePixelShift } from './use-pixel-shift.ts';
import { useWakeLock } from './use-wake-lock.ts';

// Privacy (Data Privacy Act of 2012): these types are the ONLY data the display can be given.
// There is no field for a full name, a birth date, a reason for the visit or a priority category.
// The server already reduces a name to "first name + last initial" (backend dependency D-21), so
// the device never receives more. A priority ticket is an ordinary ticket in the same number series.
export interface TvCall {
  number: string;
  /** "Juan D." (first name and last initial) or nothing. */
  shortName?: string | undefined;
  room: string;
  doctor?: string | undefined;
}

export interface TvQueueGroup {
  /** "Dr. Reyes · Room 1" */
  label: string;
  numbers: string[];
}

export interface TvDisplayProps {
  clinicName: string;
  branchName: string;
  /** Already formatted in the clinic's time zone, for example "2:45 PM". */
  time: string;
  nowServing: TvCall | null;
  /** Other rooms' current calls. */
  otherCalls: { number: string; room: string }[];
  next: TvQueueGroup[];
  /** live; reconnecting (calm status line); stale (after 2 minutes: dim "Now serving"). */
  status: 'live' | 'reconnecting' | 'stale';
  lastUpdated: string;
  /** A new call: highlighted for a few seconds. */
  highlight?: boolean | undefined;
  theme?: 'light' | 'dark' | undefined;
}

const MAX_PER_GROUP = 3;
const MAX_GROUPS = 3; // more rooms than this cannot be read from across the room: the rest are counted

/**
 * The waiting-room screen, for a large TV viewed from 3-5 m: very large high-contrast text, no
 * interaction, a stable layout for all-day display (plans/02-design-system.md §10).
 */
export function TvDisplay({
  clinicName,
  branchName,
  time,
  nowServing,
  otherCalls,
  next,
  status,
  lastUpdated,
  highlight = false,
  theme = 'light',
}: TvDisplayProps) {
  const { t } = useLingui();
  const nowId = useId();
  const nextId = useId();
  const shift = usePixelShift({ intervalMs: 5 * 60_000, maxPx: 6 });
  useWakeLock();

  const dark = theme === 'dark';
  const stale = status === 'stale';
  const empty = nowServing === null && next.length === 0;

  const panel = stale
    ? 'bg-tv-stale-bg text-tv-stale-text'
    : highlight
      ? 'bg-tv-highlight-bg text-tv-now-serving-text ring-[1.2vh] ring-inset ring-tv-highlight'
      : dark
        ? 'bg-tv-dark-now-serving-bg text-tv-dark-now-serving-text'
        : 'bg-tv-now-serving-bg text-tv-now-serving-text';

  return (
    <div
      data-theme={theme}
      className={cn(
        'flex h-screen w-screen cursor-none select-none flex-col overflow-hidden px-[3vw] py-[2vh]',
        dark ? 'bg-tv-dark-bg text-tv-dark-text' : 'bg-tv-bg text-tv-text',
      )}
    >
      <header className="flex items-baseline justify-between gap-[2vw] text-tv-meta">
        <h1 className="font-bold">
          {clinicName} <span aria-hidden="true">·</span> {branchName}
        </h1>
        <time
          className="tabular-nums"
          style={{ transform: `translate(${shift.x}px, ${shift.y}px)` }}
        >
          {time}
        </time>
      </header>

      <div className="grid flex-1 grid-cols-[3fr_2fr] gap-[3vw] py-[2vh]">
        <section
          aria-labelledby={nowId}
          className="flex min-h-0 flex-col gap-[2vh]"
          data-stale={stale || undefined}
          data-highlight={highlight || undefined}
        >
          <h2 id={nowId} className="text-tv-label font-bold uppercase tracking-wide">
            {t`Now serving`}
          </h2>
          <div
            className={cn(
              'flex flex-1 flex-col justify-center gap-[1vh] rounded-[2vh] px-[3vw]',
              panel,
            )}
          >
            {nowServing ? (
              <>
                <p className="whitespace-nowrap text-tv-number font-bold tabular-nums">
                  {nowServing.number}
                </p>
                {nowServing.shortName && (
                  <p className="text-tv-name font-bold">{nowServing.shortName}</p>
                )}
                <p className="text-tv-entry">
                  <span aria-hidden="true">→ </span>
                  {nowServing.room}
                  {nowServing.doctor && <> · {nowServing.doctor}</>}
                </p>
              </>
            ) : (
              <p className="text-tv-name font-bold">
                {empty ? t`No one waiting` : t`Next call coming up`}
              </p>
            )}
          </div>
          {stale && <p className="text-tv-meta font-bold">{t`Please check with reception.`}</p>}
          {!stale && otherCalls.length > 0 && (
            <ul className="flex flex-wrap gap-x-[3vw] text-tv-entry">
              {otherCalls.map((call) => (
                <li key={call.number}>
                  <span className="font-bold tabular-nums">{call.number}</span> {call.room}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby={nextId} className="flex min-h-0 flex-col gap-[2vh]">
          <h2 id={nextId} className="text-tv-label font-bold uppercase tracking-wide">
            {t`Next`}
          </h2>
          {next.slice(0, MAX_GROUPS).map((group) => {
            const more = group.numbers.length - MAX_PER_GROUP;
            return (
              <div key={group.label} className="flex flex-col gap-[0.5vh]">
                <h3 className="text-tv-meta font-bold">{group.label}</h3>
                <ul className="flex flex-wrap gap-x-[2vw] text-tv-label font-bold">
                  {group.numbers.slice(0, MAX_PER_GROUP).map((number) => (
                    <li key={number} className="tabular-nums">
                      {number}
                    </li>
                  ))}
                </ul>
                {more > 0 && <p className="text-tv-meta">{t`+${more} more`}</p>}
              </div>
            );
          })}
          {next.length > MAX_GROUPS && (
            <p className="text-tv-meta">{t`+${next.length - MAX_GROUPS} more`}</p>
          )}
        </section>
      </div>

      <footer className="flex items-center justify-between gap-[2vw] text-tv-meta">
        {/* While reconnecting, the status line needs the room: the note comes back with the connection. */}
        {status === 'live' ? <p>{t`Please have your queue number ready.`}</p> : <span />}
        {status === 'live' ? (
          <p className="flex items-center gap-[1vw]">
            <span>{t`Updated ${lastUpdated}`}</span>
            <span aria-hidden="true" className="size-[1.5vh] rounded-full bg-success" />
            <span className="font-bold">{t`Live`}</span>
          </p>
        ) : (
          <p
            role="status"
            className="flex items-center gap-[1vw] whitespace-nowrap rounded-full bg-tv-offline-bg px-[2vw] py-[0.5vh] font-bold text-tv-offline"
          >
            <span aria-hidden="true" className="size-[1.5vh] rounded-full bg-warning-border" />
            {t`Reconnecting… last updated ${lastUpdated}`}
          </p>
        )}
      </footer>
    </div>
  );
}
