import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkGenerated, DEFAULT_SOURCE, resolveSourcePath, syncOpenApi } from './openapi.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'doctayo-openapi-'));
  await mkdir(join(dir, 'docs'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('resolveSourcePath', () => {
  it('uses BACKEND_OPENAPI_PATH when set', () => {
    expect(resolveSourcePath({ BACKEND_OPENAPI_PATH: '/x/openapi.json' })).toBe('/x/openapi.json');
  });

  it('defaults to the sibling backend checkout', () => {
    expect(resolveSourcePath({})).toBe(DEFAULT_SOURCE);
    expect(DEFAULT_SOURCE).toBe('../doc-tayo-api/docs/openapi.json');
  });

  it('treats an empty value as not set', () => {
    expect(resolveSourcePath({ BACKEND_OPENAPI_PATH: '' })).toBe(DEFAULT_SOURCE);
  });
});

describe('syncOpenApi', () => {
  it('copies the backend file into docs/ and then regenerates the types', async () => {
    const source = join(dir, 'backend-openapi.json');
    const target = join(dir, 'docs', 'openapi.json');
    await writeFile(source, '{"openapi":"3.0.0","paths":{}}');
    const generate = vi.fn(() => Promise.resolve());

    await syncOpenApi({ sourcePath: source, targetPath: target, generate });

    expect(await readFile(target, 'utf8')).toBe('{"openapi":"3.0.0","paths":{}}');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('fails with a clear message when the backend file is missing, and changes nothing', async () => {
    const target = join(dir, 'docs', 'openapi.json');
    await writeFile(target, '{"old":true}');
    const generate = vi.fn(() => Promise.resolve());

    await expect(
      syncOpenApi({ sourcePath: join(dir, 'nope.json'), targetPath: target, generate }),
    ).rejects.toThrow(/BACKEND_OPENAPI_PATH/);

    expect(await readFile(target, 'utf8')).toBe('{"old":true}');
    expect(generate).not.toHaveBeenCalled();
  });

  it('refuses a source that is not valid JSON, and leaves the target untouched', async () => {
    const source = join(dir, 'broken.json');
    const target = join(dir, 'docs', 'openapi.json');
    await writeFile(source, '{ not json');
    await writeFile(target, '{"old":true}');

    await expect(
      syncOpenApi({ sourcePath: source, targetPath: target, generate: () => Promise.resolve() }),
    ).rejects.toThrow(/valid JSON/);
    expect(await readFile(target, 'utf8')).toBe('{"old":true}');
  });
});

describe('checkGenerated', () => {
  const committed = 'export interface paths {}\n';

  it('passes when regenerating gives the committed types', async () => {
    const committedPath = join(dir, 'schema.d.ts');
    await writeFile(committedPath, committed);
    const result = await checkGenerated({
      committedPath,
      generate: (outputPath) => writeFile(outputPath, committed),
    });
    expect(result).toEqual({ upToDate: true });
  });

  it('fails when the committed types differ from a fresh generation', async () => {
    const committedPath = join(dir, 'schema.d.ts');
    await writeFile(committedPath, committed);
    const result = await checkGenerated({
      committedPath,
      generate: (outputPath) => writeFile(outputPath, 'export interface paths { "/new": never }\n'),
    });
    expect(result).toEqual({ upToDate: false });
  });

  it('fails when the committed types are missing', async () => {
    const result = await checkGenerated({
      committedPath: join(dir, 'missing.d.ts'),
      generate: (outputPath) => writeFile(outputPath, committed),
    });
    expect(result).toEqual({ upToDate: false });
  });
});
