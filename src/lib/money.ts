// Money is whole centavos inside the app and a decimal string ("500.00") on the API
// (docs/api-conventions.md "Money"). It is converted only here, and never through a float.

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function assertCentavos(centavos: number): void {
  if (!Number.isSafeInteger(centavos)) throw new RangeError('Amounts are whole centavos.');
}

export function formatPeso({ centavos }: { centavos: number }): string {
  assertCentavos(centavos);
  return PESO.format(centavos / 100);
}

/** `"500.00"` → 50000. The API always answers with two decimals; anything else is refused. */
export function centavosFromApi(amount: string): number {
  if (!/^\d+\.\d{2}$/.test(amount)) throw new RangeError('Expected an amount such as "500.00".');
  const centavos = Number(amount.replace('.', ''));
  assertCentavos(centavos);
  return centavos;
}

/** 50000 → `"500.00"`, for a request. There are no negative prices. */
export function centavosToApi(centavos: number): string {
  assertCentavos(centavos);
  if (centavos < 0) throw new RangeError('Amounts are not negative.');
  const digits = String(centavos).padStart(3, '0');
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
