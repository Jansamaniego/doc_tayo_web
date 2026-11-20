import { useLingui } from '@lingui/react/macro';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn.ts';

import { StatusPill } from './badge.tsx';
import { EmptyState, ErrorState, LoadingState } from './state-views.tsx';
import { useMediaQuery } from './use-media-query.ts';

export interface Column<Row> {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  sortable?: boolean;
}

export interface Sort {
  columnId: string;
  direction: 'ascending' | 'descending';
}

export interface DataTableProps<Row> {
  /** Names the table for screen readers. */
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Sorting is done by the server: the table shows the state and asks for changes. */
  sort?: Sort | undefined;
  onSortChange?: ((sort: Sort) => void) | undefined;
  selectedKey?: string | undefined;
  /** Labelled buttons, always visible: never hover-only actions. */
  rowActions?: ((row: Row) => ReactNode) | undefined;
  /** A label such as "Loading branches…" turns the table into a loading state. */
  loading?: string | undefined;
  empty?: ReactNode;
  error?:
    | { message: string; requestId?: string | undefined; onRetry?: (() => void) | undefined }
    | undefined;
  /** `auto` shows cards below the md breakpoint and a table from it. */
  layout?: 'auto' | 'table' | 'cards';
}

function SortIcon({ sorted }: { sorted: Sort['direction'] | undefined }) {
  const Icon = sorted === 'ascending' ? ArrowUp : sorted === 'descending' ? ArrowDown : ArrowUpDown;
  return <Icon aria-hidden="true" className="size-4 shrink-0" />;
}

/** A semantic table (sticky header, sortable columns, row actions); cards on small screens. */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  selectedKey,
  rowActions,
  loading,
  empty,
  error,
  layout = 'auto',
}: DataTableProps<Row>) {
  const { t } = useLingui();
  const wide = useMediaQuery('(min-width: 48em)');
  const asTable = layout === 'table' || (layout === 'auto' && wide);

  if (error) return <ErrorState {...error} />;
  if (loading) return <LoadingState label={loading} variant="skeleton" />;
  if (rows.length === 0) return <>{empty ?? <EmptyState title={t`Nothing to show yet`} />}</>;

  const selectedPill = <StatusPill status="info">{t`Selected`}</StatusPill>;

  if (!asTable) {
    return (
      <ul aria-label={caption} className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={cn(
              'flex flex-col gap-3 rounded-lg border bg-surface p-4',
              rowKey(row) === selectedKey ? 'border-primary bg-selected' : 'border-divider',
            )}
          >
            {rowKey(row) === selectedKey && <div>{selectedPill}</div>}
            <dl className="flex flex-col gap-2">
              {columns.map((column) => (
                <div key={column.id} className="flex flex-col">
                  <dt className="text-small text-ink-muted">{column.header}</dt>
                  <dd className="font-semibold">{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
            {rowActions && <div className="flex flex-wrap gap-3">{rowActions(row)}</div>}
          </li>
        ))}
      </ul>
    );
  }

  function nextSort(columnId: string): Sort {
    return {
      columnId,
      direction:
        sort?.columnId === columnId && sort.direction === 'ascending' ? 'descending' : 'ascending',
    };
  }

  return (
    <div
      // A box that scrolls sideways must be reachable by keyboard, even if it has nothing focusable in it.
      role="region"
      aria-label={caption}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling box must be keyboard reachable
      tabIndex={0}
      className="overflow-x-auto rounded-lg border border-divider bg-surface"
    >
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-subtle">
          <tr>
            {columns.map((column) => {
              const sorted = sort?.columnId === column.id ? sort.direction : undefined;
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={column.sortable ? (sorted ?? 'none') : undefined}
                  className="px-4 py-2 text-label font-bold"
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSortChange?.(nextSort(column.id));
                      }}
                      className="inline-flex min-h-target items-center gap-2 text-left font-bold"
                    >
                      {column.header}
                      <SortIcon sorted={sorted} />
                      {sorted && (
                        <span className="sr-only">
                          {sorted === 'ascending' ? t`Sorted ascending` : t`Sorted descending`}
                        </span>
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
            {rowActions && (
              <th scope="col" className="px-4 py-2 text-label font-bold">
                {t`Actions`}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = rowKey(row) === selectedKey;
            return (
              <tr
                key={rowKey(row)}
                aria-selected={selected || undefined}
                className={cn('border-t border-divider', selected && 'bg-selected')}
              >
                {columns.map((column, index) => (
                  <td key={column.id} className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap items-center gap-2">
                      {column.cell(row)}
                      {selected && index === 0 && selectedPill}
                    </div>
                  </td>
                ))}
                {rowActions && (
                  <td className="px-4 py-2">
                    {<div className="flex flex-wrap gap-3">{rowActions(row)}</div>}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
