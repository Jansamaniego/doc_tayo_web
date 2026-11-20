import { Trans, useLingui } from '@lingui/react/macro';

import { usePageTitle } from '@/lib/use-page-title.ts';

export function NotFoundPage() {
  const { t } = useLingui();
  usePageTitle(t`Page not found`);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold">
        <Trans>We could not find this page</Trans>
      </h1>
      <p>
        <Trans>The address may be wrong, or the page may have moved.</Trans>
      </p>
      <p>
        <a className="font-semibold text-primary underline" href="/">
          <Trans>Go to the home page</Trans>
        </a>
      </p>
    </div>
  );
}
