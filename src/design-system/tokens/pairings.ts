export interface Pairing {
  /** body = AAA (7:1) text; text = AA (4.5:1); large-text = 3:1; non-text = 3:1 (borders, focus, icons). */
  kind: 'body' | 'text' | 'large-text' | 'non-text';
  /** Token paths (`color.ink`, `tv.color.bg`). */
  fg: string;
  bg: string;
  label: string;
}

const pair = (kind: Pairing['kind'], fg: string, bg: string, label: string): Pairing => ({
  kind,
  fg,
  bg,
  label,
});

/**
 * Every foreground/background combination a component uses (plans/02-design-system.md §3.4).
 * A new combination in a component means a new line here; tokens.contrast.spec.ts fails the build
 * if any line is below its threshold. Palette steps that are not listed (green-300 as text, coral
 * as a boundary, ...) are not allowed for those uses.
 */
export const PAIRINGS: readonly Pairing[] = [
  // Body text and headings: AAA.
  pair('body', 'color.ink', 'color.page', 'Body text on the page'),
  pair('body', 'color.ink', 'color.surface', 'Body text on a card or dialog'),
  pair('body', 'color.ink', 'color.subtle', 'Body text on a subtle section / table header'),
  pair('body', 'color.ink', 'color.selected', 'Body text on a selected row'),
  pair('body', 'color.ink', 'color.hover', 'Body text on a hovered item'),
  pair('body', 'color.ink-secondary', 'color.page', 'Secondary text on the page'),
  pair('body', 'color.ink-secondary', 'color.surface', 'Secondary text on a card'),
  pair('body', 'color.ink-secondary', 'color.subtle', 'Secondary text on a subtle section'),
  pair('body', 'color.on-brand-light', 'color.brand-light', 'Text on the brand light green'),
  // Supporting text and controls: AA.
  pair('text', 'color.ink-muted', 'color.page', 'Muted text on the page'),
  pair('text', 'color.ink-muted', 'color.surface', 'Muted text on a card'),
  pair('text', 'color.ink-muted', 'color.subtle', 'Muted text on a subtle section'),
  pair('text', 'color.ink-muted', 'color.selected', 'Muted text on a selected row'),
  pair('text', 'color.ink-secondary', 'color.selected', 'Secondary text on a selected row'),
  pair('text', 'color.link', 'color.page', 'Link on the page'),
  pair('text', 'color.link', 'color.surface', 'Link on a card'),
  pair('text', 'color.primary', 'color.surface', 'Secondary button text on a card'),
  pair('text', 'color.primary', 'color.page', 'Secondary button text on the page'),
  pair('text', 'color.on-primary', 'color.primary', 'Primary button text'),
  pair('text', 'color.on-primary', 'color.primary-hover', 'Primary button text, hovered'),
  pair('text', 'color.on-primary', 'color.primary-pressed', 'Primary button text, pressed'),
  pair('text', 'color.on-primary', 'color.danger', 'Danger button text'),
  pair('text', 'color.on-primary', 'color.danger-hover', 'Danger button text, hovered'),
  pair('text', 'color.on-brand-accent', 'color.brand-accent', 'Text on the coral accent'),
  // Status: text and icon colours (always with a word and an icon).
  pair('text', 'color.success', 'color.success-bg', 'Success message'),
  pair('text', 'color.success', 'color.page', 'Success text on the page'),
  pair('text', 'color.success', 'color.surface', 'Success text on a card'),
  pair('text', 'color.warning', 'color.warning-bg', 'Warning message'),
  pair('text', 'color.warning', 'color.page', 'Warning text on the page'),
  pair('text', 'color.warning', 'color.surface', 'Warning text on a card'),
  pair('text', 'color.danger', 'color.danger-bg', 'Error message'),
  pair('text', 'color.danger', 'color.page', 'Error text on the page'),
  pair('text', 'color.danger', 'color.surface', 'Error text on a card'),
  pair('text', 'color.info', 'color.info-bg', 'Info message'),
  pair('text', 'color.info', 'color.page', 'Info text on the page'),
  pair('text', 'color.info', 'color.surface', 'Info text on a card'),
  pair('text', 'color.surface', 'color.ink', 'Tooltip text'),
  // Non-text: boundaries, the focus ring, status borders.
  pair('non-text', 'color.control', 'color.surface', 'Control border on a card'),
  pair('non-text', 'color.control', 'color.page', 'Control border on the page'),
  pair('non-text', 'color.control', 'color.subtle', 'Control border on a subtle section'),
  pair('non-text', 'color.focus', 'color.page', 'Focus ring on the page'),
  pair('non-text', 'color.focus', 'color.surface', 'Focus ring on a card'),
  pair('non-text', 'color.focus', 'color.selected', 'Focus ring on a selected row'),
  pair('non-text', 'color.primary', 'color.page', 'Secondary button border on the page'),
  pair('non-text', 'color.success-border', 'color.success-bg', 'Success message border'),
  pair('non-text', 'color.warning-border', 'color.warning-bg', 'Warning message border'),
  pair('non-text', 'color.warning-border', 'color.page', 'Warning border on the page'),
  pair('non-text', 'color.danger-border', 'color.danger-bg', 'Error message border'),
  pair('non-text', 'color.danger-border', 'color.page', 'Error border on the page'),
  pair('non-text', 'color.info-border', 'color.info-bg', 'Info message border'),
  // TV display (light and dark variants), read from 3-5 m: everything is AAA except the status line.
  pair('body', 'tv.color.text', 'tv.color.bg', 'TV: text on the background'),
  pair(
    'body',
    'tv.color.now-serving-text',
    'tv.color.now-serving-bg',
    'TV: "Now serving" number on its panel',
  ),
  pair(
    'body',
    'tv.color.now-serving-secondary',
    'tv.color.now-serving-bg',
    'TV: secondary text on the "Now serving" panel',
  ),
  pair(
    'body',
    'tv.color.now-serving-text',
    'tv.color.highlight-bg',
    'TV: text on the highlighted call',
  ),
  pair(
    'body',
    'tv.color.highlight',
    'tv.color.highlight-bg',
    'TV: highlight border on the dark panel',
  ),
  pair(
    'body',
    'tv.color.stale-text',
    'tv.color.stale-bg',
    'TV: dimmed panel after the connection was lost',
  ),
  pair('text', 'tv.color.offline', 'tv.color.offline-bg', 'TV: reconnecting status line'),
  pair('body', 'tv.color.dark-text', 'tv.color.dark-bg', 'TV dark variant: text on the background'),
  pair(
    'body',
    'tv.color.dark-now-serving-text',
    'tv.color.dark-now-serving-bg',
    'TV dark variant: "Now serving" number',
  ),
];
