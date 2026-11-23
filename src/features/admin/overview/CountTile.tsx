import { useLingui } from '@lingui/react/macro';

import { useSpaClick } from '@/lib/app-link.tsx';

/** A number with its label, as a link to the list it counts. While it loads there is no number, never a 0. */
export function CountTile({
  label,
  href,
  count,
}: {
  label: string;
  href: string;
  /** Undefined while loading. */
  count: number | undefined;
}) {
  const { t } = useLingui();
  const onClick = useSpaClick({ href });
  return (
    <a
      href={href}
      onClick={onClick}
      className="flex min-h-target flex-col gap-1 rounded-lg border border-divider bg-surface p-5 no-underline shadow-1 hover:bg-hover active:bg-selected"
    >
      <span className="font-semibold text-ink-secondary">{label}</span>
      {count === undefined ? (
        <>
          <span
            aria-hidden="true"
            className="block h-10 w-16 animate-pulse rounded-md bg-selected"
          />
          <span className="sr-only">{t`Loading…`}</span>
        </>
      ) : (
        <span className="text-display font-bold text-ink">{count}</span>
      )}
    </a>
  );
}
