import { useLingui } from '@lingui/react/macro';
import { Building2, CalendarDays, CircleCheck, Clock, Users } from 'lucide-react';
import type { ReactNode } from 'react';

import { usePageTitle } from '@/lib/use-page-title.ts';

export interface HomePageProps {
  fullName: string;
  clinicName: string;
}

/** The first screen after sign-in. Static for now: the figures arrive with appointments (Phase 7). */
export function HomePage({ fullName, clinicName }: HomePageProps) {
  const { t } = useLingui();
  const firstName = fullName.trim().split(/\s+/)[0] ?? fullName;
  usePageTitle(t`Home · ${clinicName}`);

  const figures: { label: string; icon: ReactNode }[] = [
    { label: t`Appointments`, icon: <CalendarDays aria-hidden="true" className="size-6" /> },
    { label: t`Waiting now`, icon: <Clock aria-hidden="true" className="size-6" /> },
    { label: t`Seen today`, icon: <CircleCheck aria-hidden="true" className="size-6" /> },
  ];
  const steps = [
    {
      title: t`Check your clinic details`,
      text: t`Make sure the name and time zone are right.`,
    },
    { title: t`Add your branches`, text: t`Each place where you see patients is a branch.` },
    {
      title: t`Invite your team`,
      text: t`Doctors and front-desk staff each get their own sign-in.`,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-lg bg-brand-light p-6 text-on-brand-light md:flex-row md:items-center md:justify-between md:p-8">
        <div className="flex flex-col gap-3">
          <h1>{t`Welcome, ${firstName}`}</h1>
          <p className="flex items-center gap-2 text-body-lg">
            <Building2 aria-hidden="true" className="size-6 shrink-0" />
            <span>{clinicName}</span>
          </p>
        </div>
        <p className="max-w-sm text-body-lg">{t`Here is where your day at the clinic will start.`}</p>
      </section>

      <section aria-labelledby="today-heading" className="flex flex-col gap-4">
        <h2 id="today-heading">{t`Today at a glance`}</h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          {figures.map(({ label, icon }) => (
            <div
              key={label}
              className="flex flex-col gap-2 rounded-lg border border-divider bg-surface p-5 shadow-1"
            >
              <dt className="flex items-center gap-2 font-semibold text-ink-secondary">
                {icon}
                {label}
              </dt>
              <dd className="text-display font-bold">
                <span aria-hidden="true">–</span>
                <span className="sr-only">{t`Not available yet`}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-ink-muted">{t`These numbers appear here once appointments are being booked.`}</p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-3">
          <Users aria-hidden="true" className="size-7 text-primary" />
          {t`Getting started`}
        </h2>
        <ol aria-label={t`Getting started`} className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="flex items-start gap-4 rounded-lg border border-divider bg-surface p-5"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-on-primary"
              >
                {index + 1}
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-body-lg font-bold">{step.title}</p>
                <p className="text-ink-secondary">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
