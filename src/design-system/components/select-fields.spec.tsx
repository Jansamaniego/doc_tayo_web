import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { Combobox, SelectField } from './select-fields.tsx';

const BRANCHES = [
  { value: 'main', label: 'Main' },
  { value: 'qc', label: 'Quezon City Annex' },
  { value: 'cebu', label: 'Cebu' },
];

describe('SelectField (native select, for short lists)', () => {
  it('carries a name, so a link in an error summary can focus it', () => {
    renderWithProviders(
      <SelectField label="Branch" name="branch" options={[]} value="" onChange={() => undefined} />,
    );
    expect(screen.getByLabelText('Branch')).toHaveAttribute('name', 'branch');
  });

  it('is a real select with a visible label and all options', () => {
    renderWithProviders(
      <SelectField label="Branch" options={BRANCHES} value="" onChange={() => undefined} />,
    );
    const select = screen.getByRole('combobox', { name: 'Branch' });
    expect(select.tagName).toBe('SELECT');
    expect(within(select).getAllByRole('option')).toHaveLength(3);
  });

  it('can start with an explicit "Choose" option instead of a placeholder', () => {
    renderWithProviders(
      <SelectField
        label="Branch"
        options={BRANCHES}
        value=""
        onChange={() => undefined}
        emptyOption="Choose a branch"
      />,
    );
    const options = within(screen.getByRole('combobox')).getAllByRole('option');
    expect(options[0]).toHaveTextContent('Choose a branch');
    expect(options[0]).toHaveValue('');
  });

  it('reports the chosen value', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <SelectField label="Branch" options={BRANCHES} value="main" onChange={onChange} />,
    );
    await userEvent.selectOptions(screen.getByRole('combobox'), 'qc');
    expect(onChange).toHaveBeenCalledWith('qc');
  });

  it('shows hint and error, and is at least 48 px high', () => {
    renderWithProviders(
      <SelectField
        label="Branch"
        options={BRANCHES}
        value=""
        onChange={() => undefined}
        hint="Where you work"
        error="Choose a branch."
      />,
    );
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription(/Choose a branch\./);
    expect(select.className).toContain('min-h-control-md');
  });

  it('lists options under their group headings, ungrouped ones first', async () => {
    const { container } = renderWithProviders(
      <SelectField
        label="Practitioner"
        value=""
        onChange={() => undefined}
        emptyOption="Choose a practitioner"
        options={[]}
        groups={[
          { label: 'Works at Main', options: [{ value: '1', label: 'Dr. Ana' }] },
          { label: 'Nobody here', options: [] },
          { label: 'Other practitioners', options: [{ value: '2', label: 'Dr. Ben' }] },
        ]}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Practitioner' });
    expect(
      within(select)
        .getAllByRole('group')
        .map((group) => group.getAttribute('label')),
    ).toEqual(['Works at Main', 'Other practitioners']);
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Choose a practitioner', 'Dr. Ana', 'Dr. Ben']);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <SelectField
        label="Branch"
        options={BRANCHES}
        value="main"
        onChange={() => undefined}
        error="Oops"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

function ComboboxHarness({ onChange = () => undefined }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <Combobox
      label="Doctor"
      options={[
        { value: '1', label: 'Dr. Ana Reyes' },
        { value: '2', label: 'Dr. Ben Lim' },
        { value: '3', label: 'Dr. Carla Reyes-Santos' },
      ]}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('Combobox (searchable list, for long lists)', () => {
  it('carries a name, so a link in an error summary can focus it', () => {
    renderWithProviders(
      <Combobox label="Person" name="person" options={[]} value="" onChange={() => undefined} />,
    );
    expect(screen.getByRole('combobox', { name: 'Person' })).toHaveAttribute('name', 'person');
  });

  it('is a labelled button that says whether the list is open', async () => {
    renderWithProviders(<ComboboxHarness />);
    const trigger = screen.getByRole('combobox', { name: /Doctor/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findAllByRole('option')).toHaveLength(3);
  });

  it('filters as you type and announces how many results there are', async () => {
    renderWithProviders(<ComboboxHarness />);
    await userEvent.click(screen.getByRole('combobox', { name: /Doctor/ }));
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search' }), 'reyes');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByText('2 results')).toBeInTheDocument();
  });

  it('counts a single result in the singular', async () => {
    renderWithProviders(<ComboboxHarness />);
    await userEvent.click(screen.getByRole('combobox', { name: /Doctor/ }));
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search' }), 'ben');
    expect(screen.getByText('1 result')).toBeInTheDocument();
  });

  it('says so plainly when nothing matches', async () => {
    renderWithProviders(<ComboboxHarness />);
    await userEvent.click(screen.getByRole('combobox', { name: /Doctor/ }));
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search' }), 'zzz');
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('chooses with the mouse: closes and shows the choice on the button', async () => {
    const onChange = vi.fn();
    renderWithProviders(<ComboboxHarness onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox', { name: /Doctor/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Dr. Ben Lim' }));
    expect(onChange).toHaveBeenCalledWith('2');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Doctor/ })).toHaveTextContent('Dr. Ben Lim');
  });

  it('works from the keyboard: open, arrow down, Enter chooses, and focus returns to the button', async () => {
    const onChange = vi.fn();
    renderWithProviders(<ComboboxHarness onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: /Doctor/ });
    await userEvent.tab();
    expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('searchbox', { name: 'Search' });
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it('closes with Escape and returns focus to the button', async () => {
    renderWithProviders(<ComboboxHarness />);
    const trigger = screen.getByRole('combobox', { name: /Doctor/ });
    await userEvent.click(trigger);
    await screen.findAllByRole('option');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('has no accessibility violations, closed and open', async () => {
    const { container } = renderWithProviders(<ComboboxHarness />);
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('combobox', { name: /Doctor/ }));
    await screen.findAllByRole('option');
    // The popover is portalled outside the container. A bare test body has no <main>, so the page-level
    // landmark rule is off here (landmarks are checked on the app shell and in e2e).
    expect(
      await axe(document.body, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});

const PEOPLE = [
  { value: 'p1', label: 'Dela Cruz, Juan' },
  { value: 'p2', label: 'Santos, Maria' },
];

function ServerSearchHarness({
  loading = false,
  options = PEOPLE,
  selectedLabel,
  onQueryChange = () => undefined,
  onChange = () => undefined,
}: {
  loading?: boolean;
  options?: typeof PEOPLE;
  selectedLabel?: string;
  onQueryChange?: (query: string) => void;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(selectedLabel ? 'elsewhere' : '');
  return (
    <Combobox
      label="Patient"
      options={options}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      search={{ onQueryChange, loading, selectedLabel, empty: <a href="/new">Add them</a> }}
    />
  );
}

describe('Combobox searched by the server', () => {
  const open = async () => {
    await userEvent.click(screen.getByRole('combobox', { name: /Patient/ }));
    return screen.findByRole('searchbox', { name: 'Search' });
  };

  it('does no filtering of its own and reports what is typed', async () => {
    const onQueryChange = vi.fn();
    renderWithProviders(<ServerSearchHarness onQueryChange={onQueryChange} />);
    await userEvent.type(await open(), 'zzz');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(onQueryChange).toHaveBeenLastCalledWith('zzz');
  });

  it('starts each opening with an empty search', async () => {
    const onQueryChange = vi.fn();
    renderWithProviders(<ServerSearchHarness onQueryChange={onQueryChange} />);
    await userEvent.type(await open(), 'ab');
    await userEvent.keyboard('{Escape}');
    expect(await open()).toHaveValue('');
    expect(onQueryChange).toHaveBeenLastCalledWith('');
  });

  it('announces that it is searching, and shows no old results meanwhile', async () => {
    renderWithProviders(<ServerSearchHarness loading />);
    await open();
    expect(screen.getByText('Searching…')).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.queryByRole('link', { name: 'Add them' })).not.toBeInTheDocument();
  });

  it('announces how many results there are', async () => {
    renderWithProviders(<ServerSearchHarness />);
    await open();
    expect(screen.getByText('2 results')).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('link', { name: 'Add them' })).not.toBeInTheDocument();
  });

  it('offers what the caller gives when nothing is found', async () => {
    renderWithProviders(<ServerSearchHarness options={[]} />);
    await open();
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add them' })).toBeInTheDocument();
  });

  it('names the choice on the button even when the results no longer hold it', () => {
    renderWithProviders(<ServerSearchHarness selectedLabel="Reyes, Angela" />);
    expect(screen.getByRole('combobox', { name: /Patient/ })).toHaveTextContent('Reyes, Angela');
  });

  it('works from the keyboard alone', async () => {
    const onChange = vi.fn();
    renderWithProviders(<ServerSearchHarness onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: /Patient/ });
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('searchbox', { name: 'Search' });
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('p2');
    expect(trigger).toHaveFocus();
  });

  it('has no accessibility violations when open, with and without results', async () => {
    const { rerender } = renderWithProviders(<ServerSearchHarness />);
    await open();
    const rules = { rules: { region: { enabled: false } } };
    expect(await axe(document.body, rules)).toHaveNoViolations();
    rerender(<ServerSearchHarness options={[]} />);
    expect(await axe(document.body, rules)).toHaveNoViolations();
  });
});
