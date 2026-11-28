import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { Combobox } from '@/design-system/components/select-fields.tsx';
import { usePatientSearch, type Patient } from '@/features/patients/api/patients.ts';
import { patientListName } from '@/features/patients/patient-name.ts';
import { AppLink } from '@/lib/app-link.tsx';
import { formatPlainDate } from '@/lib/datetime/plain-date.ts';

const DEBOUNCE_MILLISECONDS = 250;
/** The API refuses a longer search. */
const MAX_SEARCH_LENGTH = 100;

export interface ChosenPatient {
  id: string;
  label: string;
}

/** "P-000123, Dela Cruz, Juan, born Mar 4, 1980": enough to tell two people apart. */
export function usePatientLabel(): (patient: Patient) => string {
  const { t } = useLingui();
  return (patient) => {
    const name = patientListName(patient);
    const born = patient.birthDate
      ? formatPlainDate({ date: patient.birthDate, style: 'medium' })
      : undefined;
    return [patient.patientNumber, name, born && t`born ${born}`].filter(Boolean).join(', ');
  };
}

/**
 * Finds a patient by name, number or phone (P9-11). What is typed is personal data: it goes to the API
 * and nowhere else.
 */
export function PatientPicker({
  tenantId,
  chosen,
  onChoose,
  error,
  mayRegister,
}: {
  tenantId: string;
  chosen: ChosenPatient | undefined;
  onChoose: (patient: ChosenPatient) => void;
  error: string | undefined;
  mayRegister: boolean;
}) {
  const { t } = useLingui();
  const label = usePatientLabel();
  /** Undefined until the list is first opened: nothing is asked before. */
  const [typed, setTyped] = useState<string>();
  const [q, setQ] = useState('');
  const wanted = (typed ?? '').trim().slice(0, MAX_SEARCH_LENGTH);

  useEffect(() => {
    // Opening the list empties the search at once; typing waits for a pause.
    const timer = window.setTimeout(
      () => {
        setQ(wanted);
      },
      wanted === '' ? 0 : DEBOUNCE_MILLISECONDS,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [wanted]);

  const search = usePatientSearch({ q, tenantId, enabled: typed !== undefined });
  const options = (search.data ?? []).map((patient) => ({
    value: patient.id,
    label: label(patient),
  }));
  const nothing = search.isError ? (
    <p className="font-semibold text-danger">{messageForError(asApiError(search.error))}</p>
  ) : (
    <div className="flex flex-col gap-1">
      <p>{t`No patient found`}</p>
      {mayRegister && (
        <AppLink href="/patients/new" standalone>
          {t`Register a patient`}
        </AppLink>
      )}
    </div>
  );

  return (
    <Combobox
      label={t`Patient`}
      name="patientId"
      hint={t`Search by name, patient number or phone`}
      error={error}
      options={options}
      value={chosen?.id ?? ''}
      onChange={(id) => {
        const option = options.find((item) => item.value === id);
        if (option) onChoose({ id, label: option.label });
      }}
      search={{
        onQueryChange: setTyped,
        loading: wanted !== q || (typed !== undefined && search.isFetching),
        selectedLabel: chosen?.label,
        empty: nothing,
      }}
    />
  );
}
