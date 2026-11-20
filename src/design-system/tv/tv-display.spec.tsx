import { screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { TvDisplay, type TvDisplayProps } from './tv-display.tsx';

const BASE: TvDisplayProps = {
  clinicName: 'Sunrise Clinic',
  branchName: 'Main branch',
  time: '2:45 PM',
  nowServing: { number: 'A-024', shortName: 'Juan D.', room: 'Room 2', doctor: 'Dr. Lim' },
  otherCalls: [
    { number: 'A-023', room: 'Room 1' },
    { number: 'B-010', room: 'Room 3' },
  ],
  next: [
    { label: 'Dr. Reyes · Room 1', numbers: ['A-025', 'A-027', 'A-030'] },
    { label: 'Dr. Lim · Room 2', numbers: ['B-011', 'B-012'] },
  ],
  status: 'live',
  lastUpdated: '2:45 PM',
};

function renderTv(props: Partial<TvDisplayProps> = {}) {
  return renderWithProviders(<TvDisplay {...BASE} {...props} />);
}

describe('TvDisplay', () => {
  it('shows the clinic, the branch and the time in the header', () => {
    renderTv();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sunrise Clinic');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Main branch');
    expect(screen.getByText('2:45 PM', { selector: 'time' })).toBeInTheDocument();
  });

  it('shows "Now serving" with the number, the short name and the room', () => {
    renderTv();
    const section = screen.getByRole('region', { name: 'Now serving' });
    expect(within(section).getByText('A-024')).toBeInTheDocument();
    expect(within(section).getByText('Juan D.')).toBeInTheDocument();
    expect(within(section).getByText(/Room 2/)).toBeInTheDocument();
    expect(within(section).getByText(/Dr\. Lim/)).toBeInTheDocument();
  });

  it("lists the other rooms' current calls under it", () => {
    renderTv();
    const section = screen.getByRole('region', { name: 'Now serving' });
    expect(within(section).getByText('A-023')).toBeInTheDocument();
    expect(within(section).getByText('B-010')).toBeInTheDocument();
  });

  it('shows "Next" grouped per doctor or room', () => {
    renderTv();
    const section = screen.getByRole('region', { name: 'Next' });
    expect(within(section).getByText('Dr. Reyes · Room 1')).toBeInTheDocument();
    expect(within(section).getByText('A-027')).toBeInTheDocument();
    expect(within(section).getByText('Dr. Lim · Room 2')).toBeInTheDocument();
  });

  it('shows at most 3 per group and "+N more" for the rest (no scrolling, no carousel)', () => {
    renderTv({
      next: [{ label: 'Dr. Reyes · Room 1', numbers: ['1', '2', '3', '4', '5', '6', '7'] }],
    });
    const section = screen.getByRole('region', { name: 'Next' });
    expect(within(section).getAllByRole('listitem')).toHaveLength(3);
    expect(within(section).getByText('+4 more')).toBeInTheDocument();
  });

  it('shows at most 3 doctors or rooms under "Next", and counts the rest', () => {
    const group = (n: number) => ({ label: `Dr. ${n} · Room ${n}`, numbers: [`A-${n}`] });
    renderTv({ next: [1, 2, 3, 4, 5].map(group) });
    const section = screen.getByRole('region', { name: 'Next' });
    expect(within(section).getAllByRole('heading', { level: 3 })).toHaveLength(3);
    expect(within(section).getByText('+2 more')).toBeInTheDocument();
  });

  it('works without a name: the number alone is enough', () => {
    renderTv({ nowServing: { number: 'A-024', room: 'Room 2' } });
    expect(screen.getByText('A-024')).toBeInTheDocument();
    expect(screen.queryByText('Juan D.')).not.toBeInTheDocument();
  });

  it('says "No one waiting" when the queue is empty', () => {
    renderTv({ nowServing: null, otherCalls: [], next: [] });
    expect(screen.getByText('No one waiting')).toBeInTheDocument();
  });

  it('shows the footer note and that the display is live, in words and not only by colour', () => {
    renderTv();
    expect(screen.getByText('Please have your queue number ready.')).toBeInTheDocument();
    expect(screen.getByText('Updated 2:45 PM')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('numbers use tabular figures so the layout does not jitter', () => {
    renderTv();
    expect(screen.getByText('A-024').className).toContain('tabular-nums');
  });

  describe('connection lost', () => {
    it('keeps the last data and says so calmly, with the time of the last update', () => {
      renderTv({ status: 'reconnecting', lastUpdated: '2:41 PM' });
      expect(screen.getByText('Reconnecting… last updated 2:41 PM')).toBeInTheDocument();
      expect(screen.getByText('A-024')).toBeInTheDocument();
      expect(screen.queryByText('Live')).not.toBeInTheDocument();
    });

    it('after 2 minutes dims "Now serving" and asks people to check with reception, so old data is not mistaken for current', () => {
      renderTv({ status: 'stale', lastUpdated: '2:41 PM' });
      expect(screen.getByRole('region', { name: 'Now serving' })).toHaveAttribute(
        'data-stale',
        'true',
      );
      expect(screen.getByText('Please check with reception.')).toBeInTheDocument();
    });
  });

  it('marks a new call so it can be highlighted for a few seconds', () => {
    renderTv({ highlight: true });
    expect(screen.getByRole('region', { name: 'Now serving' })).toHaveAttribute(
      'data-highlight',
      'true',
    );
    renderTv({ highlight: false });
  });

  describe('unattended: nothing to touch', () => {
    it('has no buttons, links, inputs or focusable elements', () => {
      const { container } = renderTv();
      expect(
        container.querySelectorAll('button, a, input, select, textarea, [tabindex]'),
      ).toHaveLength(0);
    });

    it('hides the mouse cursor and cannot be selected', () => {
      const { container } = renderTv();
      expect(container.firstElementChild?.className).toContain('cursor-none');
      expect(container.firstElementChild?.className).toContain('select-none');
    });
  });

  describe('privacy (Data Privacy Act): the display can only be given display-safe data', () => {
    it('has no field for a full name, a reason for the visit, or a priority category', () => {
      // Compile-time checks only: never called.
      type Call = NonNullable<TvDisplayProps['nowServing']>;
      const asCall = (call: Call): Call => call;
      const typeChecks = (): void => {
        // @ts-expect-error no full name field exists
        asCall({ number: 'A-1', room: 'R', fullName: 'Juan Dela Cruz' });
        // @ts-expect-error no priority field exists: the TV never learns a priority category
        asCall({ number: 'A-1', room: 'R', priority: true });
        // @ts-expect-error no reason for the visit
        asCall({ number: 'A-1', room: 'R', reason: 'Checkup' });
        // @ts-expect-error no birth date
        asCall({ number: 'A-1', room: 'R', birthDate: '1980-01-01' });
      };
      expect(typeChecks).toBeTypeOf('function');
    });

    it('priority tickets look exactly like any other ticket (same number series, no label, no icon)', () => {
      const { container } = renderTv({ nowServing: { number: 'A-024', room: 'Room 2' } });
      const text = container.textContent;
      for (const word of ['PWD', 'Senior', 'Priority', 'Pregnant'])
        expect(text).not.toContain(word);
    });
  });

  describe('themes', () => {
    it('has a light theme (default) and a dark one', () => {
      const light = renderTv();
      expect(light.container.firstElementChild?.className).toContain('bg-tv-bg');
      light.unmount();
      const dark = renderTv({ theme: 'dark' });
      expect(dark.container.firstElementChild?.className).toContain('bg-tv-dark-bg');
    });
  });

  it('has no accessibility violations (every state and both themes)', async () => {
    const variants: Partial<TvDisplayProps>[] = [
      {},
      { theme: 'dark' },
      { nowServing: null, otherCalls: [], next: [] },
      { status: 'reconnecting', lastUpdated: '2:41 PM' },
      { status: 'stale', lastUpdated: '2:41 PM' },
      { highlight: true },
    ];
    for (const variant of variants) {
      const { container, unmount } = renderTv(variant);
      expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
      unmount();
    }
  });
});
