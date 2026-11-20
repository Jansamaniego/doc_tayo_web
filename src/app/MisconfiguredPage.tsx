import { Trans } from '@lingui/react/macro';

/** Shown instead of a blank screen when the environment is invalid. Key names only, never values. */
export function MisconfiguredPage({ invalidKeys }: { invalidKeys: string[] }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold">
        <Trans>This app is misconfigured</Trans>
      </h1>
      <p>
        <Trans>
          The settings below are missing or not valid. Ask the person who installed the app to fix
          them.
        </Trans>
      </p>
      <ul className="list-disc pl-6">
        {invalidKeys.map((key) => (
          <li key={key}>
            <code>{key}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
