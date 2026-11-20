import { composeStories } from '@storybook/react-vite';
import type { ComponentType } from 'react';

import '@/design-system/stress.css';

// The gallery behind /components-gallery: every story in one page, so the end-to-end tests can check
// the real production build (and its Content-Security-Policy) in real browsers. Not in production builds.
type StoryModule = Parameters<typeof composeStories>[0] & { default: { title?: string } };
const modules = import.meta.glob<StoryModule>('../design-system/**/*.stories.tsx', { eager: true });

interface Entry {
  id: string;
  title: string;
  Story: ComponentType;
}

const entries: Entry[] = Object.values(modules).flatMap((module) => {
  const title = module.default.title ?? '';
  return Object.entries(composeStories(module)).map(([name, Story]) => ({
    id: `${title}/${name}`,
    title,
    Story: Story as ComponentType,
  }));
});

// Overlays open on load and cover the page, and shells repeat landmarks: they are checked on their own.
const OVERLAYS = /Dialog|Inactivity|App shell/;

const SECTIONS: Record<string, (title: string) => boolean> = {
  components: (title) => title.startsWith('Components/') && !OVERLAYS.test(title),
  patterns: (title) => title.startsWith('Patterns/') && !OVERLAYS.test(title),
  tokens: (title) => title === 'Tokens',
  tv: (title) => title === 'TV display',
  all: (title) => !OVERLAYS.test(title) && title !== 'TV display',
};

export function ComponentGallery({
  section,
  story,
  stretch,
  bare,
}: {
  section: string;
  story: string | undefined;
  stretch: boolean;
  /** Only the chosen story, full size, with no headings: for measuring a full-screen layout. */
  bare: boolean;
}) {
  const chosen = story
    ? entries.filter((entry) => entry.id === story)
    : entries.filter((entry) => (SECTIONS[section] ?? SECTIONS.all)?.(entry.title));
  if (bare) {
    return (
      <div data-stretch={stretch ? 'on' : undefined} data-testid="gallery">
        {chosen.map(({ id, Story }) => (
          <Story key={id} />
        ))}
      </div>
    );
  }
  return (
    <div
      data-stretch={stretch ? 'on' : undefined}
      data-testid="gallery"
      className="flex flex-col gap-10 p-4"
    >
      <h1>Component gallery</h1>
      {chosen.map(({ id, Story }) => (
        <section
          key={id}
          data-story={id}
          className="flex flex-col items-start gap-3 border-t border-divider pt-6 [&>*]:max-w-full"
        >
          <h2 className="[overflow-wrap:anywhere]">{id}</h2>
          <Story />
        </section>
      ))}
    </div>
  );
}

export const storyIds = entries.map((entry) => entry.id);
