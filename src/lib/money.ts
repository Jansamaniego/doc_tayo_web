const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

/**
 * Provisional (backend dependency D-12: the API's money format is not decided yet).
 * Takes integer centavos so no amount is ever a floating-point guess.
 */
export function formatPeso({ centavos }: { centavos: number }): string {
  if (!Number.isSafeInteger(centavos)) throw new RangeError('Amounts are whole centavos.');
  return PESO.format(centavos / 100);
}
