import { useLingui } from '@lingui/react/macro';

import { Button } from '@/design-system/components/button.tsx';

export interface TvPairingScreenProps {
  /** For example "4F7-K2Q". An admin enters it in Settings > Displays; staff never sign in on the TV. */
  code: string;
  /** Shown once if sound is on and the browser still blocks audio until a tap. */
  onEnableSound?: () => void;
}

/** What a display shows before an admin pairs it (backend dependency D-20). */
export function TvPairingScreen({ code, onEnableSound }: TvPairingScreenProps) {
  const { t } = useLingui();
  return (
    <div className="flex h-screen w-screen cursor-none select-none flex-col items-center justify-center gap-[4vh] bg-tv-bg px-[4vw] text-center text-tv-text">
      <h1 className="text-tv-name font-bold">{t`Connect this display`}</h1>
      <p className="text-tv-entry">{t`Enter this code in DocTayo → Settings → Displays:`}</p>
      <p className="text-tv-number font-bold tabular-nums tracking-wider">{code}</p>
      {onEnableSound && (
        <div className="cursor-auto">
          <Button size="lg" onClick={onEnableSound}>
            {t`Tap to enable sound`}
          </Button>
        </div>
      )}
    </div>
  );
}
