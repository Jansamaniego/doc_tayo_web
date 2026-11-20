import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect, vi } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

import '@/i18n/index.ts';

import { server } from './msw/server.ts';

expect.extend(axeMatchers);

// jsdom lacks these browser APIs, which Radix UI and the calendar use.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  },
);
Object.assign(Element.prototype, {
  scrollIntoView: vi.fn(),
  hasPointerCapture: vi.fn(() => false),
  setPointerCapture: vi.fn(),
  releasePointerCapture: vi.fn(),
});
vi.stubGlobal(
  'matchMedia',
  vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })),
);

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
