import { createFileRoute, notFound } from '@tanstack/react-router';
import { lazy } from 'react';
import { z } from '@/lib/zod.ts';

import { NotFoundPage } from '@/app/NotFoundPage.tsx';

// Development and e2e builds only: in a production build `import.meta.env.MODE` is replaced by
// "production", so the gallery and every story are removed from the bundle.
const Gallery =
  import.meta.env.MODE === 'production'
    ? NotFoundPage
    : lazy(async () => {
        const { ComponentGallery } = await import('@/app/ComponentGallery.tsx');
        function Page() {
          const { section, story, stretch, bare } = Route.useSearch();
          return (
            <ComponentGallery
              section={section}
              story={story}
              stretch={stretch === '1'}
              bare={bare === '1'}
            />
          );
        }
        return { default: Page };
      });

export const Route = createFileRoute('/components-gallery')({
  validateSearch: z.object({
    // The router turns "1" into a number, so every value is coerced back to text.
    section: z.coerce.string().default('all'),
    story: z.coerce.string().optional(),
    stretch: z.coerce.string().optional(),
    bare: z.coerce.string().optional(),
  }),
  beforeLoad: () => {
    // TanStack Router's documented way to answer "not found": notFound() returns a special object.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    if (import.meta.env.MODE === 'production') throw notFound();
  },
  component: Gallery,
});
