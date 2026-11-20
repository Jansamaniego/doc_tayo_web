import { createElement, type ReactNode } from 'react';

import { cn } from '@/lib/cn.ts';

const BOX = 'flex flex-col rounded-lg border border-divider bg-surface';

/** A container. With `href` the whole card is one link (keyboard focus shows the focus ring). */
export function Card({
  children,
  href,
  className,
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  if (href) {
    return (
      <a
        href={href}
        className={cn(BOX, 'no-underline hover:bg-hover active:bg-selected', className)}
      >
        {children}
      </a>
    );
  }
  return <div className={cn(BOX, className)}>{children}</div>;
}

export interface CardHeaderProps {
  title: string;
  /** The page chooses the level so the heading outline stays correct. Default 3. */
  headingLevel?: 2 | 3 | 4;
  action?: ReactNode;
}

export function CardHeader({ title, headingLevel = 3, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5">
      {createElement(`h${headingLevel}`, { className: 'text-h3 font-bold' }, title)}
      {action}
    </div>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="px-5 py-4">{children}</div>;
}

export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-divider px-5 py-3 text-small text-ink-muted">{children}</div>
  );
}
