import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export const DEFAULT_SOURCE = '../doc-tayo-api/docs/openapi.json';
export const TARGET_JSON = 'docs/openapi.json';
export const TARGET_TYPES = 'src/api/schema.d.ts';

export function resolveSourcePath(env: Record<string, string | undefined>): string {
  const configured = env.BACKEND_OPENAPI_PATH;
  return configured !== undefined && configured !== '' ? configured : DEFAULT_SOURCE;
}

/** Runs openapi-typescript on the committed JSON and writes the types to `outputPath`. */
export async function generateTypes(outputPath: string): Promise<void> {
  await run('npx', ['openapi-typescript', TARGET_JSON, '-o', outputPath]);
}

export interface SyncOptions {
  sourcePath: string;
  targetPath: string;
  generate: () => Promise<void>;
}

/** Copies the backend's openapi.json into this repo, then regenerates the types. */
export async function syncOpenApi({
  sourcePath,
  targetPath,
  generate,
}: SyncOptions): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(sourcePath, 'utf8');
  } catch {
    throw new Error(
      `Cannot read the backend contract at ${sourcePath}. ` +
        'Check out doc-tayo-api next to this repository, or set BACKEND_OPENAPI_PATH to its docs/openapi.json.',
    );
  }
  try {
    JSON.parse(raw);
  } catch {
    throw new Error(
      `${sourcePath} is not valid JSON. Regenerate it in the backend (npm run openapi:export).`,
    );
  }
  await writeFile(targetPath, raw);
  await generate();
}

export interface CheckOptions {
  committedPath: string;
  generate: (outputPath: string) => Promise<void>;
}

/** True when regenerating from the committed JSON reproduces the committed types exactly. */
export async function checkGenerated({
  committedPath,
  generate,
}: CheckOptions): Promise<{ upToDate: boolean }> {
  const dir = await mkdtemp(join(tmpdir(), 'doctayo-api-check-'));
  try {
    const fresh = join(dir, 'schema.d.ts');
    await generate(fresh);
    const [committed, regenerated] = await Promise.all([
      readFile(committedPath, 'utf8').catch(() => undefined),
      readFile(fresh, 'utf8'),
    ]);
    return { upToDate: committed === regenerated };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
