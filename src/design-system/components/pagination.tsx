import { useLingui } from '@lingui/react/macro';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';

import { Button } from './button.tsx';
import { controlClass } from './field.tsx';

/** The `meta` of every list response from the API. */
export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginationProps {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  /** The caller should also go back to page 1. */
  onPageSizeChange: (pageSize: number) => void;
  /** Default 20, 50 and 100 (the API maximum). */
  pageSizeOptions?: number[];
}

/** Previous / Next with words, "Page 2 of 7", and a page-size select. No infinite scroll. */
export function Pagination({
  meta,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
}: PaginationProps) {
  const { t } = useLingui();
  const selectId = useId();
  const { page, pageSize, totalItems, totalPages } = meta;
  if (totalItems === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  const sizes = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);
  return (
    <nav aria-label={t`Pagination`} className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-ink-secondary">{t`Showing ${from} to ${to} of ${totalItems}`}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          icon={<ChevronLeft className="size-5" />}
          disabled={page <= 1}
          onClick={() => {
            onPageChange(page - 1);
          }}
        >
          {t`Previous`}
        </Button>
        <span className="font-semibold">{t`Page ${page} of ${totalPages}`}</span>
        <Button
          variant="secondary"
          icon={<ChevronRight className="size-5" />}
          disabled={page >= totalPages}
          onClick={() => {
            onPageChange(page + 1);
          }}
        >
          {t`Next`}
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor={selectId} className="font-semibold">
          {t`Per page`}
        </label>
        <select
          id={selectId}
          value={pageSize}
          onChange={(event) => {
            onPageSizeChange(Number(event.target.value));
          }}
          className={controlClass()}
        >
          {sizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </nav>
  );
}
