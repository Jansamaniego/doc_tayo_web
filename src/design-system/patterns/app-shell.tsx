import { useLingui } from '@lingui/react/macro';
import { Ellipsis, Menu } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/design-system/components/button.tsx';
import { Sheet } from '@/design-system/components/sheet.tsx';
import { useMediaQuery } from '@/design-system/components/use-media-query.ts';
import { cn } from '@/lib/cn.ts';
import { can } from '@/lib/permissions.ts';

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  href: string;
  /** Permission key from GET /me. Without it the item is shown to everyone. */
  requires?: string;
}

export interface RenderLinkProps {
  href: string;
  className: string;
  children: ReactNode;
  current: boolean;
}

export interface AppShellProps {
  items: NavItem[];
  /** The person's permissions in the active clinic (GET /me). Items they cannot use are hidden. */
  permissions: readonly string[];
  currentId: string;
  /** `auto` follows the screen: desktop from lg, tablet from md, otherwise mobile. */
  layout?: 'auto' | 'desktop' | 'tablet' | 'mobile';
  clinic: ReactNode;
  user: ReactNode;
  children: ReactNode;
  /** Lets the app render links through its router. */
  renderLink?: (props: RenderLinkProps) => ReactNode;
}

const MAX_TABS = 5;

const defaultLink = ({ href, className, children, current }: RenderLinkProps): ReactNode => (
  <a href={href} className={className} aria-current={current ? 'page' : undefined}>
    {children}
  </a>
);

type Variant = 'side' | 'menu' | 'tab';

const LINK: Record<Variant, { base: string; current: string; idle: string }> = {
  side: {
    base: 'flex min-h-target items-center gap-3 rounded-md border-l-4 px-4 no-underline',
    current: 'border-primary bg-selected font-bold',
    idle: 'border-transparent hover:bg-hover',
  },
  menu: {
    base: 'flex min-h-target items-center gap-3 rounded-md border-l-4 px-4 no-underline',
    current: 'border-primary bg-selected font-bold',
    idle: 'border-transparent hover:bg-hover',
  },
  tab: {
    base: 'flex min-h-target flex-col items-center justify-center gap-1 border-t-4 px-1 text-small no-underline',
    current: 'border-primary bg-selected font-bold',
    idle: 'border-transparent hover:bg-hover',
  },
};

function NavLinks({
  items,
  currentId,
  variant,
  renderLink,
}: {
  items: NavItem[];
  currentId: string;
  variant: Variant;
  renderLink: NonNullable<AppShellProps['renderLink']>;
}) {
  const styles = LINK[variant];
  return (
    <>
      {items.map((item) => {
        const current = item.id === currentId;
        return (
          <li key={item.id} className={variant === 'tab' ? 'flex-1' : undefined}>
            {renderLink({
              href: item.href,
              current,
              className: cn(styles.base, current ? styles.current : styles.idle),
              children: (
                <>
                  <span aria-hidden="true" className="inline-flex [&>svg]:size-6">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </>
              ),
            })}
          </li>
        );
      })}
    </>
  );
}

/**
 * The frame around every signed-in page: side navigation on desktop, a labelled "Menu" on tablet,
 * a bottom tab bar on mobile. Items the person cannot use are hidden, from their permission keys.
 */
export function AppShell({
  items,
  permissions,
  currentId,
  layout = 'auto',
  clinic,
  user,
  children,
  renderLink = defaultLink,
}: AppShellProps) {
  const { t } = useLingui();
  const isDesktop = useMediaQuery('(min-width: 64em)');
  const isTablet = useMediaQuery('(min-width: 48em)');
  const [menuOpen, setMenuOpen] = useState(false);
  const mode =
    layout === 'auto' ? (isDesktop ? 'desktop' : isTablet ? 'tablet' : 'mobile') : layout;

  const visible = items.filter((item) => can(permissions, item.requires));
  const crowded = visible.length > MAX_TABS;
  const tabs = crowded ? visible.slice(0, MAX_TABS - 1) : visible;
  const overflow = crowded ? visible.slice(MAX_TABS - 1) : [];

  const topBar = (leading?: ReactNode) => (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-divider bg-surface px-4 py-2 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        {leading}
        {clinic}
      </div>
      {user}
    </header>
  );

  const content = (
    <main
      id="main"
      tabIndex={-1}
      className={cn(
        'mx-auto w-full max-w-content flex-1 p-4 outline-none md:p-8',
        mode === 'mobile' && 'pb-28',
      )}
    >
      {children}
    </main>
  );

  if (mode === 'desktop') {
    return (
      <div className="flex min-h-screen bg-page print:block">
        <aside className="w-64 shrink-0 border-r border-divider bg-surface p-3 print:hidden">
          <nav aria-label={t`Main`}>
            <ul className="flex flex-col gap-1">
              <NavLinks
                items={visible}
                currentId={currentId}
                variant="side"
                renderLink={renderLink}
              />
            </ul>
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          {topBar()}
          {content}
        </div>
      </div>
    );
  }

  if (mode === 'tablet') {
    return (
      <div className="flex min-h-screen flex-col bg-page print:block">
        {topBar(
          <Button
            variant="secondary"
            icon={<Menu className="size-5" />}
            onClick={() => {
              setMenuOpen(true);
            }}
          >
            {t`Menu`}
          </Button>,
        )}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen} title={t`Menu`}>
          <nav aria-label={t`Main`}>
            <ul className="flex flex-col gap-1">
              <NavLinks
                items={visible}
                currentId={currentId}
                variant="menu"
                renderLink={renderLink}
              />
            </ul>
          </nav>
        </Sheet>
        {content}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-page print:block">
      {topBar()}
      {content}
      <nav
        aria-label={t`Main`}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-surface print:hidden"
      >
        <ul className="flex">
          <NavLinks items={tabs} currentId={currentId} variant="tab" renderLink={renderLink} />
          {crowded && (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(true);
                }}
                className="flex min-h-target w-full flex-col items-center justify-center gap-1 border-t-4 border-transparent px-1 text-small hover:bg-hover"
              >
                <Ellipsis aria-hidden="true" className="size-6" />
                {t`More`}
              </button>
            </li>
          )}
        </ul>
      </nav>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title={t`More`}>
        <ul className="flex flex-col gap-1">
          <NavLinks items={overflow} currentId={currentId} variant="menu" renderLink={renderLink} />
        </ul>
      </Sheet>
    </div>
  );
}
