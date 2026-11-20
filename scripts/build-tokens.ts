import { readFile, writeFile } from 'node:fs/promises';

import { generateTokens } from '../src/design-system/tokens/generate.ts';

const DIR = 'src/design-system/tokens';
const tokens = JSON.parse(await readFile(`${DIR}/tokens.json`, 'utf8')) as Parameters<
  typeof generateTokens
>[0];
const { css, ts } = generateTokens(tokens);

if (process.argv.includes('--check')) {
  const [committedCss, committedTs] = await Promise.all([
    readFile(`${DIR}/tokens.css`, 'utf8').catch(() => ''),
    readFile(`${DIR}/tokens.ts`, 'utf8').catch(() => ''),
  ]);
  if (committedCss !== css || committedTs !== ts) {
    console.error(
      'Design token files are out of date. Run `npm run tokens:build` and commit them.',
    );
    process.exitCode = 1;
  } else {
    console.log('Design token files match tokens.json.');
  }
} else {
  await Promise.all([writeFile(`${DIR}/tokens.css`, css), writeFile(`${DIR}/tokens.ts`, ts)]);
  console.log(`Wrote ${DIR}/tokens.css and ${DIR}/tokens.ts`);
}
