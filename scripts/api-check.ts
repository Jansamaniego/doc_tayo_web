import { checkGenerated, generateTypes, TARGET_TYPES } from './openapi.ts';

const { upToDate } = await checkGenerated({ committedPath: TARGET_TYPES, generate: generateTypes });
if (upToDate) {
  console.log(`${TARGET_TYPES} matches docs/openapi.json.`);
} else {
  console.error(
    `${TARGET_TYPES} is out of date. Run \`npm run api:generate\` (or \`npm run api:sync\`) and commit it.`,
  );
  process.exitCode = 1;
}
