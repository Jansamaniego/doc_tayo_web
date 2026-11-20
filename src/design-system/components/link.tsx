import { ArrowRight } from 'lucide-react';
import type { AnchorHTMLAttributes } from 'react';

import { cn } from '@/lib/cn.ts';

export interface TextLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** A link on its own line (not inside a sentence): bigger target and an arrow. */
  standalone?: boolean;
}

/** Underlined, so a link is never told apart by colour alone. */
export function TextLink({ standalone = false, className, children, ...props }: TextLinkProps) {
  return (
    <a
      className={cn(
        'font-semibold text-link underline underline-offset-4 hover:text-primary-hover',
        standalone && 'inline-flex min-h-target items-center gap-1',
        className,
      )}
      {...props}
    >
      {children}
      {standalone && <ArrowRight aria-hidden="true" className="size-5" />}
    </a>
  );
}
