import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { TvDisplay, type TvDisplayProps } from './tv-display.tsx';
import { TvPairingScreen } from './tv-pairing.tsx';

// Mock data uses obviously fake names. The display can only be given display-safe fields.
const meta: Meta = {
  title: 'TV display',
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'tv1080' },
    docs: { story: { inline: false, iframeHeight: 600 } },
  },
};
export default meta;
type Story = StoryObj;

const BASE: TvDisplayProps = {
  clinicName: 'Sunrise Clinic',
  branchName: 'Main branch',
  time: '2:45 PM',
  status: 'live',
  lastUpdated: '2:45 PM',
  nowServing: { number: 'A-024', shortName: 'Juan D.', room: 'Room 2', doctor: 'Dr. Lim' },
  otherCalls: [
    { number: 'A-023', room: 'Room 1' },
    { number: 'B-010', room: 'Room 3' },
  ],
  next: [
    { label: 'Dr. Reyes · Room 1', numbers: ['A-025', 'A-027', 'A-030'] },
    { label: 'Dr. Lim · Room 2', numbers: ['B-011', 'B-012'] },
    { label: 'Dr. Cruz · Room 3', numbers: ['C-004'] },
  ],
};
const show = (props: Partial<TvDisplayProps> = {}): Story => ({
  render: () => <TvDisplay {...BASE} {...props} />,
});

export const Normal: Story = show();
export const NumberOnly: Story = show({ nowServing: { number: 'A-024', room: 'Room 2' } });
export const ManyQueues: Story = show({
  next: [
    {
      label: 'Dr. Reyes · Room 1',
      numbers: ['A-025', 'A-027', 'A-030', 'A-031', 'A-033', 'A-036', 'A-040'],
    },
    { label: 'Dr. Lim · Room 2', numbers: ['B-011', 'B-012', 'B-014', 'B-015', 'B-016'] },
    { label: 'Dr. Cruz · Room 3', numbers: ['C-004', 'C-006'] },
    { label: 'Dr. Tan · Room 4', numbers: ['D-001'] },
  ],
});
export const EmptyQueue: Story = show({ nowServing: null, otherCalls: [], next: [] });
export const NewCallHighlight: Story = show({ highlight: true });
export const Reconnecting: Story = show({ status: 'reconnecting', lastUpdated: '2:41 PM' });
export const OfflineOverTwoMinutes: Story = show({ status: 'stale', lastUpdated: '2:41 PM' });
export const DarkTheme: Story = show({ theme: 'dark' });
export const DarkThemeNewCall: Story = show({ theme: 'dark', highlight: true });
export const Pairing: Story = { render: () => <TvPairingScreen code="4F7-K2Q" /> };
export const PairingWithSoundStep: Story = {
  render: function Render() {
    const [enabled, setEnabled] = useState(false);
    return (
      <TvPairingScreen
        code="4F7-K2Q"
        {...(enabled
          ? {}
          : {
              onEnableSound: () => {
                setEnabled(true);
              },
            })}
      />
    );
  },
};
