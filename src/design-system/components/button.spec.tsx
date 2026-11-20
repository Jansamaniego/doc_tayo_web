import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plus } from 'lucide-react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button.tsx';

describe('Button', () => {
  it('is a real button with a visible text label', () => {
    render(<Button>Save patient</Button>);
    expect(screen.getByRole('button', { name: 'Save patient' })).toBeInTheDocument();
  });

  it('cannot be written without a label (no icon-only buttons)', () => {
    // @ts-expect-error children (the label) is required
    render(<Button icon={<Plus />} />);
    // @ts-expect-error there is no icon-only size
    render(<Button size="icon">Add</Button>);
  });

  it('shows an optional icon next to the label, hidden from screen readers', () => {
    render(<Button icon={<Plus data-testid="icon" />}>Add patient</Button>);
    expect(screen.getByTestId('icon')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Add patient' })).toBeInTheDocument();
  });

  it('calls onClick, but not when disabled', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('works from the keyboard', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  describe('sizes (touch targets of at least 44 px)', () => {
    it('is 48 px high by default and 56 px for the large size', () => {
      const { rerender } = render(<Button>Save</Button>);
      expect(screen.getByRole('button').className).toContain('min-h-control-md');
      rerender(<Button size="lg">Save</Button>);
      expect(screen.getByRole('button').className).toContain('min-h-control-lg');
    });

    it('is never narrower than the 44 px target', () => {
      render(<Button>OK</Button>);
      expect(screen.getByRole('button').className).toContain('min-w-target');
    });
  });

  describe('unavailable (disabled with a reason)', () => {
    it('stays focusable and announces that it is disabled, so the reason can be read', async () => {
      const onClick = vi.fn();
      render(
        <>
          <Button unavailable aria-describedby="why" onClick={onClick}>
            Add branch
          </Button>
          <p id="why">Only clinic admins can add branches.</p>
        </>,
      );
      const button = screen.getByRole('button', { name: 'Add branch' });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).not.toBeDisabled();
      await userEvent.tab();
      expect(button).toHaveFocus();
      await userEvent.click(button);
      await userEvent.keyboard('{Enter}');
      expect(onClick).not.toHaveBeenCalled();
      expect(button).toHaveAccessibleDescription('Only clinic admins can add branches.');
    });
  });

  describe('loading', () => {
    it('shows the loading text, is busy, and ignores repeat presses', async () => {
      const onClick = vi.fn();
      render(
        <Button loading loadingText="Saving…" onClick={onClick}>
          Save branch
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Saving…' });
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      await userEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('keeps its label when no loading text is given', () => {
      render(<Button loading>Save branch</Button>);
      expect(screen.getByRole('button', { name: 'Save branch' })).toHaveAttribute(
        'aria-busy',
        'true',
      );
    });
  });

  it('can render as another element, for example a link', () => {
    render(
      <Button asChild>
        <a href="/patients">Patients</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Patients' })).toHaveAttribute('href', '/patients');
  });

  it('has a distinct look for each variant (never colour alone: text label always present)', () => {
    const variants = ['primary', 'secondary', 'tertiary', 'danger', 'danger-secondary'] as const;
    const classes = variants.map((variant) => {
      const { unmount } = render(<Button variant={variant}>Do it</Button>);
      const value = screen.getByRole('button').className;
      unmount();
      return value;
    });
    expect(new Set(classes).size).toBe(variants.length);
  });

  it('has no accessibility violations in any variant or state', async () => {
    const { container } = render(
      <>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="tertiary">Tertiary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="danger-secondary">Danger outline</Button>
        <Button disabled>Disabled</Button>
        <Button unavailable>Unavailable</Button>
        <Button loading loadingText="Saving…">
          Save
        </Button>
        <Button icon={<Plus />}>With icon</Button>
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
