import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast.ts';
import { PAIRINGS, type Pairing } from './pairings.ts';
import { colorValue } from './resolve.ts';
import tokens from './tokens.json';

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // #767676 on white is the classic "just passes AA" grey.
    expect(contrastRatio('#767676', '#FFFFFF')).toBeGreaterThan(4.5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeLessThan(4.5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#1D6E41', '#F9FAF7')).toBeCloseTo(
      contrastRatio('#F9FAF7', '#1D6E41'),
      10,
    );
  });

  it('accepts lower-case and three-digit hex', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });

  it('rejects something that is not a hex colour', () => {
    expect(() => contrastRatio('green', '#fff')).toThrow();
  });
});

const MINIMUM: Record<Pairing['kind'], number> = {
  body: 7, // AAA: body text and headings
  text: 4.5, // AA
  'large-text': 3,
  'non-text': 3, // control borders, focus ring, status borders, icons that carry meaning
};

describe('declared pairings (every colour combination a component uses)', () => {
  it('declares a meaningful number of pairings', () => {
    expect(PAIRINGS.length).toBeGreaterThan(40);
  });

  it.each(PAIRINGS.map((pairing) => [pairing.label, pairing] as const))('%s', (_label, pairing) => {
    const ratio = contrastRatio(colorValue(pairing.fg), colorValue(pairing.bg));
    expect(ratio, `${pairing.fg} on ${pairing.bg}`).toBeGreaterThanOrEqual(MINIMUM[pairing.kind]);
  });

  it('holds body text to AAA (7:1) on the page and on surfaces', () => {
    const body = PAIRINGS.filter((pairing) => pairing.kind === 'body');
    const fgs = body.map((pairing) => `${pairing.fg} on ${pairing.bg}`);
    expect(fgs).toContain('color.ink on color.page');
    expect(fgs).toContain('color.ink on color.surface');
    expect(fgs).toContain('color.ink-secondary on color.page');
  });

  it('covers the TV display, the focus ring and the control borders', () => {
    const labels = PAIRINGS.map((pairing) => pairing.label).join('\n');
    expect(labels).toMatch(/TV/);
    expect(labels).toMatch(/focus ring/i);
    expect(labels).toMatch(/control border/i);
  });

  it('never lets the pale brand green carry text or a control boundary', () => {
    // green-300 is for fills and decoration only (plan §3.1): text on it is always declared,
    // and it is never the foreground of a text or non-text pairing.
    for (const pairing of PAIRINGS) {
      expect(pairing.fg).not.toBe('color.brand-light');
    }
    expect(contrastRatio(colorValue('color.brand-light'), colorValue('color.page'))).toBeLessThan(
      3,
    );
  });
});

describe('palette facts the plan states', () => {
  it('uses the agreed anchor colours', () => {
    expect(colorValue('color.page')).toBe('#F9FAF7');
    expect(colorValue('color.brand-light')).toBe('#8FD9A8');
    expect(colorValue('color.primary')).toBe('#1D6E41');
    expect(colorValue('color.brand-accent')).toBe('#FA7F62');
    expect(colorValue('color.ink')).toBe('#1B211E');
  });

  it('keeps coral away from the danger red (coral never means error)', () => {
    const coral = colorValue('color.brand-accent');
    const danger = colorValue('color.danger');
    expect(coral).not.toBe(danger);
    // They are told apart by lightness: coral is far lighter than the danger text red.
    expect(contrastRatio(coral, danger)).toBeGreaterThan(2);
  });

  it('has every role token the components rely on', () => {
    const required = [
      'page',
      'surface',
      'subtle',
      'selected',
      'hover',
      'ink',
      'ink-secondary',
      'ink-muted',
      'on-primary',
      'link',
      'primary',
      'primary-hover',
      'primary-pressed',
      'control',
      'divider',
      'focus',
      'brand-light',
      'on-brand-light',
      'brand-accent',
      'on-brand-accent',
      'disabled-bg',
      'disabled-ink',
      'success',
      'success-bg',
      'success-border',
      'warning',
      'warning-bg',
      'warning-border',
      'danger',
      'danger-hover',
      'danger-bg',
      'danger-border',
      'info',
      'info-bg',
      'info-border',
    ];
    for (const name of required) {
      expect(Object.keys(tokens.color), name).toContain(name);
    }
  });
});
