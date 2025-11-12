import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type {
  Notification,
  NotificationCreateRequest,
  NotificationQueryParams,
} from '../types/api';

// Get single notification
export function useNotification(id: number | null) {
  return useQuery({
    queryKey: ['notification', id],
    queryFn: () => (id ? apiClient.getNotification(id) : null),
    enabled: id !== null,
  });
}

// Get notifications list
export function useNotificationsList(params?: NotificationQueryParams) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => apiClient.getNotifications(params),
    staleTime: 10000, // 10 seconds
  });
}

// Create notification mutation
export function useCreateNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      data,
      signature,
    }: {
      data: NotificationCreateRequest;
      signature?: string;
    }) => apiClient.createNotification(data, signature),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['queueStats'] });
    },
  });
}

// Cancel notification mutation
export function useCancelNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => apiClient.cancelNotification(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['notification', id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['queueStats'] });
    },
  });
}

// Retry notification mutation
export function useRetryNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => apiClient.retryNotification(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['notification', id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['queueStats'] });
    },
  });
}
