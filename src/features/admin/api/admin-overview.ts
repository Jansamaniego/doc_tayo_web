import { useQuery } from '@tanstack/react-query';

import { getApiClient } from '@/api/client.ts';

/** Whether the API can reach its database (`GET /api/health/ready`); a 503 means it cannot. */
export function useServiceReady() {
  return useQuery({
    queryKey: ['admin', 'service-ready'],
    retry: false,
    queryFn: async () => {
      await getApiClient().GET('/api/health/ready');
      return true;
    },
  });
}
