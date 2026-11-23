import { useLingui } from '@lingui/react/macro';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import type { ApiError } from '@/api/errors.ts';
import { ErrorState } from '@/design-system/components/state-views.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import { AppLink } from '@/lib/app-link.tsx';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useCreateBranch } from '../api/branches.ts';
import { BranchForm, type BranchFormValues } from './BranchForm.tsx';

export function NewBranchPage({
  onCreated,
}: {
  onCreated: (created: { id: string; name: string }) => void;
}) {
  const { t } = useLingui();
  usePageTitle(t`Add a branch`);
  const create = useCreateBranch();
  const [failure, setFailure] = useState<ApiError | undefined>();

  async function createBranch(values: BranchFormValues): Promise<'saved'> {
    setFailure(undefined);
    // Empty optional fields are left out. A new branch is always active.
    const created = await create.mutateAsync({
      name: values.name,
      isActive: true,
      ...(values.addressLine !== '' && { addressLine: values.addressLine }),
      ...(values.city !== '' && { city: values.city }),
      ...(values.province !== '' && { province: values.province }),
      ...(values.timezone !== '' && { timezone: values.timezone }),
    });
    notify.success(t`${created.name} added.`);
    onCreated({ id: created.id, name: created.name });
    return 'saved';
  }

  return (
    <div className="flex max-w-reading flex-col gap-6">
      <AppLink
        href="/clinic/branches"
        className="inline-flex min-h-target items-center gap-2 self-start"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
        {t`All branches`}
      </AppLink>
      <h1>{t`Add a branch`}</h1>
      {failure && <ErrorState message={messageForError(failure)} requestId={failure.requestId} />}
      <BranchForm
        submitLabel={t`Add branch`}
        savingLabel={t`Adding…`}
        onSubmit={createBranch}
        onFailed={setFailure}
      />
    </div>
  );
}
