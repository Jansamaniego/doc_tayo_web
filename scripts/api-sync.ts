import {
  generateTypes,
  resolveSourcePath,
  syncOpenApi,
  TARGET_JSON,
  TARGET_TYPES,
} from './openapi.ts';

try {
  await syncOpenApi({
    sourcePath: resolveSourcePath(process.env),
    targetPath: TARGET_JSON,
    generate: () => generateTypes(TARGET_TYPES),
  });
  console.log(`Copied the backend contract to ${TARGET_JSON} and regenerated ${TARGET_TYPES}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
