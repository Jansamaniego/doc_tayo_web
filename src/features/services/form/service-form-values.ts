import { t } from '@lingui/core/macro';

import { centavosFromApi, centavosToApi } from '@/lib/money.ts';

import type { NewService, Service, ServiceChanges } from '../api/services.ts';

/** A fixed amount, no charge, or no fixed price (the desk quotes it). */
export type PriceKind = 'fixed' | 'free' | 'none';

/** The form as filled in. The names are the API's, so its field problems land on their fields. */
export interface ServiceValues {
  name: string;
  description: string;
  /** Minutes, as typed. */
  defaultDurationMinutes: string;
  priceKind: PriceKind;
  /** Whole centavos of a fixed price; null while empty or not an amount. */
  price: number | null;
}

export const EMPTY_SERVICE: ServiceValues = {
  name: '',
  description: '',
  defaultDurationMinutes: '30',
  priceKind: 'none',
  price: null,
};

const MAX_NAME = 120;
const MAX_DESCRIPTION = 500;
const MIN_MINUTES = 5;
const MAX_MINUTES = 480;
/** The API's column holds `numeric(12,2)`; the contract does not say so (backend request D-34). */
const MAX_PRICE_CENTAVOS = 999_999_999_999;

export interface ServiceProblem {
  name: 'name' | 'description' | 'defaultDurationMinutes' | 'price';
  message: string;
}

/** Everything that would make the API refuse the form, in the order of the fields. */
export function checkService(values: ServiceValues): ServiceProblem[] {
  const problems: ServiceProblem[] = [];
  const add = (name: ServiceProblem['name'], message: string): void => {
    problems.push({ name, message });
  };
  const name = values.name.trim();
  if (name === '') add('name', t`Enter the service name.`);
  else if (name.length > MAX_NAME) add('name', t`Use at most 120 characters.`);
  if (values.description.trim().length > MAX_DESCRIPTION) {
    add('description', t`Use at most 500 characters.`);
  }
  const typed = values.defaultDurationMinutes.trim();
  const minutes = Number(typed);
  if (!/^\d+$/.test(typed) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
    add('defaultDurationMinutes', t`Enter a whole number of minutes from 5 to 480.`);
  }
  if (values.priceKind === 'fixed') {
    if (values.price === null) add('price', t`Enter an amount, for example 1,250.50.`);
    else if (values.price === 0) add('price', t`Choose Free for a service without charge.`);
    else if (values.price > MAX_PRICE_CENTAVOS) add('price', t`Enter at most ₱9,999,999,999.99.`);
  }
  return problems;
}

function toPrice({ priceKind, price }: ServiceValues): string | null {
  if (priceKind === 'free') return centavosToApi(0);
  return priceKind === 'fixed' && price !== null ? centavosToApi(price) : null;
}

/** What adding a service sends, from values that passed `checkService`. */
export function toNewService(values: ServiceValues): NewService {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    defaultDurationMinutes: Number(values.defaultDurationMinutes.trim()),
    price: toPrice(values),
  };
}

export function toFormValues(service: Service): ServiceValues {
  const centavos = service.price === null ? null : centavosFromApi(service.price);
  const priceKind = centavos === null ? 'none' : centavos === 0 ? 'free' : 'fixed';
  return {
    name: service.name,
    description: service.description ?? '',
    defaultDurationMinutes: String(service.defaultDurationMinutes),
    priceKind,
    price: priceKind === 'fixed' ? centavos : null,
  };
}

/** What an edit sends: only what would differ in the API; a cleared field is `null`. */
export function toChanges({
  base,
  values,
}: {
  base: ServiceValues;
  values: ServiceValues;
}): ServiceChanges {
  const before = toNewService(base);
  return Object.fromEntries(
    Object.entries(toNewService(values)).filter(
      ([key, value]) => value !== before[key as keyof NewService],
    ),
  );
}
