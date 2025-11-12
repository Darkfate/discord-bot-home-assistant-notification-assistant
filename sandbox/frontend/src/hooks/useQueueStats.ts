import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export function useQueueStats(refetchInterval: number = 10000) {
  return useQuery({
    queryKey: ['queueStats'],
    queryFn: () => apiClient.getQueueStats(),
    refetchInterval,
    staleTime: 5000,
  });
}

export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.healthCheck(),
    refetchInterval: 30000,
    retry: 3,
  });
}
