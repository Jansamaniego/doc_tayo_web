import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createChimePlayer } from './chime.ts';

interface FakeOscillator {
  frequency: { value: number };
  type: string;
  startedAt?: number;
  stoppedAt?: number;
  start: (at: number) => void;
  stop: (at: number) => void;
  connect: () => void;
}

let oscillators: FakeOscillator[];
let resumed: number;

class FakeAudioContext {
  currentTime = 10;
  state = 'suspended';
  destination = {};
  createOscillator(): FakeOscillator {
    const oscillator: FakeOscillator = {
      frequency: { value: 0 },
      type: '',
      start: (at) => {
        oscillator.startedAt = at;
      },
      stop: (at) => {
        oscillator.stoppedAt = at;
      },
      connect: vi.fn(),
    };
    oscillators.push(oscillator);
    return oscillator;
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
  }
  resume(): Promise<void> {
    resumed += 1;
    this.state = 'running';
    return Promise.resolve();
  }
}

beforeEach(() => {
  oscillators = [];
  resumed = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chime (optional sound when the queue moves)', () => {
  it('is a soft two-tone sound that lasts at most one second', () => {
    createChimePlayer().play('call-1');
    expect(oscillators).toHaveLength(2);
    expect(new Set(oscillators.map((o) => o.frequency.value)).size).toBe(2);
    const end = Math.max(...oscillators.map((o) => o.stoppedAt ?? 0));
    const start = Math.min(...oscillators.map((o) => o.startedAt ?? Infinity));
    expect(end - start).toBeLessThanOrEqual(1);
  });

  it('plays at most once per call, however often the same call is reported', () => {
    const player = createChimePlayer();
    player.play('call-1');
    player.play('call-1');
    player.play('call-1');
    expect(oscillators).toHaveLength(2);
    player.play('call-2');
    expect(oscillators).toHaveLength(4);
  });

  it('wakes a suspended audio context (browsers start it suspended until a tap)', () => {
    createChimePlayer().play('call-1');
    expect(resumed).toBe(1);
  });

  it('does nothing, and does not throw, where audio is not available', () => {
    vi.unstubAllGlobals();
    expect(() => {
      createChimePlayer().play('call-1');
    }).not.toThrow();
  });

  it('can be switched off', () => {
    const player = createChimePlayer({ enabled: false });
    player.play('call-1');
    expect(oscillators).toHaveLength(0);
  });
});
