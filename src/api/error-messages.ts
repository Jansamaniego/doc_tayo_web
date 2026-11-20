import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';

import { i18n } from '@/i18n/index.ts';

import type { ApiError, ErrorCode, FieldError, FieldErrorCode } from './errors.ts';

// Plain-language text shown to people, keyed by the API's stable `code` (never by its message).
// Drafted from the "Do this" column of docs/frontend-integration.md §6.
const ERROR_MESSAGES: Record<ErrorCode | 'NETWORK_ERROR', MessageDescriptor> = {
  VALIDATION_FAILED: msg`Some fields need attention.`,
  BAD_REQUEST: msg`We could not understand that request. Please try again.`,
  MALFORMED_JSON: msg`The information could not be read. Please try again.`,
  PAYLOAD_TOO_LARGE: msg`That is too large to send. Please send less information.`,
  UNSUPPORTED_MEDIA_TYPE: msg`That kind of file is not supported.`,
  ROUTE_NOT_FOUND: msg`We could not find that page.`,
  NOT_FOUND: msg`We could not find what you were looking for.`,
  CONFLICT_UNIQUE: msg`This already exists.`,
  CONFLICT_REFERENCE: msg`This is linked to other information, so it cannot be changed this way.`,
  NOT_READY: msg`The service is starting up. Please try again in a moment.`,
  SERVICE_UNAVAILABLE: msg`The service is not available right now. Please try again shortly.`,
  INTERNAL_ERROR: msg`Something went wrong on our side. Please try again.`,
  UNAUTHENTICATED: msg`Please sign in to continue.`,
  FORBIDDEN: msg`You do not have permission to do this.`,
  TENANT_NOT_SELECTED: msg`Please choose a clinic to continue.`,
  TENANT_SUSPENDED: msg`This clinic's access is suspended for now.`,
  TENANT_DEACTIVATED: msg`This clinic is no longer active.`,
  TENANT_ACCESS_DENIED: msg`You do not have access to this clinic.`,
  INVALID_CREDENTIALS: msg`The email or password is incorrect.`,
  ACCESS_TOKEN_EXPIRED: msg`Your session needs to be renewed. Please try again.`,
  TOKEN_INVALID: msg`This link is not valid or has expired. Please ask for a new one.`,
  ROLE_NOT_ASSIGNABLE: msg`This role cannot be given through an invitation.`,
  CONFLICT: msg`This cannot be done while the record is in its current state.`,
  METHOD_NOT_ALLOWED: msg`This action is not allowed here.`,
  RATE_LIMITED: msg`Too many attempts. Please wait a moment and try again.`,
  NETWORK_ERROR: msg`We could not connect. Check your internet connection and try again.`,
};

const FIELD_MESSAGES: Record<FieldErrorCode, MessageDescriptor> = {
  REQUIRED: msg`Please fill in this field.`,
  INVALID_FORMAT: msg`This is not in the expected format.`,
  INVALID_TYPE: msg`This is not the right kind of value.`,
  INVALID_VALUE: msg`This value is not allowed.`,
  OUT_OF_RANGE: msg`This is outside the allowed range.`,
  TOO_SHORT: msg`This is too short.`,
  TOO_LONG: msg`This is too long.`,
  UNKNOWN_FIELD: msg`This field is not accepted.`,
  PASSWORD_TOO_COMMON: msg`This password is too easy to guess. Please choose another.`,
  PASSWORD_CONTAINS_EMAIL: msg`The password must not contain your email address.`,
  PASSWORD_INCORRECT: msg`The password is incorrect.`,
};

function lookup(
  table: Partial<Record<string, MessageDescriptor>>,
  code: string,
): MessageDescriptor | undefined {
  return Object.hasOwn(table, code) ? table[code] : undefined;
}

/** Text for a failed call. The API's own (English-only) message is used only for an unknown code. */
export function messageForError(error: ApiError): string {
  const descriptor = lookup(ERROR_MESSAGES, error.code);
  return descriptor ? i18n._(descriptor) : error.message;
}

export function messageForFieldError(detail: FieldError): string {
  const descriptor = lookup(FIELD_MESSAGES, detail.code);
  return descriptor ? i18n._(descriptor) : detail.message;
}
