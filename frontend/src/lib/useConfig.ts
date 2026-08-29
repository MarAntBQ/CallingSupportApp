import { useQuery } from '@tanstack/react-query';
import api from './axios';

export interface ConfigPublica {
  permitirRegistro: boolean;
  nombreUnidad: string;
}

export const useConfig = () =>
  useQuery({
    queryKey: ['config', 'public'],
    queryFn: async () => (await api.get<ConfigPublica>('/config')).data,
  });
