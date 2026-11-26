import { plural, t } from '@lingui/core/macro';

/** 90 → "1 hour 30 minutes": how long a service usually takes, in words. */
export function formatDuration(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 1) {
    throw new RangeError('Expected a whole number of minutes.');
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourText = plural(hours, { one: '# hour', other: '# hours' });
  const minuteText = plural(rest, { one: '# minute', other: '# minutes' });
  if (hours === 0) return minuteText;
  return rest === 0 ? hourText : t`${hourText} ${minuteText}`;
}
