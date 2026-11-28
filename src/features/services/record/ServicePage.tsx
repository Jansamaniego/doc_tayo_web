import { useLingui } from '@lingui/react/macro';
import { useState, type ReactNode } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { DetailRow } from '@/design-system/patterns/detail-row.tsx';
import { can } from '@/lib/permissions.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useService, type Service } from '../api/services.ts';
import { formatDuration } from '@/lib/duration.ts';
import { ServicePrice } from '../ServicePrice.tsx';
import { EditService } from './EditService.tsx';
import { ServiceActions } from './ServiceActions.tsx';
import { BackToServices, isServiceNotFound, ServiceNotFound } from './ServiceNotFound.tsx';

function Details({ service, children }: { service: Service; children?: ReactNode }) {
  const { t } = useLingui();
  usePageTitle(service.name);
  return (
    <div className="flex max-w-reading flex-col gap-8">
      <BackToServices />
      {!service.isActive && (
        <Alert variant="warning">{t`This service is inactive. It is not offered when booking.`}</Alert>
      )}
      <h1 className="break-words">{service.name}</h1>
      <dl className="flex flex-col gap-3 rounded-lg border border-divider bg-surface p-6 shadow-1">
        <DetailRow label={t`Description`}>
          <span className="break-words whitespace-pre-line">
            {service.description ?? t`No description`}
          </span>
        </DetailRow>
        <DetailRow label={t`Usual length`}>
          {formatDuration(service.defaultDurationMinutes)}
        </DetailRow>
        <DetailRow label={t`Price`}>
          <ServicePrice price={service.price} />
        </DetailRow>
      </dl>
      {children}
    </div>
  );
}

export function ServicePage({ serviceId }: { serviceId: string }) {
  const { t } = useLingui();
  const session = useSession();
  const mayManage = session.status === 'signed-in' && can(session.permissions, 'services.manage');
  const service = useService(serviceId);
  const [editing, setEditing] = useState(false);

  // Above the read: what is being typed stays when that read changes (a clinic switched elsewhere).
  if (editing) {
    return (
      <EditService
        serviceId={serviceId}
        onDone={() => {
          setEditing(false);
        }}
      />
    );
  }
  if (service.isPending) return <LoadingState label={t`Loading the service…`} />;
  if (service.isError) {
    const error = asApiError(service.error);
    if (isServiceNotFound(error)) return <ServiceNotFound />;
    // A later read that failed leaves what is already shown.
    if (!service.data) {
      return (
        <ErrorState
          message={messageForError(error)}
          requestId={error.requestId}
          onRetry={() => {
            void service.refetch();
          }}
        />
      );
    }
  }
  return (
    <Details service={service.data}>
      {mayManage && (
        <ServiceActions
          service={service.data}
          onEdit={() => {
            setEditing(true);
          }}
        />
      )}
    </Details>
  );
}
