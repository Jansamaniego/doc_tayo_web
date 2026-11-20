import { useLingui } from '@lingui/react/macro';
import { Building2, ChevronDown } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { StatusPill } from '@/design-system/components/badge.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { SelectField } from '@/design-system/components/select-fields.tsx';

export interface ClinicOption {
  id: string;
  name: string;
  /** Only an active clinic can be chosen. */
  status: 'active' | 'suspended' | 'deactivated';
}

export interface ClinicSwitcherProps {
  clinics: ClinicOption[];
  currentId: string;
  onSelect: (clinicId: string) => void;
}

/** Shows the current clinic's name in full. With several clinics it opens a list; suspended ones are listed but cannot be chosen. */
export function ClinicSwitcher({ clinics, currentId, onSelect }: ClinicSwitcherProps) {
  const { t } = useLingui();
  const current = clinics.find((clinic) => clinic.id === currentId);
  const name = current?.name ?? '';
  if (clinics.length <= 1) {
    return (
      <span className="flex items-center gap-2 font-bold">
        <Building2 aria-hidden="true" className="size-5" />
        {name}
      </span>
    );
  }
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" icon={<Building2 className="size-5" />}>
          <span className="flex flex-col items-start text-left leading-tight">
            <span>{name}</span>
            <span className="text-small font-normal">{t`Switch clinic`}</span>
          </span>
          <ChevronDown aria-hidden="true" className="size-5" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-64 rounded-lg border border-divider bg-surface p-2 shadow-2"
        >
          <DropdownMenu.RadioGroup value={currentId} onValueChange={onSelect}>
            {clinics.map((clinic) => (
              <DropdownMenu.RadioItem
                key={clinic.id}
                value={clinic.id}
                disabled={clinic.status !== 'active'}
                className="flex min-h-target cursor-pointer items-center justify-between gap-3 rounded-md px-3 data-[disabled]:cursor-not-allowed data-[highlighted]:bg-selected data-[state=checked]:font-bold"
              >
                <span>{clinic.name}</span>
                {clinic.status === 'suspended' && (
                  <StatusPill status="warning">{t`Suspended`}</StatusPill>
                )}
                {clinic.status === 'deactivated' && (
                  <StatusPill status="neutral">{t`No longer active`}</StatusPill>
                )}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export interface BranchSelectorProps {
  branches: { id: string; name: string }[];
  value: string;
  onChange: (branchId: string) => void;
}

/** A labelled select: branch names are shown in full. */
export function BranchSelector({ branches, value, onChange }: BranchSelectorProps) {
  const { t } = useLingui();
  return (
    <SelectField
      label={t`Branch`}
      options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
      value={value}
      onChange={onChange}
    />
  );
}
