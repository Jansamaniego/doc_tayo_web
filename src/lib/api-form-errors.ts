import { msg } from '@lingui/core/macro';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { messageForError, messageForFieldError } from '@/api/error-messages.ts';
import type { ApiError } from '@/api/errors.ts';
import type { SummaryEntry } from '@/design-system/patterns/form-error-summary.tsx';
import { i18n } from '@/i18n/index.ts';

const OTHER = msg`Something else`;

export interface AppliedErrors {
  /** One entry per problem, for FormErrorSummary. */
  summary: SummaryEntry[];
  /** One plain message for the whole form, for any error that is not a field problem. */
  formMessage: string | undefined;
}

/**
 * Puts the API's `VALIDATION_FAILED` details on the right fields (the `field` is a dotted path such as
 * `address.city`), in plain words from our catalogue. A field the form does not have goes to the
 * summary only, so nothing is lost. Never touches what the person typed.
 */
export function applyApiErrors<Values extends FieldValues>({
  error,
  setError,
  fieldLabels,
}: {
  error: ApiError;
  setError: UseFormSetError<Values>;
  /** Field path -> visible label, for the fields this form has. */
  fieldLabels: Record<string, string>;
}): AppliedErrors {
  if (error.code !== 'VALIDATION_FAILED' || error.details.length === 0) {
    return { summary: [], formMessage: messageForError(error) };
  }
  const summary: SummaryEntry[] = [];
  for (const detail of error.details) {
    const message = messageForFieldError(detail);
    const label = fieldLabels[detail.field];
    if (label !== undefined) setError(detail.field as Path<Values>, { type: 'server', message });
    summary.push({ name: detail.field, label: label ?? i18n._(OTHER), message });
  }
  return { summary, formMessage: undefined };
}
