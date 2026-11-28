import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@lingui/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { i18n } from '@/i18n/index.ts';

import type { Appointment } from './api/appointments.ts';
import { StatusLabel } from './StatusLabel.tsx';

describe('StatusLabel: a word and an icon, never colour alone', () => {
  it.each<[Appointment['status'], string]>([
    ['scheduled', 'Scheduled'],
    ['checked_in', 'Checked in'],
    ['completed', 'Completed'],
    ['cancelled', 'Cancelled'],
    ['no_show', 'No-show'],
  ])('shows %s as %s', async (status, word) => {
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <StatusLabel status={status} />
      </I18nProvider>,
    );
    expect(screen.getByText(word)).toBeInTheDocument();
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });
});
