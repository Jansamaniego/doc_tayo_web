import { describe, expect, it } from 'vitest';

import { cn } from './cn.ts';

describe('cn (class merging with our design tokens)', () => {
  it('keeps the text colour when a custom font size is added (white text on a primary button)', () => {
    const merged = cn('bg-primary text-on-primary', 'text-body-lg');
    expect(merged).toContain('text-on-primary');
    expect(merged).toContain('text-body-lg');
  });

  it('keeps colour and size together for every size in the type scale', () => {
    for (const size of [
      'display',
      'h1',
      'h2',
      'h3',
      'body-lg',
      'body',
      'label',
      'small',
      'tv-number',
      'tv-meta',
    ]) {
      const merged = cn('text-ink-muted', `text-${size}`);
      expect(merged, size).toContain('text-ink-muted');
      expect(merged, size).toContain(`text-${size}`);
    }
  });

  it('still lets a later size replace an earlier size, and a later colour replace an earlier colour', () => {
    expect(cn('text-body', 'text-small')).toBe('text-small');
    expect(cn('text-ink', 'text-danger')).toBe('text-danger');
  });

  it('still merges ordinary Tailwind conflicts', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});
