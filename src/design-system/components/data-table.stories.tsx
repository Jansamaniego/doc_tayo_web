import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from './button.tsx';
import { DataTable, type Column, type Sort } from './data-table.tsx';
import { EmptyState } from './state-views.tsx';
import { Pagination } from './pagination.tsx';

const meta: Meta = { title: 'Components/Table, cards and pagination' };
export default meta;
type Story = StoryObj;

interface Branch {
  id: string;
  name: string;
  city: string;
}
const ROWS: Branch[] = [
  { id: '1', name: 'Main', city: 'Quezon City' },
  { id: '2', name: 'Annex', city: 'Cebu' },
  { id: '3', name: 'Harbor', city: 'Manila' },
];
const COLUMNS: Column<Branch>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, sortable: true },
  { id: 'city', header: 'City', cell: (row) => row.city, sortable: true },
];
const actions = (row: Branch) => <Button variant="secondary">{`Edit ${row.name}`}</Button>;

export const TableSortedAndSelected: Story = {
  render: function Render() {
    const [sort, setSort] = useState<Sort>({ columnId: 'name', direction: 'ascending' });
    return (
      <DataTable<Branch>
        caption="Branches"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        layout="table"
        sort={sort}
        onSortChange={setSort}
        selectedKey="2"
        rowActions={actions}
      />
    );
  },
};
export const CardsForSmallScreens: Story = {
  render: () => (
    <DataTable<Branch>
      caption="Branches"
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(r) => r.id}
      layout="cards"
      selectedKey="1"
      rowActions={actions}
    />
  ),
};
export const Loading: Story = {
  render: () => (
    <DataTable<Branch>
      caption="Branches"
      columns={COLUMNS}
      rows={[]}
      rowKey={(r) => r.id}
      loading="Loading branches…"
    />
  ),
};
export const Empty: Story = {
  render: () => (
    <DataTable<Branch>
      caption="Branches"
      columns={COLUMNS}
      rows={[]}
      rowKey={(r) => r.id}
      empty={<EmptyState title="No branches yet" action={<Button>Add branch</Button>} />}
    />
  ),
};
export const ErrorState: Story = {
  render: () => (
    <DataTable<Branch>
      caption="Branches"
      columns={COLUMNS}
      rows={[]}
      rowKey={(r) => r.id}
      error={{
        message: 'We could not load the branches.',
        requestId: 'req-5',
        onRetry: () => undefined,
      }}
    />
  ),
};
export const PaginationBar: Story = {
  render: function Render() {
    const [meta, setMeta] = useState({ page: 2, pageSize: 20, totalItems: 132, totalPages: 7 });
    return (
      <Pagination
        meta={meta}
        onPageChange={(page) => {
          setMeta({ ...meta, page });
        }}
        onPageSizeChange={(pageSize) => {
          setMeta({ page: 1, pageSize, totalItems: 132, totalPages: Math.ceil(132 / pageSize) });
        }}
      />
    );
  },
};
