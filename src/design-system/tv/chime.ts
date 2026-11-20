// An optional, soft two-tone sound when the queue moves: at most 1 second, at most once per call,
// no voice. Browsers keep audio suspended until a tap, so the pairing screen ends with "Tap to enable
// sound" (plans/02-design-system.md §10.4).

function tone(context: AudioContext, frequency: number, start: number, duration: number): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.25, start + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

export function createChimePlayer({ enabled = true }: { enabled?: boolean } = {}) {
  let context: AudioContext | undefined;
  const played = new Set<string>();
  return {
    /** Plays once per `callId`, however often the same call is reported. */
    play(callId: string): void {
      if (!enabled || played.has(callId) || typeof AudioContext === 'undefined') return;
      played.add(callId);
      context ??= new AudioContext();
      if (context.state === 'suspended') void context.resume();
      const now = context.currentTime;
      tone(context, 660, now, 0.45); // 0.00 - 0.45 s
      tone(context, 880, now + 0.4, 0.5); // 0.40 - 0.90 s
    },
  };
}
