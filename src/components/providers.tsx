'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { CONFIG_QUERY_KEY } from '@/lib/config/use-config';
import type { PublicConfig } from '@/lib/validation/config';

export function Providers({ config, children }: { config: PublicConfig; children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } } });
    client.setQueryData(CONFIG_QUERY_KEY, config);
    return client;
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
