import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTabSync, type TabMessage } from './tab-sync.ts';

const open: { close: () => void }[] = [];
afterEach(() => {
  for (const sync of open.splice(0)) sync.close();
  vi.unstubAllGlobals();
});

function tab(name: string, received: TabMessage[]) {
  const sync = createTabSync({ name, onMessage: (message) => received.push(message) });
  open.push(sync);
  return sync;
}

describe('createTabSync (the tabs of one browser tell each other what happened)', () => {
  it('delivers a message to the other tabs, but not back to the sender', async () => {
    const a: TabMessage[] = [];
    const b: TabMessage[] = [];
    const tabA = tab('t1', a);
    tab('t1', b);
    tabA.post({ type: 'signed-out' });
    await vi.waitFor(() => {
      expect(b).toEqual([{ type: 'signed-out' }]);
    });
    expect(a).toEqual([]);
  });

  it('carries the clinic that was switched to', async () => {
    const b: TabMessage[] = [];
    tab('t2', []).post({ type: 'clinic-switched', tenantId: 'clinic-9' });
    tab('t2', b);
    const sender = tab('t2', []);
    sender.post({ type: 'clinic-switched', tenantId: 'clinic-9' });
    await vi.waitFor(() => {
      expect(b).toContainEqual({ type: 'clinic-switched', tenantId: 'clinic-9' });
    });
  });

  it('keeps channels with different names apart', async () => {
    const b: TabMessage[] = [];
    tab('t3a', []).post({ type: 'signed-out' });
    tab('t3b', b);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(b).toEqual([]);
  });

  it('ignores a message it does not understand', async () => {
    const b: TabMessage[] = [];
    tab('t4', b);
    const rogue = new BroadcastChannel('t4');
    rogue.postMessage({ type: 'something-else', evil: true });
    rogue.postMessage('a string');
    rogue.postMessage(null);
    tab('t4', []).post({ type: 'activity' });
    await vi.waitFor(() => {
      expect(b).toEqual([{ type: 'activity' }]);
    });
    rogue.close();
  });

  it('stops delivering after close', async () => {
    const b: TabMessage[] = [];
    const receiver = tab('t5', b);
    receiver.close();
    tab('t5', []).post({ type: 'signed-out' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(b).toEqual([]);
  });

  it('does nothing, and does not throw, where BroadcastChannel is not available', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const sync = createTabSync({ name: 'x', onMessage: () => undefined });
    expect(() => {
      sync.post({ type: 'signed-out' });
      sync.close();
    }).not.toThrow();
  });
});
