import { t } from '@lingui/core/macro';

import type { ApiError } from '@/api/errors.ts';

import { formatWait, useCountdown } from './countdown.ts';

/**
 * For a 429 (too many attempts, or a locked account): "Please wait 2 minutes before trying again.",
 * counting down. `undefined` when there is nothing to wait for (any other error, or the wait is over).
 */
export function useRateLimitReason(failure: ApiError | undefined): string | undefined {
  const remaining = useCountdown(
    failure?.code === 'RATE_LIMITED' ? (failure.retryAfterSeconds ?? 60) : undefined,
  );
  if (remaining <= 0) return undefined;
  const duration = formatWait(remaining);
  return t`Please wait ${duration} before trying again.`;
}
