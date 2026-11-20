import { describe, expect, it, vi } from 'vitest';

import { createSingleFlight } from './single-flight.ts';

describe('createSingleFlight', () => {
  it('runs the work once for three concurrent callers and gives them all the result', async () => {
    let resolve!: (value: string) => void;
    const work = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const run = createSingleFlight(work);

    const results = Promise.all([run(), run(), run()]);
    resolve('token-1');

    expect(await results).toEqual(['token-1', 'token-1', 'token-1']);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('starts a new run once the previous one has settled', async () => {
    const work = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b');
    const run = createSingleFlight<string>(work);

    expect(await run()).toBe('a');
    expect(await run()).toBe('b');
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('rejects every waiter on failure, then allows a retry', async () => {
    let reject!: (error: Error) => void;
    const work = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(() => new Promise<string>((_r, rej) => (reject = rej)))
      .mockResolvedValueOnce('recovered');
    const run = createSingleFlight(work);

    const first = run();
    const second = run();
    reject(new Error('signed-out'));

    await expect(first).rejects.toThrow('signed-out');
    await expect(second).rejects.toThrow('signed-out');
    expect(await run()).toBe('recovered');
    expect(work).toHaveBeenCalledTimes(2);
  });
});
