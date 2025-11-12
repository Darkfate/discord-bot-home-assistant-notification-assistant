// Shared TypeScript types for API interactions
export interface Notification {
  id: number;
  created_at: string;
  scheduled_for: string;
  sent_at: string | null;
  source: string;
  title: string | null;
  message: string;
  severity: 'info' | 'warning' | 'error';
  discord_message_id: string | null;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  metadata: Record<string, any> | null;
}

export interface NotificationCreateRequest {
  source: string;
  message: string;
  title?: string;
  severity?: 'info' | 'warning' | 'error';
  scheduled_for?: string;
}

export interface NotificationCreateResponse {
  status: 'queued';
  notification_id: number;
  queue_size: number;
  scheduled_for?: string;
  scheduled_in?: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  scheduled: number;
  failed: number;
  sent24h: number;
  health?: 'healthy' | 'degraded' | 'unhealthy';
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
}

export interface NotificationQueryParams {
  status?: string;
  source?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
}

export interface CancelNotificationResponse {
  status: 'cancelled';
  notification_id: number;
}

export interface RetryNotificationResponse {
  status: 'retrying';
  notification_id: number;
}

export interface HealthResponse {
  status: 'ok';
}
