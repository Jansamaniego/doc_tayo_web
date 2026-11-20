import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge must know that our type scale (`text-body-lg`, `text-h1`, `text-tv-number`, ...) is
// a FONT SIZE, not a colour: otherwise `text-on-primary text-body-lg` is "one text-* class too many"
// and the colour is silently dropped (white text lost on a primary button).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display',
            'h1',
            'h2',
            'h3',
            'body-lg',
            'body',
            'label',
            'small',
            'tv-number',
            'tv-name',
            'tv-entry',
            'tv-label',
            'tv-meta',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
