import { readFile } from 'node:fs/promises';
import { create, type Font } from 'fontkit';
import { describe, expect, it } from 'vitest';

const FONT_FILE = 'src/design-system/fonts/inter-subset.woff2';

async function loadFont(): Promise<Font> {
  const font = create(await readFile(FONT_FILE));
  if (!('glyphForCodePoint' in font)) throw new Error('Expected a single font, not a collection.');
  return font;
}

describe('self-hosted Inter subset', () => {
  it('renders ₱, ñ and Ñ from the file itself (no fallback glyph)', async () => {
    const font = await loadFont();
    for (const character of '₱1,234.50 Ñiño ñ') {
      expect(font.hasGlyphForCodePoint(character.codePointAt(0) ?? 0), character).toBe(true);
    }
  });

  it('keeps tabular figures and the letter-shape alternates that tell l, I and 1 apart', async () => {
    const font = await loadFont();
    for (const feature of ['tnum', 'cv05', 'cv08']) {
      expect(font.availableFeatures, feature).toContain(feature);
    }
  });

  it('is a variable font limited to weights 400 to 700', async () => {
    const font = await loadFont();
    expect(font.variationAxes.wght).toMatchObject({ min: 400, max: 700 });
  });

  it('is small enough not to hurt first load (under 80 kB)', async () => {
    const bytes = (await readFile(FONT_FILE)).length;
    expect(bytes).toBeLessThan(80_000);
  });

  it('ships with its license', async () => {
    const license = await readFile('src/design-system/fonts/OFL.txt', 'utf8');
    expect(license).toMatch(/SIL Open Font License/);
  });
});
