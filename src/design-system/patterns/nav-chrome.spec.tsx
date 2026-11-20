import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { Avatar } from './avatar.tsx';
import { BranchSelector, ClinicSwitcher } from './clinic-switcher.tsx';
import { PageHeader } from './page-header.tsx';
import { UserMenu } from './user-menu.tsx';

describe('Avatar', () => {
  it('shows initials, hidden from screen readers (the name is always written next to it)', () => {
    renderWithProviders(<Avatar name="Ana Cruz" />);
    const initials = screen.getByText('AC');
    expect(initials).toHaveAttribute('aria-hidden', 'true');
  });

  it('copes with one word, extra spaces and no name', () => {
    const { rerender } = renderWithProviders(<Avatar name="Madonna" />);
    expect(screen.getByText('M')).toBeInTheDocument();
    rerender(<Avatar name="  juan   dela   cruz " />);
    expect(screen.getByText('JC')).toBeInTheDocument();
    rerender(<Avatar name="" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});

describe('ClinicSwitcher', () => {
  const CLINICS = [
    { id: 'a', name: 'Sunrise Clinic', status: 'active' as const },
    { id: 'b', name: 'Harbor Clinic', status: 'active' as const },
    { id: 'c', name: 'Old Town Clinic', status: 'suspended' as const },
  ];

  it('shows just the clinic name, in full, when there is only one (no dropdown)', () => {
    renderWithProviders(
      <ClinicSwitcher clinics={CLINICS.slice(0, 1)} currentId="a" onSelect={() => undefined} />,
    );
    expect(screen.getByText('Sunrise Clinic')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the current clinic in full on a button that says it switches', async () => {
    renderWithProviders(
      <ClinicSwitcher clinics={CLINICS} currentId="a" onSelect={() => undefined} />,
    );
    const button = screen.getByRole('button', { name: /Sunrise Clinic/ });
    expect(button).toHaveTextContent('Switch clinic');
    await userEvent.click(button);
    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(3);
  });

  it('lists a suspended clinic as unavailable, in words, and does not let it be chosen', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<ClinicSwitcher clinics={CLINICS} currentId="a" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /Sunrise Clinic/ }));
    const suspended = await screen.findByRole('menuitemradio', { name: /Old Town Clinic/ });
    expect(suspended).toHaveTextContent('Suspended');
    expect(suspended).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(suspended);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('chooses another clinic', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<ClinicSwitcher clinics={CLINICS} currentId="a" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /Sunrise Clinic/ }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Harbor Clinic' }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <ClinicSwitcher clinics={CLINICS} currentId="a" onSelect={() => undefined} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('BranchSelector', () => {
  it('is a labelled select showing branch names in full', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <BranchSelector
        branches={[
          { id: '1', name: 'Main' },
          { id: '2', name: 'Quezon City Annex' },
        ]}
        value="1"
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Branch' }),
      'Quezon City Annex',
    );
    expect(onChange).toHaveBeenCalledWith('2');
  });
});

describe('UserMenu', () => {
  it('shows the name and opens a menu with words for every action', async () => {
    const handlers = { onAccount: vi.fn(), onSignOut: vi.fn(), onSignOutEverywhere: vi.fn() };
    renderWithProviders(<UserMenu name="Ana Cruz" {...handlers} />);
    const button = screen.getByRole('button', { name: /Ana Cruz/ });
    await userEvent.click(button);
    expect(await screen.findByRole('menuitem', { name: 'My account' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out on all devices' }));
    expect(handlers.onSignOutEverywhere).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Ana Cruz/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(handlers.onSignOut).toHaveBeenCalled();
  });

  it('works from the keyboard and returns focus to its button', async () => {
    renderWithProviders(
      <UserMenu
        name="Ana Cruz"
        onAccount={() => undefined}
        onSignOut={() => undefined}
        onSignOutEverywhere={() => undefined}
      />,
    );
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('menu');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /Ana Cruz/ })).toHaveFocus();
  });

  it('has no accessibility violations, closed and open', async () => {
    const { container } = renderWithProviders(
      <UserMenu
        name="Ana Cruz"
        onAccount={() => undefined}
        onSignOut={() => undefined}
        onSignOutEverywhere={() => undefined}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: /Ana Cruz/ }));
    await screen.findByRole('menu');
    expect(
      await axe(document.body, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});

describe('PageHeader', () => {
  it('has the one level-1 heading of the page', () => {
    renderWithProviders(<PageHeader title="Branches" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Branches' })).toBeInTheDocument();
  });

  it('shows a breadcrumb with the current page marked', () => {
    renderWithProviders(
      <PageHeader
        title="Edit branch"
        breadcrumbs={[{ label: 'Branches', href: '/branches' }, { label: 'Main' }]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Branches' })).toHaveAttribute(
      'href',
      '/branches',
    );
    expect(within(nav).getByText('Main')).toHaveAttribute('aria-current', 'page');
  });

  it('has one primary action, and the others in a labelled "More actions" overflow', async () => {
    const onExport = vi.fn();
    renderWithProviders(
      <PageHeader
        title="Branches"
        primaryAction={<button>Add branch</button>}
        moreActions={[
          { label: 'Export list', onSelect: onExport },
          { label: 'Print list', onSelect: () => undefined },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Add branch' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Export list' }));
    expect(onExport).toHaveBeenCalled();
  });

  it('has no overflow button without secondary actions', () => {
    renderWithProviders(<PageHeader title="Branches" />);
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <PageHeader
        title="Edit branch"
        breadcrumbs={[{ label: 'Branches', href: '/branches' }, { label: 'Main' }]}
        primaryAction={<button>Save</button>}
        moreActions={[{ label: 'Archive', onSelect: () => undefined }]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
