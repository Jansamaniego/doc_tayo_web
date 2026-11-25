import { useLingui } from '@lingui/react/macro';
import { useBlocker, useRouter } from '@tanstack/react-router';

import { ConfirmDialog } from '@/design-system/components/confirm-dialog.tsx';

function Guard({ shouldBlock }: { shouldBlock: () => boolean }) {
  const { t } = useLingui();
  const blocker = useBlocker({
    shouldBlockFn: () => shouldBlock(),
    // The browser asks before closing or reloading the tab.
    enableBeforeUnload: () => shouldBlock(),
    withResolver: true,
  });
  if (blocker.status !== 'blocked') return null;
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) blocker.reset();
      }}
      title={t`Leave without saving?`}
      description={t`What you typed will be lost.`}
      confirmLabel={t`Leave`}
      cancelLabel={t`Stay`}
      onConfirm={() => {
        blocker.proceed();
      }}
    />
  );
}

/**
 * Asks "Leave without saving?" before moving to another page, or closing the tab, while
 * `shouldBlock()` says there is typed input to lose. It is called at the moment of leaving, so a form
 * can answer from a ref (just saved, signed out). Outside a router it does nothing.
 */
export function LeaveGuard({ shouldBlock }: { shouldBlock: () => boolean }) {
  const router = useRouter({ warn: false }) as ReturnType<typeof useRouter> | undefined;
  return router ? <Guard shouldBlock={shouldBlock} /> : null;
}
