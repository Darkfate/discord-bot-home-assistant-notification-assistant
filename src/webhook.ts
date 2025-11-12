import express, { Request, Response } from 'express';
import { PersistentNotificationQueue } from './queue/persistentQueue.js';
import { Database } from './database.js';
import { parseScheduledTime, formatRelativeTime } from './utils/dateParser.js';
import crypto from 'crypto';

export class WebhookServer {
  private app: express.Application;
  private queue: PersistentNotificationQueue;
  private database: Database;
  private webhookSecret: string;

  constructor(queue: PersistentNotificationQueue, database: Database, webhookSecret: string) {
    this.app = express();
    this.queue = queue;
    this.database = database;
    this.webhookSecret = webhookSecret;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ status: 'ok' });
    });

    // Webhook endpoint for notifications (with scheduling support)
    this.app.post('/webhook/notify', async (req: Request, res: Response) => {
      // Verify webhook secret if provided
      if (this.webhookSecret) {
        const signature = req.headers['x-webhook-signature'] as string;
        if (!signature || !this.verifySignature(req.body, signature)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }

      try {
        const { source, title, message, severity, scheduled_for } = req.body;

        if (!source || !message) {
          return res.status(400).json({
            error: 'Missing required fields: source and message',
          });
        }

        // Parse scheduled_for if provided
        let scheduledFor: Date | undefined;
        if (scheduled_for) {
          try {
            scheduledFor = parseScheduledTime(scheduled_for);
          } catch (error) {
            return res.status(400).json({
              error: `Invalid scheduled_for format: ${error instanceof Error ? error.message : 'unknown error'}`,
            });
          }
        }

        // Add to queue
        const notificationId = await this.queue.enqueue({
          source,
          title,
          message,
          severity: severity || 'info',
          scheduledFor,
        });

        const responseData: any = {
          status: 'queued',
          notification_id: notificationId,
          queue_size: this.queue.getQueueSize(),
        };

        if (scheduledFor) {
          responseData.scheduled_for = scheduledFor.toISOString();
          responseData.scheduled_in = formatRelativeTime(scheduledFor);
        }

        res.status(202).json(responseData);
      } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get notification status by ID
    this.app.get('/webhook/notify/:id', async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);

        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid notification ID' });
        }

        const notification = await this.database.getNotificationById(id);

        if (!notification) {
          return res.status(404).json({ error: 'Notification not found' });
        }

        res.status(200).json({
          id: notification.id,
          source: notification.source,
          title: notification.title,
          message: notification.message,
          severity: notification.severity,
          status: notification.status,
          created_at: notification.createdAt.toISOString(),
          scheduled_for: notification.scheduledFor.toISOString(),
          sent_at: notification.sentAt?.toISOString(),
          retry_count: notification.retryCount,
          max_retries: notification.maxRetries,
          last_error: notification.lastError,
          discord_message_id: notification.discordMessageId,
        });
      } catch (error) {
        console.error('Error fetching notification:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Cancel a notification
    this.app.delete('/webhook/notify/:id', async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);

        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid notification ID' });
        }

        const cancelled = await this.queue.cancel(id);

        if (!cancelled) {
          return res.status(404).json({
            error: 'Notification not found or already processed',
          });
        }

        res.status(200).json({
          status: 'cancelled',
          notification_id: id,
        });
      } catch (error) {
        console.error('Error cancelling notification:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Retry a failed notification
    this.app.post('/webhook/notify/:id/retry', async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);

        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid notification ID' });
        }

        const retried = await this.queue.retry(id);

        if (!retried) {
          return res.status(404).json({
            error: 'Notification not found or not in failed state',
          });
        }

        res.status(200).json({
          status: 'retrying',
          notification_id: id,
        });
      } catch (error) {
        console.error('Error retrying notification:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Endpoint to send direct message (for testing - kept for backward compatibility)
    this.app.post('/webhook/message', async (req: Request, res: Response) => {
      if (this.webhookSecret) {
        const signature = req.headers['x-webhook-signature'] as string;
        if (!signature || !this.verifySignature(req.body, signature)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }

      try {
        const { source, message } = req.body;

        if (!source || !message) {
          return res.status(400).json({
            error: 'Missing required fields: source and message',
          });
        }

        const notificationId = await this.queue.enqueue({
          source,
          message,
          severity: 'info',
        });

        res.status(202).json({
          status: 'queued',
          notification_id: notificationId,
        });
      } catch (error) {
        console.error('Message webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  private verifySignature(body: any, signature: string): boolean {
    const hash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');

    return hash === signature;
  }

  start(port: number): void {
    this.app.listen(port, () => {
      console.log(`Webhook server running on port ${port}`);
    });
  }
}
