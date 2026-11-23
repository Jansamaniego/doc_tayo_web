// The tabs of one browser share the same cookie and the same server session, so they must hear about
// a sign-out or a clinic switch made in another tab (plan.md §5.3). BroadcastChannel never delivers a
// message back to the tab that sent it.
export type TabMessage =
  { type: 'signed-out' } | { type: 'clinic-switched'; tenantId: string } | { type: 'activity' };

function isTabMessage(value: unknown): value is TabMessage {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as { type?: unknown; tenantId?: unknown };
  if (message.type === 'signed-out' || message.type === 'activity') return true;
  return message.type === 'clinic-switched' && typeof message.tenantId === 'string';
}

export interface TabSync {
  post: (message: TabMessage) => void;
  close: () => void;
}

export function createTabSync({
  name = 'dt-session',
  onMessage,
}: {
  name?: string;
  onMessage: (message: TabMessage) => void;
}): TabSync {
  if (typeof BroadcastChannel === 'undefined')
    return { post: () => undefined, close: () => undefined };
  const channel = new BroadcastChannel(name);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (isTabMessage(event.data)) onMessage(event.data);
  };
  return {
    post: (message) => {
      channel.postMessage(message);
    },
    close: () => {
      channel.close();
    },
  };
}
