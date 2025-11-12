import axios, { AxiosInstance } from 'axios';
import type {
  Notification,
  NotificationCreateRequest,
  NotificationCreateResponse,
  QueueStats,
  NotificationListResponse,
  NotificationQueryParams,
  CancelNotificationResponse,
  RetryNotificationResponse,
  HealthResponse,
} from '../types/api';

class APIClient {
  private client: AxiosInstance;

  constructor(baseURL: string = '') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Create notification
  async createNotification(
    data: NotificationCreateRequest,
    signature?: string
  ): Promise<NotificationCreateResponse> {
    const headers = signature ? { 'X-Webhook-Signature': signature } : {};
    const response = await this.client.post<NotificationCreateResponse>(
      '/webhook/notify',
      data,
      { headers }
    );
    return response.data;
  }

  // Get notification by ID
  async getNotification(id: number): Promise<Notification> {
    const response = await this.client.get<Notification>(`/webhook/notify/${id}`);
    return response.data;
  }

  // Cancel notification
  async cancelNotification(id: number): Promise<CancelNotificationResponse> {
    const response = await this.client.delete<CancelNotificationResponse>(
      `/webhook/notify/${id}`
    );
    return response.data;
  }

  // Retry notification
  async retryNotification(id: number): Promise<RetryNotificationResponse> {
    const response = await this.client.post<RetryNotificationResponse>(
      `/webhook/notify/${id}/retry`
    );
    return response.data;
  }

  // Get queue stats
  async getQueueStats(): Promise<QueueStats> {
    const response = await this.client.get<QueueStats>('/webhook/stats');
    return response.data;
  }

  // Get notifications list with filters
  async getNotifications(params?: NotificationQueryParams): Promise<NotificationListResponse> {
    const response = await this.client.get<NotificationListResponse>(
      '/webhook/notifications',
      { params }
    );
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>('/health');
    return response.data;
  }
}

export const apiClient = new APIClient();
