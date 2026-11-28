import { z } from '@/lib/zod.ts';

import type { components } from './schema';

export type ErrorCode = components['schemas']['ErrorCode'];
export type FieldErrorCode = components['schemas']['FieldErrorCode'];
/** `NETWORK_ERROR` exists only on the client; `UNKNOWN_ERROR` is a code this client has no entry for. */
export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';
export type ClientFieldErrorCode = FieldErrorCode | 'UNKNOWN_ERROR';

export interface FieldError {
  /** Dotted path, for example `address.city` or `items[0].id`. */
  field: string;
  code: ClientFieldErrorCode;
  message: string;
}

// `Record<...>` makes the compiler fail when the contract gains a code, so the code lists,
// and with them the message catalogue (error-messages.ts), can never fall behind.
const ERROR_CODES: Record<ErrorCode, true> = {
  VALIDATION_FAILED: true,
  BAD_REQUEST: true,
  MALFORMED_JSON: true,
  PAYLOAD_TOO_LARGE: true,
  UNSUPPORTED_MEDIA_TYPE: true,
  ROUTE_NOT_FOUND: true,
  NOT_FOUND: true,
  CONFLICT_UNIQUE: true,
  CONFLICT_REFERENCE: true,
  NOT_READY: true,
  SERVICE_UNAVAILABLE: true,
  INTERNAL_ERROR: true,
  UNAUTHENTICATED: true,
  FORBIDDEN: true,
  TENANT_NOT_SELECTED: true,
  TENANT_SUSPENDED: true,
  TENANT_DEACTIVATED: true,
  TENANT_ACCESS_DENIED: true,
  INVALID_CREDENTIALS: true,
  ACCESS_TOKEN_EXPIRED: true,
  TOKEN_INVALID: true,
  ROLE_NOT_ASSIGNABLE: true,
  LAST_OWNER: true,
  OWNER_REQUIRED: true,
  SELF_ACTION_FORBIDDEN: true,
  CONFLICT: true,
  METHOD_NOT_ALLOWED: true,
  RATE_LIMITED: true,
  VERSION_CONFLICT: true,
  TENANT_MISMATCH: true,
  IDEMPOTENCY_KEY_REUSED: true,
  IDEMPOTENCY_KEY_IN_USE: true,
  IDEMPOTENCY_KEY_INVALID: true,
  APPOINTMENT_OVERLAP: true,
  PATIENT_ARCHIVED: true,
  NOT_A_PRACTITIONER: true,
};

const FIELD_ERROR_CODES: Record<FieldErrorCode, true> = {
  REQUIRED: true,
  INVALID_FORMAT: true,
  INVALID_TYPE: true,
  INVALID_VALUE: true,
  OUT_OF_RANGE: true,
  TOO_SHORT: true,
  TOO_LONG: true,
  UNKNOWN_FIELD: true,
  PASSWORD_TOO_COMMON: true,
  PASSWORD_CONTAINS_EMAIL: true,
  PASSWORD_INCORRECT: true,
};

function toErrorCode(code: string): ClientErrorCode {
  return Object.hasOwn(ERROR_CODES, code) ? (code as ErrorCode) : 'UNKNOWN_ERROR';
}

function toFieldErrorCode(code: string): ClientFieldErrorCode {
  return Object.hasOwn(FIELD_ERROR_CODES, code) ? (code as FieldErrorCode) : 'UNKNOWN_ERROR';
}

export interface ApiErrorInit {
  status: number;
  code: ClientErrorCode;
  message: string;
  details: FieldError[];
  requestId?: string | undefined;
  retryAfterSeconds?: number | undefined;
  cause?: unknown;
}

/** Every failed API call is thrown as one of these. Branch on `code`, never on `message`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ClientErrorCode;
  readonly details: FieldError[];
  /** Quote it when reporting a problem; also the `X-Request-Id` header. */
  readonly requestId: string | undefined;
  /** Seconds from the `Retry-After` header (429 only). */
  readonly retryAfterSeconds: number | undefined;

  constructor({
    status,
    code,
    message,
    details,
    requestId,
    retryAfterSeconds,
    cause,
  }: ApiErrorInit) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

const envelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z
      .array(z.object({ field: z.string(), code: z.string(), message: z.string() }))
      .optional(),
    requestId: z.string().optional(),
  }),
});

function parseRetryAfter(header: string | null): number | undefined {
  return header !== null && /^\d+$/.test(header) ? Number(header) : undefined;
}

/** Builds an ApiError from a non-2xx response, whatever its body (a proxy may send HTML). */
export async function parseErrorResponse(response: Response): Promise<ApiError> {
  const headerRequestId = response.headers.get('x-request-id') ?? undefined;
  const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'));
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const parsed = envelope.safeParse(body);
  if (!parsed.success) {
    return new ApiError({
      status: response.status,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      details: [],
      requestId: headerRequestId,
      retryAfterSeconds,
    });
  }
  const { error } = parsed.data;
  return new ApiError({
    status: response.status,
    code: toErrorCode(error.code),
    message: error.message,
    details: (error.details ?? []).map((detail) => ({
      field: detail.field,
      code: toFieldErrorCode(detail.code),
      message: detail.message,
    })),
    requestId: error.requestId ?? headerRequestId,
    retryAfterSeconds,
  });
}

/** The request never got an answer: offline, DNS, CORS, a dropped connection. */
export function networkError(cause: unknown): ApiError {
  return new ApiError({
    status: 0,
    code: 'NETWORK_ERROR',
    message: 'The request could not be sent. Check your internet connection.',
    details: [],
    cause,
  });
}

/** Whatever was thrown, as an ApiError (the client throws ApiErrors, but a type cannot say so). */
export function asApiError(error: unknown): ApiError {
  return isApiError(error) ? error : networkError(error);
}
