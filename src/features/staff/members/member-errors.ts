import { msg } from '@lingui/core/macro';

import { messageForError } from '@/api/error-messages.ts';
import type { ApiError } from '@/api/errors.ts';
import { i18n } from '@/i18n/index.ts';

// What the staff screens say for the codes the API gives for a change to a member. They are more
// specific than the general texts in src/api/error-messages.ts.
const MEMBER_MESSAGES = {
  SELF_ACTION_FORBIDDEN: msg`You cannot change your own roles or status. Another admin must do it.`,
  OWNER_REQUIRED: msg`Only an owner can change the Owner role or an owner's status.`,
  LAST_OWNER: msg`The clinic must keep at least one active owner.`,
  CONFLICT: msg`This person was changed by someone else. Check their details and try again.`,
} as const;

/** The codes that are a rule of the clinic, not a fault: shown as a warning, not as an error. */
export function isMemberRuleError(error: ApiError): boolean {
  return error.code in MEMBER_MESSAGES;
}

export function memberErrorMessage(error: ApiError): string {
  return isMemberRuleError(error)
    ? i18n._(MEMBER_MESSAGES[error.code as keyof typeof MEMBER_MESSAGES])
    : messageForError(error);
}
