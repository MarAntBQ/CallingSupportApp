'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicConfig } from '@/lib/validation/config';

export const CONFIG_QUERY_KEY = ['config', 'public'] as const;

async function fetchConfig(): Promise<PublicConfig> {
  const response = await fetch('/api/config', { cache: 'no-store' });
  if (!response.ok) throw new Error(`config ${response.status}`);
  return response.json();
}

export function useConfig() {
  return useQuery({ queryKey: CONFIG_QUERY_KEY, queryFn: fetchConfig });
}

export function useSetConfig() {
  const queryClient = useQueryClient();
  return (config: PublicConfig) => {
    queryClient.setQueryData(CONFIG_QUERY_KEY, config);
    return queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
  };
}
