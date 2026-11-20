import { describe, expect, it } from 'vitest';

import openapi from '../../docs/openapi.json';
import { ApiError } from './errors.ts';
import { messageForError, messageForFieldError } from './error-messages.ts';

const schemas = openapi.components.schemas as unknown as Record<string, { enum: string[] }>;
const errorCodes = schemas.ErrorCode?.enum ?? [];
const fieldCodes = schemas.FieldErrorCode?.enum ?? [];

function apiError(code: string): ApiError {
  return new ApiError({
    status: 400,
    code: code as ApiError['code'],
    message: 'Server fallback text',
    details: [],
    requestId: 'r',
  });
}

describe('error messages', () => {
  it('reads the code lists from the contract', () => {
    expect(errorCodes.length).toBeGreaterThan(20);
    expect(fieldCodes.length).toBeGreaterThan(8);
  });

  it.each(errorCodes)('has an English message for the error code %s', (code) => {
    const text = messageForError(apiError(code));
    expect(text.length).toBeGreaterThan(5);
    expect(text).not.toBe('Server fallback text');
    expect(text).not.toBe(code);
  });

  it.each(fieldCodes)('has an English message for the field code %s', (code) => {
    const text = messageForFieldError({ field: 'x', code: code as never, message: 'Server' });
    expect(text.length).toBeGreaterThan(5);
    expect(text).not.toBe('Server');
    expect(text).not.toBe(code);
  });

  it('has a message for the client-only NETWORK_ERROR', () => {
    expect(messageForError(apiError('NETWORK_ERROR')).toLowerCase()).toContain('connect');
  });

  it('falls back to the server message for a code the client does not know', () => {
    expect(messageForError(apiError('UNKNOWN_ERROR'))).toBe('Server fallback text');
  });

  it('never shows a technical code to the user', () => {
    for (const code of errorCodes) {
      expect(messageForError(apiError(code))).not.toMatch(/[A-Z]{3,}_[A-Z_]+/);
    }
  });
});
