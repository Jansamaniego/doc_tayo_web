import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PrintPage } from './print-page.tsx';

describe('PrintPage (print layout primitive)', () => {
  it('lays out a header, the body and a footer', () => {
    render(
      <PrintPage paper="a4" header={<p>Sunrise Clinic</p>} footer={<p>Page footer</p>}>
        <p>Body</p>
      </PrintPage>,
    );
    expect(screen.getByText('Sunrise Clinic')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Page footer')).toBeInTheDocument();
  });

  it('chooses the paper size per template', () => {
    const { container, rerender } = render(
      <PrintPage paper="a4">
        <p>x</p>
      </PrintPage>,
    );
    expect(container.firstElementChild?.className).toContain('print-a4');
    rerender(
      <PrintPage paper="half-letter">
        <p>x</p>
      </PrintPage>,
    );
    expect(container.firstElementChild?.className).toContain('print-half-letter');
  });

  it('is plain on screen and for print only hides nothing it contains', () => {
    const { container } = render(
      <PrintPage paper="a4">
        <p>x</p>
      </PrintPage>,
    );
    expect(container.firstElementChild?.className).not.toContain('print:hidden');
  });
});
