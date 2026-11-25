import { describe, expect, it, vi } from 'vitest';

import { ApiError } from './errors.ts';
import { createIdempotentAction } from './idempotency.ts';

const failure = (
  code: ApiError['code'],
  over: { status?: number; retryAfterSeconds?: number } = {},
) => new ApiError({ status: 409, code, message: 'x', details: [], ...over });

function setup() {
  let made = 0;
  const wait = vi.fn(() => Promise.resolve());
  const run = createIdempotentAction({ newKey: () => `key-${(made += 1)}`, wait });
  const keys: string[] = [];
  /** A request that answers with each outcome in turn, remembering the key it was sent with. */
  const request = (...outcomes: (ApiError | string)[]) =>
    vi.fn((key: string) => {
      keys.push(key);
      const next = outcomes.shift() ?? 'ok';
      return typeof next === 'string' ? Promise.resolve(next) : Promise.reject(next);
    });
  return { run, wait, keys, request };
}

describe('createIdempotentAction (one key per user action, reused for its retries)', () => {
  it('sends the request with a key and returns its answer', async () => {
    const { run, keys, request } = setup();
    await expect(run(request('created'))).resolves.toBe('created');
    expect(keys).toEqual(['key-1']);
  });

  it('uses a new key for the next action after a success', async () => {
    const { run, keys, request } = setup();
    await run(request('first'));
    await run(request('second'));
    expect(keys).toEqual(['key-1', 'key-2']);
  });

  it.each(['NETWORK_ERROR', 'INTERNAL_ERROR', 'VALIDATION_FAILED'] as const)(
    'keeps the key after %s, so pressing again repeats the same action',
    async (code) => {
      const { run, keys, request } = setup();
      await expect(run(request(failure(code)))).rejects.toMatchObject({ code });
      await run(request('ok'));
      expect(keys).toEqual(['key-1', 'key-1']);
    },
  );

  it('when the first press is still running, waits as long as the server asks and sends the same key once more', async () => {
    const { run, wait, keys, request } = setup();
    const send = request(failure('IDEMPOTENCY_KEY_IN_USE', { retryAfterSeconds: 1 }), 'replayed');
    await expect(run(send)).resolves.toBe('replayed');
    expect(wait).toHaveBeenCalledExactlyOnceWith(1000);
    expect(keys).toEqual(['key-1', 'key-1']);
  });

  it('waits 2 seconds when the server does not say how long', async () => {
    const { run, wait, request } = setup();
    await run(request(failure('IDEMPOTENCY_KEY_IN_USE'), 'ok'));
    expect(wait).toHaveBeenCalledExactlyOnceWith(2000);
  });

  it('gives up after the second "still running", keeping the key', async () => {
    const { run, wait, keys, request } = setup();
    const busy = () => failure('IDEMPOTENCY_KEY_IN_USE', { retryAfterSeconds: 1 });
    await expect(run(request(busy(), busy()))).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_IN_USE',
    });
    expect(wait).toHaveBeenCalledTimes(1);
    await run(request('ok'));
    expect(keys).toEqual(['key-1', 'key-1', 'key-1']);
  });

  it('does not retry any other failure', async () => {
    const { run, wait, request } = setup();
    const send = request(failure('VERSION_CONFLICT'));
    await expect(run(send)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('gives two overlapping presses the same key (a double tap creates one thing)', async () => {
    const { run, keys } = setup();
    let finish: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const send = async (key: string) => {
      keys.push(key);
      await slow;
      return 'ok';
    };
    const both = Promise.all([run(send), run(send)]);
    finish();
    await both;
    expect(keys).toEqual(['key-1', 'key-1']);
  });

  it('makes a canonical UUIDv7 key by default', async () => {
    const run = createIdempotentAction();
    let sent = '';
    await run((key) => {
      sent = key;
      return Promise.resolve();
    });
    expect(sent).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
