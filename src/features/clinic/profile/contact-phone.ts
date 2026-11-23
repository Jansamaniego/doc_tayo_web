/** The API accepts international format only: `+`, then 7 to 15 digits, the first not 0. */
const INTERNATIONAL_PHONE = /^\+[1-9]\d{6,14}$/;

export type ParsedContactPhone =
  { status: 'empty' } | { status: 'valid'; phone: string } | { status: 'invalid' };

/**
 * What the person typed, ready to send. Spaces, dashes, dots and brackets are for reading and are
 * removed. A country code is never added: guessing `+63` would store a wrong number for a foreign one.
 */
export function parseContactPhone(typed: string): ParsedContactPhone {
  const trimmed = typed.trim();
  if (trimmed === '') return { status: 'empty' };
  const phone = trimmed.replace(/[\s\-.()]/g, '');
  return INTERNATIONAL_PHONE.test(phone) ? { status: 'valid', phone } : { status: 'invalid' };
}
