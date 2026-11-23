import { useEffect, type ElementType, type ReactNode, type Ref } from 'react';

// Radix locks the page scroll while a modal (dialog, menu, popover) is open, with `react-remove-scroll`.
// That library inserts a <style> element, which the production Content-Security-Policy forbids (no
// 'unsafe-inline' for styles, plans/01-foundation.md §2.12). The build aliases it to this version, which
// does the same job without a <style> element: a `data-scroll-locked` attribute that index.css styles,
// and the scrollbar's width kept as padding (set through the CSS object model, which the policy allows).

let locks = 0;
let savedPadding = '';

function lock(): void {
  if (locks++ > 0) return;
  const gap = window.innerWidth - document.documentElement.clientWidth;
  savedPadding = document.body.style.paddingRight;
  if (gap > 0) document.body.style.paddingRight = `${gap}px`;
  document.body.setAttribute('data-scroll-locked', '');
}

function unlock(): void {
  if (--locks > 0) return;
  document.body.removeAttribute('data-scroll-locked');
  document.body.style.paddingRight = savedPadding;
}

interface RemoveScrollProps {
  as?: ElementType;
  enabled?: boolean;
  children?: ReactNode;
  ref?: Ref<unknown>;
  // Accepted for compatibility with the real library; this version has nothing to do with them.
  allowPinchZoom?: boolean;
  shards?: unknown[];
  [prop: string]: unknown;
}

export function RemoveScroll({
  as: Component = 'div',
  enabled = true,
  children,
  ...rest
}: RemoveScrollProps) {
  // Left out of what reaches the element: the real library's options, which mean nothing here.
  const props = { ...rest };
  delete props.allowPinchZoom;
  delete props.shards;
  useEffect(() => {
    if (!enabled) return undefined;
    lock();
    return unlock;
  }, [enabled]);
  return <Component {...props}>{children}</Component>;
}
