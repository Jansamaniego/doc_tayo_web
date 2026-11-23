import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Makes `min-width` media queries match, so a list renders as a table (a small screen shows cards).
 * Call it once at the top of a spec.
 */
export function mockWideScreen(): void {
  const original = window.matchMedia.bind(window);
  beforeEach(() => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes('min-width'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }));
  });
  afterEach(() => {
    window.matchMedia = original;
  });
}
