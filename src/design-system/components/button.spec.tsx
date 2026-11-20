import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button.tsx';

describe('Button', () => {
  it('is a real button with a visible text label', () => {
    render(<Button>Save patient</Button>);
    expect(screen.getByRole('button', { name: 'Save patient' })).toBeInTheDocument();
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

  it('is at least 44x44 px by class (the 48 px minimum height token)', () => {
    render(<Button>Save</Button>);
    const classes = screen.getByRole('button').className;
    expect(classes).toContain('min-h-12');
    expect(classes).toContain('min-w-11');
  });

  it('can render as another element, for example a link', () => {
    render(
      <Button asChild>
        <a href="/patients">Patients</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Patients' })).toHaveAttribute('href', '/patients');
  });

  it('has no accessibility violations in either variant', async () => {
    const { container } = render(
      <>
        <Button>Save</Button>
        <Button variant="secondary">Cancel</Button>
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
