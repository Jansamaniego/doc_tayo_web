import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';

import { TextLink } from './link.tsx';

describe('TextLink', () => {
  it('is underlined, so a link is never told apart by colour alone', () => {
    render(<TextLink href="/help">Help</TextLink>);
    const link = screen.getByRole('link', { name: 'Help' });
    expect(link.className).toContain('underline');
    expect(link).toHaveAttribute('href', '/help');
  });

  it('standalone links get an arrow icon that screen readers skip', () => {
    const { container } = render(
      <TextLink href="/help" standalone>
        Go to help
      </TextLink>,
    );
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Go to help' })).toBeInTheDocument();
  });

  it('has a touch target of at least 44 px when standalone', () => {
    render(
      <TextLink href="/help" standalone>
        Go to help
      </TextLink>,
    );
    expect(screen.getByRole('link').className).toContain('min-h-target');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <p>
        Read the <TextLink href="/help">help page</TextLink>.
      </p>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
