import { useLingui } from '@lingui/react/macro';

import { usePageTitle } from '@/lib/use-page-title.ts';

import {
  ClinicCounts,
  ClinicsPreview,
  NeedsAttention,
  PeopleCounts,
  SystemStatus,
} from './OverviewBlocks.tsx';
import { SampleActivity } from './SampleActivity.tsx';

/**
 * The platform admin's landing page: every clinic at a glance. It shows only what `/admin/*` returns
 * (no clinic data), and the activity block is labelled sample data (plans/04-platform-admin.md §5.0).
 */
export function AdminOverviewPage() {
  const { t } = useLingui();
  usePageTitle(t`Platform overview`);
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1>{t`Platform overview`}</h1>
        <p className="text-body-lg text-ink-secondary">{t`All clinics on DocTayo`}</p>
      </div>
      <ClinicCounts />
      <PeopleCounts />
      <NeedsAttention />
      <ClinicsPreview />
      <SampleActivity />
      <SystemStatus />
    </div>
  );
}
