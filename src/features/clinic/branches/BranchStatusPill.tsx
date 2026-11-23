import { useLingui } from '@lingui/react/macro';

import { StatusPill } from '@/design-system/components/badge.tsx';

/** Active or Inactive in words (the colour is a second cue, never the only one). */
export function BranchStatusPill({ isActive }: { isActive: boolean }) {
  const { t } = useLingui();
  return (
    <StatusPill status={isActive ? 'success' : 'neutral'}>
      {isActive ? t`Active` : t`Inactive`}
    </StatusPill>
  );
}
