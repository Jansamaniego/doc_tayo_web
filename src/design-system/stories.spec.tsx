import { composeStories } from '@storybook/react-vite';
import { render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

// Every story of every component is rendered and checked with axe (WCAG 2.2 AA), the way the
// Storybook accessibility panel does. Overlays are portalled, so the whole body is scanned.
const modules = import.meta.glob<Parameters<typeof composeStories>[0]>('./**/*.stories.tsx', {
  eager: true,
});

const cases = Object.entries(modules).flatMap(([file, module]) =>
  Object.entries(composeStories(module)).map(([name, Story]) => ({
    id: `${file.replace('./', '')} › ${name}`,
    Story: Story as ComponentType,
  })),
);

describe('every story', () => {
  it('finds the stories', () => {
    expect(cases.length).toBeGreaterThan(90);
  });

  it.each(cases.map((item) => [item.id, item.Story] as const))(
    '%s has no accessibility violations',
    async (_id, Story) => {
      const { container } = renderWithProviders(<Story />);
      // Landmarks belong to whole pages (the app shell and e2e check them), not to an isolated story.
      expect(
        await axe(document.body, { rules: { region: { enabled: false } } }),
      ).toHaveNoViolations();
      expect(container).toBeTruthy();
    },
  );

  it.each(cases.map((item) => [item.id, item.Story] as const))(
    '%s has at most one primary action',
    (_id, Story) => {
      const { container } = renderWithProviders(<Story />);
      expect(
        container.querySelectorAll('[data-variant="primary"]:not([aria-disabled="true"])').length,
      ).toBeLessThanOrEqual(1);
    },
  );
});

it('renders without crashing in an empty provider-less container (sanity)', () => {
  expect(() => render(<div />)).not.toThrow();
});
