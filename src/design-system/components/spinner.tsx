import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/cn.ts';

/** Decorative: the surrounding element always carries the words ("Saving…", "Loading…"). */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden="true" className={cn('size-5 animate-spin', className)} />;
}
