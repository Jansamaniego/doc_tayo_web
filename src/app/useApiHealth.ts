import { useQuery } from '@tanstack/react-query';

import { getApiClient } from '@/api/client.ts';

/** GET /api/health: used by the placeholder home page and the e2e smoke test. */
export function useApiHealth() {
  return useQuery({
    queryKey: ['api', 'health'],
    queryFn: async () => {
      await getApiClient().GET('/api/health');
      return 'reachable' as const; // TanStack Query does not accept an undefined result
    },
    retry: false,
  });
}
