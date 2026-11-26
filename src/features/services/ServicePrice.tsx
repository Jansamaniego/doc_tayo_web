import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';

import { centavosFromApi, formatPeso } from '@/lib/money.ts';

/**
 * What the desk quotes: an amount, "Free" (`"0.00"`) or "Price at the desk" (`null`, no fixed price).
 * Information only: the app takes no payments. A screen reader hears an amount as words, since "₱" is
 * not read reliably.
 */
export function ServicePrice({ price }: { price: string | null }) {
  const { t } = useLingui();
  if (price === null) return t`Price at the desk`;
  const centavos = centavosFromApi(price);
  if (centavos === 0) return t`Free`;
  const pesos = Math.floor(centavos / 100);
  const rest = centavos % 100;
  const pesoText = plural(pesos, { one: '# peso', other: '# pesos' });
  const centavoText = plural(rest, { one: '# centavo', other: '# centavos' });
  return (
    <span className="whitespace-nowrap">
      <span aria-hidden="true">{formatPeso({ centavos })}</span>
      <span className="sr-only">{rest === 0 ? pesoText : t`${pesoText} and ${centavoText}`}</span>
    </span>
  );
}
