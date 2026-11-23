import { useLingui } from '@lingui/react/macro';

import { StatusPill } from '@/design-system/components/badge.tsx';

// Static sample data: there is no platform-wide activity endpoint yet (plan.md D-31). Every number is
// marked "(sample)" for screen readers and the whole block says "Sample data": it must never be read as real.
const FIGURES = [
  { id: 'appointments', count: 128 },
  { id: 'patients', count: 96 },
  { id: 'sign-ins', count: 214 },
] as const;

const BUSIEST = [
  { name: 'Clinic A', appointments: 42 },
  { name: 'Clinic B', appointments: 31 },
  { name: 'Clinic C', appointments: 19 },
] as const;

const Sample = () => {
  const { t } = useLingui();
  return <span className="sr-only">{t`(sample)`}</span>;
};

export function SampleActivity() {
  const { t } = useLingui();
  const labels = {
    appointments: t`Appointments today`,
    patients: t`Patients seen today`,
    'sign-ins': t`Sign-ins today`,
  };
  return (
    <section aria-labelledby="activity-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="activity-heading">{t`Activity across clinics`}</h2>
        <StatusPill status="info">{t`Sample data`}</StatusPill>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        {FIGURES.map(({ id, count }) => (
          <div
            key={id}
            className="flex flex-col gap-1 rounded-lg border border-dashed border-control bg-surface p-5"
          >
            <dt className="font-semibold text-ink-secondary">{labels[id]}</dt>
            <dd className="text-display font-bold">
              {count}
              <Sample />
            </dd>
          </div>
        ))}
      </dl>
      <table className="w-full max-w-reading border-collapse text-left">
        <caption className="pb-2 text-left font-semibold">{t`Busiest clinics today (sample)`}</caption>
        <thead>
          <tr className="border-b border-divider">
            <th scope="col" className="py-2 pr-4">{t`Clinic`}</th>
            <th scope="col" className="py-2">{t`Appointments`}</th>
          </tr>
        </thead>
        <tbody>
          {BUSIEST.map((row) => (
            <tr key={row.name} className="border-b border-divider">
              <th scope="row" className="py-2 pr-4 font-normal">
                {row.name}
              </th>
              <td className="py-2">
                {row.appointments}
                <Sample />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-ink-muted">
        {t`These figures are examples. Real numbers will appear here once the platform reports them.`}
      </p>
    </section>
  );
}
