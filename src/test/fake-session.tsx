import { vi } from 'vitest';

import type { SessionController } from '@/api/session/session.ts';

/** A session controller whose every action is a spy, for testing a screen without the network. */
export function fakeController(overrides: Partial<SessionController> = {}): SessionController {
  return {
    boot: vi.fn(() => Promise.resolve()),
    signIn: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve()),
    signOutEverywhere: vi.fn(() => Promise.resolve()),
    endSession: vi.fn(() => Promise.resolve()),
    switchClinic: vi.fn(() => Promise.resolve()),
    refreshPermissions: vi.fn(() => Promise.resolve()),
    subscribe: vi.fn(() => () => undefined),
    close: vi.fn(),
    ...overrides,
  };
}
