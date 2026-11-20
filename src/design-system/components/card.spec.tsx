import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';

import { Card, CardBody, CardFooter, CardHeader } from './card.tsx';

describe('Card', () => {
  it('has a titled header with an optional action, a body and a footer', () => {
    render(
      <Card>
        <CardHeader title="Main branch" action={<button>Edit</button>} />
        <CardBody>Quezon City</CardBody>
        <CardFooter>Updated today</CardFooter>
      </Card>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Main branch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByText('Quezon City')).toBeInTheDocument();
    expect(screen.getByText('Updated today')).toBeInTheDocument();
  });

  it('lets the page choose the heading level so the outline stays correct', () => {
    render(
      <Card>
        <CardHeader title="Details" headingLevel={2} />
      </Card>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Details' })).toBeInTheDocument();
  });

  it('can be one big link, and is reachable and activatable with the keyboard', async () => {
    render(
      <Card href="/branches/1">
        <CardHeader title="Main branch" />
      </Card>,
    );
    const link = screen.getByRole('link', { name: /Main branch/ });
    expect(link).toHaveAttribute('href', '/branches/1');
    await userEvent.tab();
    expect(link).toHaveFocus();
  });

  it('has no accessibility violations (plain and linked)', async () => {
    const { container } = render(
      <>
        <Card>
          <CardHeader title="Plain" />
          <CardBody>Body</CardBody>
        </Card>
        <Card href="/x">
          <CardHeader title="Linked" />
        </Card>
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
