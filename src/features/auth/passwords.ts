import { msg } from '@lingui/core/macro';

import type { PasswordRule } from '@/design-system/components/text-fields.tsx';
import { i18n } from '@/i18n/index.ts';

const LENGTH = msg`10 to 128 characters`;
const NO_EMAIL = msg`Does not contain your email address`;
const COMMON = msg`We also check that it is not a very common password.`;

/** The check only the server can make. */
export const PASSWORD_HINT = (): string => i18n._(COMMON);

/**
 * Live hints for a new password. The server decides (docs/frontend-integration.md §7): 10 to 128
 * characters counted as code points, not a very common password, not containing the email address.
 * No uppercase, digit or symbol rule.
 */
export function passwordRules({
  password,
  email,
}: {
  password: string;
  email?: string;
}): PasswordRule[] {
  const length = Array.from(password.normalize('NFKC')).length;
  const rules: PasswordRule[] = [{ text: i18n._(LENGTH), met: length >= 10 && length <= 128 }];
  if (email) {
    rules.push({
      text: i18n._(NO_EMAIL),
      met: password !== '' && !password.toLowerCase().includes(email.toLowerCase()),
    });
  }
  return rules;
}
