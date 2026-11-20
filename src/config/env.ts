import { z } from '@/lib/zod.ts';

export interface Env {
  /** Origin of the DocTayo API: scheme, host and port only. The generated schema holds /api/v1. */
  apiOrigin: string;
  appEnv: 'development' | 'staging' | 'production';
  errorReportingDsn: string | undefined;
}

export type EnvResult = { ok: true; env: Env } | { ok: false; invalidKeys: string[] };

function isApiOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  } catch {
    return false;
  }
}

function isUrl(value: string): boolean {
  return URL.canParse(value);
}

const schema = z.object({
  VITE_API_ORIGIN: z.string().refine(isApiOrigin),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']),
  VITE_ERROR_REPORTING_DSN: z
    .string()
    .refine((value) => value === '' || isUrl(value))
    .optional(),
});

/** Validates the raw environment. On failure it reports key names only, never the values. */
export function parseEnv(raw: Record<string, unknown>): EnvResult {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((issue) => String(issue.path[0]));
    return { ok: false, invalidKeys: [...new Set(keys)] };
  }
  return {
    ok: true,
    env: {
      apiOrigin: parsed.data.VITE_API_ORIGIN,
      appEnv: parsed.data.VITE_APP_ENV,
      errorReportingDsn:
        parsed.data.VITE_ERROR_REPORTING_DSN === ''
          ? undefined
          : parsed.data.VITE_ERROR_REPORTING_DSN,
    },
  };
}

let cached: Env | undefined;

/** The validated configuration. `main.tsx` checks it before rendering, so this only throws in tests. */
export function getEnv(): Env {
  if (!cached) {
    const result = parseEnv(import.meta.env);
    if (!result.ok) {
      throw new Error(`Invalid configuration: ${result.invalidKeys.join(', ')}`);
    }
    cached = result.env;
  }
  return cached;
}
