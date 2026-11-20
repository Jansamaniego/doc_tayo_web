import { screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { NotFoundPage } from './NotFoundPage.tsx';

describe('NotFoundPage', () => {
  it('tells the person plainly and offers a way back', () => {
    renderWithProviders(<NotFoundPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'We could not find this page' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  });

  it('sets the page title', () => {
    renderWithProviders(<NotFoundPage />);
    expect(document.title).toBe('Page not found');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<NotFoundPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
