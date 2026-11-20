import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { Button } from './button.tsx';
import { DataTable, type Column } from './data-table.tsx';

interface Branch {
  id: string;
  name: string;
  city: string;
  active: boolean;
}

const ROWS: Branch[] = [
  { id: '1', name: 'Main', city: 'Quezon City', active: true },
  { id: '2', name: 'Annex', city: 'Cebu', active: false },
];

const COLUMNS: Column<Branch>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, sortable: true },
  { id: 'city', header: 'City', cell: (row) => row.city },
];

function renderTable(props: Partial<Parameters<typeof DataTable<Branch>>[0]> = {}) {
  return renderWithProviders(
    <DataTable<Branch>
      caption="Branches"
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(row) => row.id}
      layout="table"
      {...props}
    />,
  );
}

describe('DataTable (table layout)', () => {
  it('is a real table with a caption, column headers and one row per item', () => {
    renderTable();
    const table = screen.getByRole('table', { name: 'Branches' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(2);
    expect(within(table).getAllByRole('row')).toHaveLength(3); // header + 2
    expect(within(table).getByRole('cell', { name: 'Quezon City' })).toBeInTheDocument();
  });

  it('has a sticky header', () => {
    renderTable();
    expect(screen.getAllByRole('columnheader')[0]?.closest('thead')?.className).toContain('sticky');
  });

  describe('sorting', () => {
    it('a sortable header is a button with words, and aria-sort tells the state', () => {
      renderTable({ sort: { columnId: 'name', direction: 'ascending' } });
      const header = screen.getByRole('columnheader', { name: /Name/ });
      expect(header).toHaveAttribute('aria-sort', 'ascending');
      expect(within(header).getByRole('button', { name: /Name/ })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'City' })).not.toHaveAttribute('aria-sort');
    });

    it('says the sort state in text for screen readers, not only with an arrow', () => {
      renderTable({ sort: { columnId: 'name', direction: 'descending' } });
      expect(screen.getByText('Sorted descending')).toBeInTheDocument();
    });

    it('asks for ascending first, then flips', async () => {
      const onSortChange = vi.fn();
      const { rerender } = renderTable({ onSortChange });
      await userEvent.click(screen.getByRole('button', { name: /Name/ }));
      expect(onSortChange).toHaveBeenLastCalledWith({ columnId: 'name', direction: 'ascending' });
      rerender(
        <DataTable<Branch>
          caption="Branches"
          columns={COLUMNS}
          rows={ROWS}
          rowKey={(r) => r.id}
          layout="table"
          sort={{ columnId: 'name', direction: 'ascending' }}
          onSortChange={onSortChange}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /Name/ }));
      expect(onSortChange).toHaveBeenLastCalledWith({ columnId: 'name', direction: 'descending' });
    });

    it('does not make other columns sortable', () => {
      renderTable();
      expect(
        within(screen.getByRole('columnheader', { name: 'City' })).queryByRole('button'),
      ).not.toBeInTheDocument();
    });
  });

  it('shows row actions as labelled buttons, always visible (never hover-only)', async () => {
    const onEdit = vi.fn();
    renderTable({
      rowActions: (row) => (
        <Button
          variant="secondary"
          onClick={() => {
            onEdit(row.id);
          }}
        >{`Edit ${row.name}`}</Button>
      ),
    });
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Annex' }));
    expect(onEdit).toHaveBeenCalledWith('2');
  });

  it('marks the selected row with words and an icon, not colour alone', () => {
    renderTable({ selectedKey: '2' });
    const row = screen.getByRole('row', { name: /Annex/ });
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(within(row).getByText('Selected')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Main/ })).not.toHaveAttribute('aria-selected', 'true');
  });

  describe('states', () => {
    it('loading: skeleton rows and a status, no table', () => {
      renderTable({ loading: 'Loading branches…' });
      expect(screen.getByRole('status')).toHaveTextContent('Loading branches…');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('empty: shows the empty state instead of an empty table', () => {
      renderTable({ rows: [], empty: <p>No branches yet</p> });
      expect(screen.getByText('No branches yet')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('error: an alert with Try again', async () => {
      const onRetry = vi.fn();
      renderTable({
        error: { message: 'We could not load the branches.', requestId: 'req-5', onRetry },
      });
      expect(screen.getByRole('alert')).toHaveTextContent('We could not load the branches.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(onRetry).toHaveBeenCalled();
    });
  });

  it('has no accessibility violations (plain, sorted, selected, with actions)', async () => {
    const { container } = renderTable({
      sort: { columnId: 'name', direction: 'ascending' },
      selectedKey: '1',
      rowActions: (row) => <Button variant="secondary">{`Edit ${row.name}`}</Button>,
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DataTable (cards layout, for small screens)', () => {
  it('shows each row as a card with every field labelled, and no table', () => {
    renderTable({ layout: 'cards' });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    const first = cards.at(0);
    if (!first) throw new Error('Expected a card for the first row.');
    expect(within(first).getByText('City')).toBeInTheDocument();
    expect(within(first).getByText('Quezon City')).toBeInTheDocument();
  });

  it('keeps the row actions and the selected state', () => {
    renderTable({
      layout: 'cards',
      selectedKey: '1',
      rowActions: (row) => <Button variant="secondary">{`Edit ${row.name}`}</Button>,
    });
    expect(screen.getByRole('button', { name: 'Edit Main' })).toBeInTheDocument();
    expect(screen.getByText('Selected')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderTable({
      layout: 'cards',
      rowActions: (row) => <Button variant="secondary">{`Edit ${row.name}`}</Button>,
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DataTable (auto layout)', () => {
  it('uses the cards below the md breakpoint and the table from it', () => {
    const screenWidth = (matches: boolean) =>
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
    screenWidth(true);
    const wide = renderTable({ layout: 'auto' });
    expect(screen.getByRole('table')).toBeInTheDocument();
    wide.unmount();
    screenWidth(false);
    renderTable({ layout: 'auto' });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
