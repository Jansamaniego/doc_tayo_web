import { isApiError } from './errors.ts';
import { newRequestId } from './request-id.ts';

/** When the server does not say how long to wait for the first press to finish. */
const DEFAULT_WAIT_SECONDS = 2;

/**
 * One idempotency key per user action (docs/api-conventions.md, "Idempotency-Key"): a form that
 * creates something makes one of these when it opens and sends every press through it. The same key
 * is used until a press succeeds, so a double tap, or pressing again after a timeout, creates one
 * thing and gets the first answer back; the next action after a success gets a new key.
 * While the first press is still running the server answers `IDEMPOTENCY_KEY_IN_USE`: wait as long
 * as it says and send the same request once more.
 */
export function createIdempotentAction({
  newKey = newRequestId,
  wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}: {
  newKey?: () => string;
  wait?: (ms: number) => Promise<void>;
} = {}): <Answer>(send: (key: string) => Promise<Answer>) => Promise<Answer> {
  let current: string | undefined;

  return async function run<Answer>(send: (key: string) => Promise<Answer>): Promise<Answer> {
    const key = (current ??= newKey());
    let answer: Answer;
    try {
      answer = await send(key);
    } catch (error) {
      if (!isApiError(error) || error.code !== 'IDEMPOTENCY_KEY_IN_USE') throw error;
      await wait((error.retryAfterSeconds ?? DEFAULT_WAIT_SECONDS) * 1000);
      answer = await send(key);
    }
    if (current === key) current = undefined;
    return answer;
  };
}
