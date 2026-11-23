import { useRouter } from '@tanstack/react-router';
import type { MouseEvent, ReactNode } from 'react';

import { Button } from '@/design-system/components/button.tsx';
import { TextLink, type TextLinkProps } from '@/design-system/components/link.tsx';

/**
 * A link that moves inside the app without reloading the page (a reload would sign the person in
 * again from the cookie and lose the in-memory state). Outside a router it is an ordinary link.
 * Opening in a new tab, or with a modifier key, keeps the browser's own behaviour.
 */
export function AppLink({ href, onClick, ...props }: TextLinkProps & { href: string }) {
  const handleClick = useSpaClick({ href, onClick, target: props.target });
  return <TextLink href={href} onClick={handleClick} {...props} />;
}

/** The click handler that makes any `<a href>` move inside the app (see AppLink). */
export function useSpaClick({
  href,
  onClick,
  target,
}: {
  href: string;
  onClick?: ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
  target?: string | undefined;
}): (event: MouseEvent<HTMLAnchorElement>) => void {
  const router = useRouter({ warn: false }) as ReturnType<typeof useRouter> | undefined;
  return (event) => {
    onClick?.(event);
    const plain =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (event.defaultPrevented || !router || !plain || target === '_blank') return;
    event.preventDefault();
    void router.navigate({ href });
  };
}

/** A link that looks like a button (for a primary action that goes to another page). */
export function AppButtonLink({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  const onClick = useSpaClick({ href });
  return (
    <Button asChild variant={variant}>
      <a href={href} onClick={onClick}>
        {children}
      </a>
    </Button>
  );
}
