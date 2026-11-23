import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { asApiError, type ApiError } from '@/api/errors.ts';
import { Button } from '@/design-system/components/button.tsx';
import { CheckboxGroup } from '@/design-system/components/choice-fields.tsx';
import { TextField } from '@/design-system/components/text-fields.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { applyApiErrors } from '@/lib/api-form-errors.ts';

import { useUpdateMember, type Member, type MemberChanges } from '../api/members.ts';
import type { Role } from '../api/roles.ts';

interface Values {
  roleIds: string[];
  jobTitle: string;
}

const MAX_ROLES = 5;
const MAX_JOB_TITLE = 100;

/**
 * Changes a member's roles and/or job title (`PATCH /members/:id`). Only what changed is sent;
 * `roleIds` is the whole new set; an emptied job title is sent as `null`. Failures that are not about
 * a field go to the page (`onFailed`), which knows how to explain them.
 */
export function EditMemberForm({
  member,
  roles,
  canEditRoles,
  onSaved,
  onFailed,
  onCancel,
}: {
  member: Member;
  roles: Role[];
  /** False for your own row and for an owner you may not change: the job title only. */
  canEditRoles: boolean;
  onSaved: (member: Member) => void;
  onFailed: (error: ApiError) => void;
  onCancel: () => void;
}) {
  const { t } = useLingui();
  const update = useUpdateMember();
  const currentRoleIds = member.roles.map((role) => role.id);
  const { register, handleSubmit, setError, clearErrors, setValue, control, formState } =
    useForm<Values>({
      defaultValues: { roleIds: currentRoleIds, jobTitle: member.jobTitle ?? '' },
    });
  const roleIds = useWatch({ control, name: 'roleIds' });
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [nothingToChange, setNothingToChange] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const giveable = roles.filter((role) => role.assignable);
  const refused = roles.filter((role) => !role.assignable);
  const ownerGiveable = giveable.some((role) => role.key === 'owner');
  const labels = { roleIds: t`Roles`, jobTitle: t`Job title` };

  async function save(values: Values): Promise<void> {
    setNothingToChange(false);
    const problems: SummaryEntry[] = [];
    const jobTitle = values.jobTitle.trim();
    if (canEditRoles && values.roleIds.length < 1) {
      problems.push({
        name: 'roleIds',
        label: labels.roleIds,
        message: t`Choose at least one role.`,
      });
    } else if (canEditRoles && values.roleIds.length > MAX_ROLES) {
      problems.push({
        name: 'roleIds',
        label: labels.roleIds,
        message: t`Choose at most 5 roles.`,
      });
    }
    if (jobTitle.length > MAX_JOB_TITLE) {
      problems.push({
        name: 'jobTitle',
        label: labels.jobTitle,
        message: t`A job title can have at most 100 characters.`,
      });
    }
    if (problems.length > 0) {
      for (const problem of problems) {
        setError(problem.name as keyof Values, { type: 'client', message: problem.message });
      }
      setSummary(problems);
      setAttempt((count) => count + 1);
      return;
    }
    setSummary([]);

    const sameRoles =
      values.roleIds.length === currentRoleIds.length &&
      values.roleIds.every((id) => currentRoleIds.includes(id));
    const changes: MemberChanges = {
      ...(canEditRoles && !sameRoles && { roleIds: values.roleIds }),
      ...(jobTitle !== (member.jobTitle ?? '') && { jobTitle: jobTitle === '' ? null : jobTitle }),
    };
    if (Object.keys(changes).length === 0) {
      setNothingToChange(true);
      return;
    }
    try {
      onSaved(await update.mutateAsync({ membershipId: member.membershipId, changes }));
    } catch (error) {
      const apiError = asApiError(error);
      if (apiError.code === 'VALIDATION_FAILED') {
        setSummary(applyApiErrors({ error: apiError, setError, fieldLabels: labels }).summary);
        setAttempt((count) => count + 1);
      } else {
        onFailed(apiError);
      }
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void handleSubmit(save)(event);
      }}
    >
      <FormErrorSummary errors={summary} focusKey={attempt} />
      {canEditRoles && (
        <div className="flex flex-col gap-3">
          <CheckboxGroup
            legend={t`Roles`}
            hint={
              ownerGiveable
                ? t`Choose 1 to 5 roles. To hand over the clinic, give another member the Owner role; they can then remove it from you.`
                : t`Choose 1 to 5 roles.`
            }
            error={formState.errors.roleIds?.message}
            options={giveable.map((role) => ({ value: role.id, label: role.name }))}
            value={roleIds}
            onChange={(next) => {
              // The roles are not a registered input, so nothing else clears an old error, and a form
              // with an error in it will not submit.
              clearErrors('roleIds');
              setSummary((entries) => entries.filter((entry) => entry.name !== 'roleIds'));
              setValue('roleIds', next, { shouldDirty: true });
            }}
          />
          {refused.length > 0 && (
            <p className="text-ink-secondary">
              {refused.some((role) => role.key === 'owner')
                ? t`Only an owner can give the Owner role.`
                : t`You cannot give ${refused.map((role) => role.name).join(', ')}.`}
            </p>
          )}
        </div>
      )}
      <TextField
        label={t`Job title`}
        optional
        autoComplete="off"
        error={formState.errors.jobTitle?.message}
        {...register('jobTitle')}
      />
      {nothingToChange && <p role="status">{t`Nothing to change.`}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={update.isPending} loadingText={t`Saving…`}>
          {t`Save`}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t`Cancel`}
        </Button>
      </div>
    </form>
  );
}
