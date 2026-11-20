import { setupServer } from 'msw/node';

// Default handlers are empty on purpose: every spec declares the requests it expects, and an
// unexpected request fails the test (onUnhandledFrame: 'error').
export const server = setupServer();
