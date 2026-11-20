import { z } from '@/lib/zod.ts';

// The ONLY place that may use browser storage, and only for non-sensitive device preferences.
// Never tokens, patient data or anything a person typed (privacy rule, plan.md §11).
const schemas = {
  /** "This is a shared computer": turns on the inactivity sign-out (plan.md §5.3.1). */
  sharedComputer: z.boolean(),
  lastBranchId: z.string().nullable(),
};

const defaults: Preferences = { sharedComputer: false, lastBranchId: null };

export type Preferences = { [Key in keyof typeof schemas]: z.infer<(typeof schemas)[Key]> };
export type PreferenceKey = keyof Preferences;

const storageKey = (key: PreferenceKey): string => `doctayo.pref.${key}`;

export function readPreference<Key extends PreferenceKey>(key: Key): Preferences[Key] {
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (raw === null) return defaults[key];
    const parsed = schemas[key].safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as Preferences[Key]) : defaults[key];
  } catch {
    return defaults[key];
  }
}

export function writePreference<Key extends PreferenceKey>(
  key: Key,
  value: Preferences[Key],
): void {
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch {
    // Storage blocked (private mode): the preference simply is not remembered.
  }
}
