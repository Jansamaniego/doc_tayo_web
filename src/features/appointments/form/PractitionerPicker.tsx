import { useLingui } from '@lingui/react/macro';

import { SelectField } from '@/design-system/components/select-fields.tsx';
import type { DirectoryEntry } from '@/features/practitioners/api/directory.ts';

type Practitioner = DirectoryEntry & {
  practitioner: NonNullable<DirectoryEntry['practitioner']>;
};

export const isPractitioner = (entry: DirectoryEntry): entry is Practitioner =>
  entry.practitioner !== null;

/**
 * Every active practitioner, those with hours at the chosen branch first. The others stay on offer:
 * booking outside a practitioner's hours is allowed (docs/appointments-integration.md).
 */
export function PractitionerPicker({
  everyone,
  atBranch,
  branchName,
  value,
  onChange,
  error,
}: {
  everyone: DirectoryEntry[];
  /** Membership ids of those with hours at the branch. */
  atBranch: Set<string>;
  branchName: string | undefined;
  value: string;
  onChange: (membershipId: string) => void;
  error: string | undefined;
}) {
  const { t } = useLingui();
  const choices = everyone.filter(isPractitioner).map((entry) => ({
    value: entry.membershipId,
    label: entry.practitioner.displayName,
  }));
  const here = choices.filter((choice) => atBranch.has(choice.value));
  const elsewhere = choices.filter((choice) => !atBranch.has(choice.value));
  const name = branchName ?? '';

  return (
    <SelectField
      label={t`Practitioner`}
      name="practitionerMembershipId"
      error={error}
      value={value}
      onChange={onChange}
      emptyOption={t`Choose a practitioner`}
      options={[]}
      groups={[
        { label: t`Works at ${name}`, options: here },
        { label: t`Other practitioners`, options: elsewhere },
      ]}
    />
  );
}
