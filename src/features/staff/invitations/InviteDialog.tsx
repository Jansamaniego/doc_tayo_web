import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError, type ApiError } from '@/api/errors.ts';
import { Button } from '@/design-system/components/button.tsx';
import { RadioGroup } from '@/design-system/components/choice-fields.tsx';
import { Dialog } from '@/design-system/components/dialog.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { TextField } from '@/design-system/components/text-fields.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { applyApiErrors } from '@/lib/api-form-errors.ts';

import { useCreateInvitation } from '../api/invitations.ts';
import { useRoles } from '../api/roles.ts';

interface Values {
  email: string;
  roleId: string;
}

const MAX_EMAIL = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;
const FORM_ID = 'invite-form';

/**
 * Invites someone by email with a role (`POST /invitations`). It is mounted only while open, so each
 * opening starts with an empty form. The Owner role is never offered, even to an owner: it is given
 * afterwards, from the person's page (docs/staff-management-integration.md 4.3).
 */
export function InviteDialog({
  onClose,
  onInvited,
  onShowOpen,
}: {
  onClose: () => void;
  onInvited: (email: string) => void;
  /** "An invitation to this address is already open": go and look at the open ones. */
  onShowOpen: () => void;
}) {
  const { t } = useLingui();
  const roles = useRoles();
  const create = useCreateInvitation();
  const { register, getValues, setError, clearErrors, setValue, control, formState } =
    useForm<Values>({ defaultValues: { email: '', roleId: '' } });
  const roleId = useWatch({ control, name: 'roleId' });
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<ApiError | undefined>();
  const [alreadyOpen, setAlreadyOpen] = useState(false);

  const labels = { email: t`Email`, roleId: t`Role` };
  const choices = (roles.data ?? []).filter((role) => role.key !== 'owner' && role.assignable);

  function reject({ name, message }: { name: keyof Values; message: string }): void {
    setError(name, { type: 'server', message });
    setSummary([{ name, label: labels[name], message }]);
    setAttempt((count) => count + 1);
  }

  async function send(values: Values): Promise<void> {
    setFailure(undefined);
    setAlreadyOpen(false);
    const email = values.email.trim();
    const problems: SummaryEntry[] = [];
    // All the checks are here, not in `register`, so every problem is shown at once.
    if (email === '') {
      problems.push({
        name: 'email',
        label: labels.email,
        message: t`Enter the person's email address.`,
      });
    } else if (!EMAIL_PATTERN.test(email)) {
      problems.push({
        name: 'email',
        label: labels.email,
        message: t`Enter a valid email address.`,
      });
    } else if (email.length > MAX_EMAIL) {
      problems.push({
        name: 'email',
        label: labels.email,
        message: t`An email address can have at most 254 characters.`,
      });
    }
    if (values.roleId === '') {
      problems.push({ name: 'roleId', label: labels.roleId, message: t`Choose a role.` });
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
    try {
      await create.mutateAsync({ email, roleId: values.roleId });
      onInvited(email);
    } catch (error) {
      const apiError = asApiError(error);
      if (apiError.code === 'CONFLICT') {
        reject({ name: 'email', message: t`This person is already on your staff.` });
      } else if (apiError.code === 'CONFLICT_UNIQUE') {
        setAlreadyOpen(true);
        reject({ name: 'email', message: t`An invitation to this address is already open.` });
      } else if (apiError.code === 'ROLE_NOT_ASSIGNABLE') {
        reject({
          name: 'roleId',
          message: t`The Owner role is given from the person's page, not by invitation.`,
        });
      } else if (apiError.code === 'NOT_FOUND') {
        void roles.refetch();
        reject({ name: 'roleId', message: t`That role is no longer available. Choose another.` });
      } else if (apiError.code === 'VALIDATION_FAILED') {
        setSummary(applyApiErrors({ error: apiError, setError, fieldLabels: labels }).summary);
        setAttempt((count) => count + 1);
      } else {
        setFailure(apiError);
      }
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t`Invite someone`}
      description={t`They get an email with a link that works for 7 days.`}
      dirty={formState.isDirty && !create.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t`Cancel`}
          </Button>
          <Button type="submit" form={FORM_ID} loading={create.isPending} loadingText={t`Sending…`}>
            {t`Send invitation`}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          // Every Send checks everything again: an old error (one that is not a registered input)
          // would otherwise stop the form from submitting at all.
          clearErrors();
          void send(getValues());
        }}
      >
        <FormErrorSummary errors={summary} focusKey={attempt} />
        {failure && <ErrorState message={messageForError(failure)} requestId={failure.requestId} />}
        <TextField
          label={t`Email`}
          type="email"
          inputMode="email"
          autoComplete="off"
          error={formState.errors.email?.message}
          {...register('email')}
        />
        {alreadyOpen && (
          <div>
            <Button variant="tertiary" onClick={onShowOpen}>
              {t`Show open invitations`}
            </Button>
          </div>
        )}
        {roles.isPending ? (
          <LoadingState label={t`Loading roles…`} />
        ) : roles.isError ? (
          <ErrorState
            message={messageForError(asApiError(roles.error))}
            requestId={asApiError(roles.error).requestId}
            onRetry={() => {
              void roles.refetch();
            }}
          />
        ) : (
          <RadioGroup
            legend={t`Role`}
            hint={t`The Owner role is given afterwards, from the person's page.`}
            error={formState.errors.roleId?.message}
            options={choices.map((role) => ({ value: role.id, label: role.name }))}
            value={roleId}
            onChange={(next) => {
              clearErrors('roleId');
              setSummary((entries) => entries.filter((entry) => entry.name !== 'roleId'));
              setValue('roleId', next, { shouldDirty: true });
            }}
          />
        )}
      </form>
    </Dialog>
  );
}
