// Read by the route before the page is loaded, so it must stay free of heavy imports.

/** The status tabs other than the first (Active), which the address does not name. */
export const DAY_TABS = ['checked_in', 'all', 'closed'] as const;
export type DayTab = (typeof DAY_TABS)[number];

/** What the address keeps. Nothing typed is in it. */
export interface DaySearch {
  branch?: string | undefined;
  /** `YYYY-MM-DD`; none for today, which the view then follows past midnight. */
  date?: string | undefined;
  /** A practitioner's membership id. */
  practitioner?: string | undefined;
  status?: DayTab | undefined;
}
