import { useLingui } from '@lingui/react/macro';

import { cn } from '@/lib/cn.ts';

export interface StepperProps {
  steps: string[];
  /** Zero-based index of the current step. */
  current: number;
}

/** For multi-step forms (rare): where you are is written in words, never shown by colour alone. */
export function Stepper({ steps, current }: StepperProps) {
  const { t } = useLingui();
  const position = current + 1;
  const total = steps.length;
  const name = steps[current] ?? '';
  return (
    <div className="flex flex-col gap-3">
      <p className="text-h3 font-bold">{t`Step ${position} of ${total}: ${name}`}</p>
      <ol className="flex flex-wrap gap-x-6 gap-y-2 text-small">
        {steps.map((step, index) => (
          <li
            key={step}
            aria-current={index === current ? 'step' : undefined}
            className={cn('flex gap-2', index === current && 'font-bold')}
          >
            <span>{index + 1}.</span>
            <span>{step}</span>
            <span className="text-ink-muted">
              {index < current ? t`Done` : index === current ? t`Current` : t`Not yet`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
