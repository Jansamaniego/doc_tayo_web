import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { Pagination } from './pagination.tsx';

const meta = { page: 2, pageSize: 20, totalItems: 132, totalPages: 7 };

function renderPagination(props: Partial<Parameters<typeof Pagination>[0]> = {}) {
  return renderWithProviders(
    <Pagination
      meta={meta}
      onPageChange={() => undefined}
      onPageSizeChange={() => undefined}
      {...props}
    />,
  );
}

describe('Pagination (the API meta: page, pageSize, totalItems, totalPages)', () => {
  it('says where you are in words', () => {
    renderPagination();
    expect(screen.getByText('Page 2 of 7')).toBeInTheDocument();
    expect(screen.getByText('Showing 21 to 40 of 132')).toBeInTheDocument();
  });

  it('is a labelled navigation with Previous and Next buttons that have words', async () => {
    const onPageChange = vi.fn();
    renderPagination({ onPageChange });
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('disables Previous on the first page and Next on the last', () => {
    const { unmount } = renderPagination({ meta: { ...meta, page: 1 } });
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    unmount();
    renderPagination({ meta: { ...meta, page: 7 } });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByText('Showing 121 to 132 of 132')).toBeInTheDocument();
  });

  it('offers 20, 50 and 100 per page (the API maximum), and reports the choice', async () => {
    const onPageSizeChange = vi.fn();
    renderPagination({ onPageSizeChange });
    const select = screen.getByRole('combobox', { name: 'Per page' });
    expect(Array.from(select.querySelectorAll('option')).map((o) => o.value)).toEqual([
      '20',
      '50',
      '100',
    ]);
    await userEvent.selectOptions(select, '50');
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('shows nothing when there is nothing to page through', () => {
    const { container } = renderPagination({
      meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the controls at least 44 px', () => {
    renderPagination();
    expect(screen.getByRole('button', { name: 'Next' }).className).toContain('min-h-control-md');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderPagination();
    expect(await axe(container)).toHaveNoViolations();
  });
});
