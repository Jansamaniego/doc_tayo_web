import { readFile, writeFile } from 'node:fs/promises';

import subsetFont from 'subset-font';

// Builds src/design-system/fonts/inter-subset.woff2 from the Google Fonts build of Inter
// (SIL Open Font License, see fonts/OFL.txt). One-off: the result is committed.
//
//   INTER_SOURCE=/path/to/Inter[opsz,wght].ttf npm run font:build
//
// Source: https://github.com/google/fonts/tree/main/ofl/inter (Inter 4.001).
const OUTPUT = 'src/design-system/fonts/inter-subset.woff2';

const range = (from: number, to: number): string =>
  String.fromCodePoint(...Array.from({ length: to - from + 1 }, (_, index) => from + index));

// Basic Latin + Latin-1 (covers ñ, Ñ, accents) + the peso sign + typographic punctuation.
const CHARACTERS = [
  range(0x20, 0x7e),
  range(0xa0, 0xff),
  '₱', // ₱
  '‘’“”–—…•→←✓·',
].join('');

const source = process.env.INTER_SOURCE;
if (!source) {
  console.error(
    'Set INTER_SOURCE to the path of Inter[opsz,wght].ttf (see the header of this script).',
  );
  process.exit(1);
}

const subset = await subsetFont(await readFile(source), CHARACTERS, {
  targetFormat: 'woff2',
  // Weights 400-700 only (plan: no light weights); optical size pinned to its text default.
  variationAxes: { wght: { min: 400, max: 700 }, opsz: 14 },
});
await writeFile(OUTPUT, subset);
console.log(`${OUTPUT}: ${subset.length} bytes`);
