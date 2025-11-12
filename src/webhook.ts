import express, { Request, Response } from 'express';
import { NotificationQueue } from './queue.js';
import crypto from 'crypto';

export class WebhookServer {
  private app: express.Application;
  private queue: NotificationQueue;
  private webhookSecret: string;

  constructor(queue: NotificationQueue, webhookSecret: string) {
    this.app = express();
    this.queue = queue;
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

    // Webhook endpoint for notifications
    this.app.post('/webhook/notify', (req: Request, res: Response) => {
      // Verify webhook secret if provided
      if (this.webhookSecret) {
        const signature = req.headers['x-webhook-signature'] as string;
        if (!signature || !this.verifySignature(req.body, signature)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }

      try {
        const { source, title, message, severity } = req.body;

        if (!source || !message) {
          return res.status(400).json({
            error: 'Missing required fields: source and message',
          });
        }

        // Add to queue
        this.queue.enqueue({
          source,
          title,
          message,
          severity: severity || 'info',
        });

        res.status(202).json({
          status: 'queued',
          queueSize: this.queue.getQueueSize(),
        });
      } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Endpoint to send direct message (for testing)
    this.app.post('/webhook/message', (req: Request, res: Response) => {
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

        this.queue.enqueue({
          source,
          message,
          severity: 'info',
        });

        res.status(202).json({ status: 'queued' });
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
