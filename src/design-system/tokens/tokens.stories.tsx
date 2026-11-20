import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';

import { contrastRatio } from './contrast.ts';
import { PAIRINGS } from './pairings.ts';
import { colorValue } from './resolve.ts';
import { tokens } from './tokens.ts';

const meta: Meta = { title: 'Tokens', parameters: { layout: 'padded' } };
export default meta;
type Story = StoryObj;

const ratio = (a: string, b: string): string => contrastRatio(a, b).toFixed(2);

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-divider bg-surface">
      <div className="h-16" style={{ backgroundColor: hex }} />
      <div className="p-2 text-small">
        <p className="font-bold">{name}</p>
        <p className="tabular-nums">{hex}</p>
        <p className="text-ink-muted">
          on page {ratio(hex, tokens.color.page)} · on white {ratio(hex, '#FFFFFF')}
        </p>
      </div>
    </div>
  );
}

function Scale({ title, scale }: { title: string; scale: Record<string, string> }) {
  const entries = Object.entries(scale).filter(([key]) => !key.includes('-'));
  return (
    <section className="flex flex-col gap-2">
      <h2>{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {entries.map(([key, hex]) => (
          <Swatch key={key} name={`${title.toLowerCase()}-${key}`} hex={hex} />
        ))}
      </div>
    </section>
  );
}

function palette(prefix: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tokens.palette)
      .filter(([key]) => key.startsWith(`${prefix}-`))
      .map(([key, value]) => [key.slice(prefix.length + 1), value]),
  );
}

function Palette(): ReactNode {
  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-reading">
        The light green (green-300) is for fills and decoration only. Text and controls use the
        darker green-700 of the same hue. Coral is a warm accent and never means &quot;error&quot;.
      </p>
      <Scale title="Green" scale={palette('green')} />
      <Scale title="Neutral" scale={palette('neutral')} />
      <Scale title="Coral" scale={palette('coral')} />
    </div>
  );
}

export const Colours: Story = { render: () => <Palette /> };

function Pairings(): ReactNode {
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-reading">
        Every foreground and background a component uses. The build fails if any line is below its
        minimum (body text 7:1, other text 4.5:1, borders and the focus ring 3:1).
      </p>
      {/* A box that scrolls sideways must be reachable by keyboard. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div role="region" aria-label="Colour pairings" tabIndex={0} className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Declared colour pairings and their contrast</caption>
          <thead className="bg-subtle">
            <tr>
              <th scope="col" className="p-2">
                Sample
              </th>
              <th scope="col" className="p-2">
                Use
              </th>
              <th scope="col" className="p-2">
                Contrast
              </th>
              <th scope="col" className="p-2">
                Needs
              </th>
              <th scope="col" className="p-2">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {PAIRINGS.map((pairing) => {
              const fg = colorValue(pairing.fg);
              const bg = colorValue(pairing.bg);
              const value = contrastRatio(fg, bg);
              const need = { body: 7, text: 4.5, 'large-text': 3, 'non-text': 3 }[pairing.kind];
              return (
                <tr
                  key={`${pairing.fg}-${pairing.bg}-${pairing.label}`}
                  className="border-t border-divider"
                >
                  <td className="p-2">
                    {pairing.kind === 'non-text' ? (
                      <span
                        aria-hidden="true"
                        className="inline-block h-9 w-20 rounded-md border-4"
                        style={{ backgroundColor: bg, borderColor: fg }}
                      />
                    ) : (
                      <span
                        className="inline-block rounded-md px-3 py-1 font-bold"
                        style={{ color: fg, backgroundColor: bg }}
                      >
                        Aa 123
                      </span>
                    )}
                  </td>
                  <td className="p-2">{pairing.label}</td>
                  <td className="p-2 tabular-nums">{value.toFixed(2)}:1</td>
                  <td className="p-2 tabular-nums">{need}:1</td>
                  <td className="p-2 font-bold">{value >= need ? 'Pass' : 'FAIL'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const ContrastPairings: Story = { render: () => <Pairings /> };

const SIMULATIONS = {
  greyscale: 'grayscale(1)',
  protanopia: 'url(#protanopia)',
  deuteranopia: 'url(#deuteranopia)',
  tritanopia: 'url(#tritanopia)',
} as const;

function Simulation({ mode }: { mode: keyof typeof SIMULATIONS }): ReactNode {
  return (
    <div className="flex flex-col gap-4">
      <svg width="0" height="0" aria-hidden="true" focusable="false">
        <filter id="protanopia">
          <feColorMatrix
            type="matrix"
            values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"
          />
        </filter>
        <filter id="deuteranopia">
          <feColorMatrix
            type="matrix"
            values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"
          />
        </filter>
        <filter id="tritanopia">
          <feColorMatrix
            type="matrix"
            values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"
          />
        </filter>
      </svg>
      <p className="max-w-reading">
        Status is never colour alone: each one has an icon and a word. Check that every status below
        is still told apart in {mode}.
      </p>
      <div className="flex flex-wrap gap-3" style={{ filter: SIMULATIONS[mode] }}>
        {[
          { key: 'success', word: 'Checked in', icon: '✓' },
          { key: 'warning', word: 'Waiting', icon: '◷' },
          { key: 'danger', word: 'Cancelled', icon: '✕' },
          { key: 'info', word: 'Booked', icon: 'ℹ' },
        ].map(({ key, word, icon }) => (
          <span
            key={key}
            className="inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 font-bold"
            style={{
              color: colorValue(`color.${key}`),
              backgroundColor: colorValue(`color.${key}-bg`),
              borderColor: colorValue(`color.${key}-border`),
            }}
          >
            <span aria-hidden="true">{icon}</span>
            {word}
          </span>
        ))}
        <span
          className="inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 font-bold"
          style={{
            backgroundColor: colorValue('color.brand-accent'),
            color: colorValue('color.on-brand-accent'),
            borderColor: colorValue('color.brand-accent'),
          }}
        >
          New
        </span>
      </div>
    </div>
  );
}

export const GreyscaleView: Story = { render: () => <Simulation mode="greyscale" /> };
export const ProtanopiaView: Story = { render: () => <Simulation mode="protanopia" /> };
export const DeuteranopiaView: Story = { render: () => <Simulation mode="deuteranopia" /> };
export const TritanopiaView: Story = { render: () => <Simulation mode="tritanopia" /> };

export const Typography: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <p className="max-w-reading">
        Inter, self-hosted (₱, ñ and tabular figures included). Body text is 18 px; nothing is
        smaller than 16 px.
      </p>
      {Object.entries(tokens.text).map(([name, style]) => (
        <div key={name} className="flex flex-col border-b border-divider pb-3">
          <p className="text-small text-ink-muted">
            {name} · {style.size} · line height {style.lineHeight} · weight {style.weight}
          </p>
          <p
            className={`text-${name} font-[${style.weight}]`}
            style={{
              fontSize: style.size,
              lineHeight: style.lineHeight,
              fontWeight: Number(style.weight),
            }}
          >
            Walang hanggang pasasalamat, Doc Tayo
          </p>
        </div>
      ))}
      <div className="flex flex-col gap-1">
        <p className="text-small text-ink-muted">
          Characters that must look different (Inter alternates cv05 and cv08), and peso with
          tabular figures
        </p>
        <p className="text-h2 tabular-nums">Il1 O0 · ₱1,234.50 · Ñiño · ₱8,888.88</p>
      </div>
    </div>
  ),
};

export const SpacingRadiusElevation: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h2>Spacing (4 px base)</h2>
        {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20].map((step) => (
          <div key={step} className="flex items-center gap-3">
            <span className="w-24 text-small tabular-nums">
              space-{step} · {step * 4}px
            </span>
            <span className="h-4 bg-primary" style={{ width: `${step * 0.25}rem` }} />
          </div>
        ))}
      </section>
      <section className="flex flex-wrap items-end gap-4">
        <h2 className="w-full">Radius</h2>
        {Object.entries(tokens.radius).map(([name, value]) => (
          <div
            key={name}
            className="flex h-20 w-28 items-center justify-center border-2 border-control bg-surface text-small"
            style={{ borderRadius: value }}
          >
            {name} {value}
          </div>
        ))}
        <div className="flex h-20 w-28 items-center justify-center rounded-full border-2 border-control bg-surface text-small">
          full
        </div>
      </section>
      <section className="flex flex-wrap gap-6">
        <h2 className="w-full">Elevation (borders still carry the boundary)</h2>
        {Object.entries(tokens.shadow).map(([name, value]) => (
          <div
            key={name}
            className="flex h-24 w-40 items-center justify-center rounded-lg border border-divider bg-surface text-small"
            style={{ boxShadow: value }}
          >
            elevation {name}
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <h2>Control sizes (touch targets of at least 44 px)</h2>
        {Object.entries(tokens.size)
          .filter(([name]) => name.startsWith('control') || name === 'target-min')
          .map(([name, value]) => (
            <div key={name} className="flex items-center gap-3">
              <span className="w-32 text-small">
                {name} · {value}
              </span>
              <span className="rounded-md bg-primary" style={{ height: value, width: '8rem' }} />
            </div>
          ))}
      </section>
      <section className="flex flex-col gap-1">
        <h2>Breakpoints (in em, so zooming triggers the smaller layout)</h2>
        {Object.entries(tokens.breakpoint).map(([name, value]) => (
          <p key={name} className="tabular-nums">
            {name}: from {value}
          </p>
        ))}
      </section>
    </div>
  ),
};
