import { Stethoscope } from 'lucide-react';
import type { ReactNode } from 'react';

import { usePageTitle } from '@/lib/use-page-title.ts';

// A brand name is not translated.
const PRODUCT_NAME = 'DocTayo';

/** The frame of every page before sign-in: the brand, then one card with the page's heading and form. */
export function AuthPage({ title, children }: { title?: string; children: ReactNode }) {
  usePageTitle(title ? `${title} · ${PRODUCT_NAME}` : PRODUCT_NAME);
  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-page px-4 py-10 md:py-16">
      <div className="flex items-center gap-3 text-h2 font-bold text-primary">
        <span className="flex size-12 items-center justify-center rounded-lg bg-primary text-on-primary">
          <Stethoscope aria-hidden="true" className="size-7" />
        </span>
        {PRODUCT_NAME}
      </div>
      <main
        id="main"
        tabIndex={-1}
        className="flex w-full max-w-md flex-col gap-6 rounded-lg border border-divider bg-surface p-6 shadow-1 outline-none md:p-8"
      >
        {title && <h1>{title}</h1>}
        {children}
      </main>
    </div>
  );
}
