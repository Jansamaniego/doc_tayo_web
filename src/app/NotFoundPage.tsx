import { Trans, useLingui } from '@lingui/react/macro';

import { TextLink } from '@/design-system/components/link.tsx';
import { usePageTitle } from '@/lib/use-page-title.ts';

export function NotFoundPage() {
  const { t } = useLingui();
  usePageTitle(t`Page not found`);
  return (
    <div className="mx-auto flex max-w-reading flex-col gap-4 px-4 py-10">
      <h1>
        <Trans>We could not find this page</Trans>
      </h1>
      <p>
        <Trans>The address may be wrong, or the page may have moved.</Trans>
      </p>
      <p>
        <TextLink href="/" standalone>
          <Trans>Go to the home page</Trans>
        </TextLink>
      </p>
    </div>
  );
}
