import { useLingui } from '@lingui/react/macro';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { Button } from '@/design-system/components/button.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';

import { usePermissionDescriptions, useRoles } from '../api/roles.ts';

/** "What each role can do": closed until opened, and nothing is requested before that. */
export function RolesReference() {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <section className="flex flex-col gap-4">
      <div>
        <Button
          variant="tertiary"
          icon={
            open ? (
              <ChevronDown aria-hidden="true" className="size-5" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-5" />
            )
          }
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen(!open);
          }}
        >
          {t`What each role can do`}
        </Button>
      </div>
      <div id={panelId} hidden={!open}>
        {open && <RolesList />}
      </div>
    </section>
  );
}

function RolesList() {
  const { t } = useLingui();
  const roles = useRoles();
  const descriptions = usePermissionDescriptions();

  if (roles.isPending || descriptions.isPending) return <LoadingState label={t`Loading roles…`} />;
  const failure = roles.error ?? descriptions.error;
  if (roles.isError || descriptions.isError) {
    const error = asApiError(failure);
    return (
      <ErrorState
        message={messageForError(error)}
        requestId={error.requestId}
        onRetry={() => {
          void roles.refetch();
          void descriptions.refetch();
        }}
      />
    );
  }

  const meaning = new Map(descriptions.data.map((item) => [item.key, item.description]));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {roles.data.map((role) => (
        <section
          key={role.id}
          aria-labelledby={`role-${role.id}`}
          className="flex flex-col gap-2 rounded-lg border border-divider bg-surface p-5 shadow-1"
        >
          <h3 id={`role-${role.id}`} className="text-h3">
            {role.name}
          </h3>
          {role.permissions.length === 0 ? (
            <p className="text-ink-secondary">{t`No permissions`}</p>
          ) : (
            <ul className="list-disc pl-6">
              {role.permissions.map((key) => (
                <li key={key}>{meaning.get(key) ?? key}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
