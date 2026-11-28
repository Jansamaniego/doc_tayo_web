import { i18n } from '@lingui/core';

import { messages as en } from './locales/en.po';
import { messages as pseudo } from './locales/pseudo.po';

// English is the launch language. `pseudo` stretches every string so layouts are tested against
// longer text before Filipino arrives (Phase 16, plan.md §5.6.1).
export type Locale = 'en' | 'pseudo';

i18n.load({ en, pseudo });
i18n.activate('en');

export function activateLocale(locale: Locale): void {
  i18n.activate(locale);
}

export { i18n };
