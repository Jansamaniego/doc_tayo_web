import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { generateTokens } from './generate.ts';
import { resolveTokenValue } from './resolve.ts';
import tokens from './tokens.json';

describe('generated token files', () => {
  it('src/design-system/tokens/tokens.css is exactly what tokens.json generates', async () => {
    const committed = await readFile('src/design-system/tokens/tokens.css', 'utf8');
    expect(committed).toBe(generateTokens(tokens).css);
  });

  it('src/design-system/tokens/tokens.ts is exactly what tokens.json generates', async () => {
    const committed = await readFile('src/design-system/tokens/tokens.ts', 'utf8');
    expect(committed).toBe(generateTokens(tokens).ts);
  });

  it('is deterministic', () => {
    expect(generateTokens(tokens)).toEqual(generateTokens(tokens));
  });
});

function allReferences(node: unknown, found: string[] = []): string[] {
  if (typeof node === 'string') {
    for (const match of node.matchAll(/\{([^}]+)\}/g)) found.push(match[1] ?? '');
  } else if (node && typeof node === 'object') {
    for (const child of Object.values(node)) allReferences(child, found);
  }
  return found;
}

describe('tokens.json integrity (no orphans)', () => {
  it('every {reference} points at a token that exists', () => {
    const references = allReferences(tokens);
    expect(references.length).toBeGreaterThan(30);
    for (const reference of references) {
      expect(() => resolveTokenValue(reference), reference).not.toThrow();
    }
  });

  it('generated CSS has no duplicate variable names and no unresolved references', () => {
    const { css } = generateTokens(tokens);
    const names = [...css.matchAll(/^\s*(--[\w-]+):/gm)].map((match) => match[1]);
    expect(new Set(names).size).toBe(names.length);
    // A leftover reference looks like {palette.green.700}: no spaces, dots between words.
    expect(css).not.toMatch(/\{[\w-]+(\.[\w-]+)+\}/);
  });

  it('generated CSS marks itself as generated and turns Tailwind default colours off', () => {
    const { css } = generateTokens(tokens);
    expect(css).toMatch(/GENERATED/);
    expect(css).toContain('--color-*: initial;');
  });
});

describe('the numbers the plan fixes', () => {
  const rem = (value: string): number => Number(value.replace('rem', ''));

  it('body text is 18 px (1.125 rem) and nothing is smaller than 16 px (1 rem)', () => {
    expect(rem(tokens.text.body.size)).toBe(1.125);
    for (const [name, style] of Object.entries(tokens.text)) {
      expect(rem(style.size), name).toBeGreaterThanOrEqual(1);
    }
  });

  it('uses the plan type scale', () => {
    expect(tokens.text.display.size).toBe('2.5rem');
    expect(tokens.text.h1.size).toBe('2rem');
    expect(tokens.text.h2.size).toBe('1.625rem');
    expect(tokens.text.h3.size).toBe('1.375rem');
    expect(tokens.text['body-lg'].size).toBe('1.25rem');
    expect(tokens.text.small.size).toBe('1rem');
  });

  it('line height is about 1.5 for body text and no weight is lighter than regular', () => {
    expect(Number(tokens.text.body.lineHeight)).toBe(1.5);
    for (const [name, style] of Object.entries(tokens.text)) {
      expect(Number(style.weight), name).toBeGreaterThanOrEqual(400);
    }
  });

  it('controls are at least 44 px high (2.75 rem), 48 px by default', () => {
    expect(rem(tokens.size['control-sm'])).toBeGreaterThanOrEqual(2.75);
    expect(tokens.size['control-md']).toBe('3rem');
    expect(tokens.size['control-lg']).toBe('3.5rem');
    expect(rem(tokens.size['target-min'])).toBe(2.75);
  });

  it('breakpoints are in em so browser zoom triggers the smaller layout', () => {
    expect(tokens.breakpoint).toEqual({ sm: '40em', md: '48em', lg: '64em', xl: '80em' });
  });

  it('TV text scales with the viewport and never goes below 16 px', () => {
    for (const [name, value] of Object.entries(tokens.tv.text)) {
      expect(value, name).toMatch(/^clamp\(\s*[\d.]+rem,\s*[\d.]+vh,\s*[\d.]+rem\s*\)$/);
      const min = Number(/clamp\(\s*([\d.]+)rem/.exec(value)?.[1]);
      expect(min, name).toBeGreaterThanOrEqual(1);
    }
  });
});
