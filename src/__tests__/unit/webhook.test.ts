import { jest } from '@jest/globals';
import { WebhookServer } from '../../webhook.js';
import { PersistentNotificationQueue } from '../../queue/persistentQueue.js';
import { Database } from '../../database.js';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';

describe('WebhookServer', () => {
  let webhookServer: WebhookServer;
  let mockQueue: jest.Mocked<PersistentNotificationQueue>;
  let mockDatabase: jest.Mocked<Database>;
  let app: express.Application;

  beforeEach(() => {
    // @ts-ignore - Mock setup for testing
    mockQueue = {
      enqueue: jest.fn<any>().mockResolvedValue(1),
      getQueueSize: jest.fn<any>().mockReturnValue(0),
      cancel: jest.fn<any>().mockResolvedValue(true),
      retry: jest.fn<any>().mockResolvedValue(true),
    } as any;

    // @ts-ignore - Mock setup for testing
    mockDatabase = {
      getNotificationById: jest.fn<any>().mockResolvedValue({
        id: 1,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        scheduledFor: new Date('2024-01-01T00:00:00Z'),
        sentAt: new Date('2024-01-01T00:01:00Z'),
        source: 'Test',
        title: 'Test Title',
        message: 'Test message',
        severity: 'info',
        discordMessageId: 'discord-123',
        status: 'sent',
        retryCount: 0,
        maxRetries: 3,
        lastError: null,
        metadata: null,
      }),
    } as any;

    webhookServer = new WebhookServer(mockQueue, mockDatabase, '');
    // Access the private app property for testing
    app = (webhookServer as any).app;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('POST /webhook/notify', () => {
    it('should accept valid notification', async () => {
      mockQueue.getQueueSize.mockReturnValue(1);
      mockQueue.enqueue.mockResolvedValue(42);

      const response = await request(app)
        .post('/webhook/notify')
        .send({
          source: 'Test',
          message: 'Test message',
        });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        status: 'queued',
        notification_id: 42,
        queue_size: 1,
      });
      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        source: 'Test',
        title: undefined,
        message: 'Test message',
        severity: 'info',
        scheduledFor: undefined,
      });
    });

    it('should accept notification with all fields', async () => {
      mockQueue.enqueue.mockResolvedValue(43);

      const response = await request(app)
        .post('/webhook/notify')
        .send({
          source: 'Home Assistant',
          title: 'Door Alert',
          message: 'Front door opened',
          severity: 'warning',
        });

      expect(response.status).toBe(202);
      expect(response.body.notification_id).toBe(43);
      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        source: 'Home Assistant',
        title: 'Door Alert',
        message: 'Front door opened',
        severity: 'warning',
        scheduledFor: undefined,
      });
    });

    it('should accept notification with scheduled_for', async () => {
      mockQueue.enqueue.mockResolvedValue(44);

      const response = await request(app)
        .post('/webhook/notify')
        .send({
          source: 'Test',
          message: 'Scheduled message',
          scheduled_for: '5m',
        });

      expect(response.status).toBe(202);
      expect(response.body.notification_id).toBe(44);
      expect(response.body.scheduled_for).toBeDefined();
      expect(response.body.scheduled_in).toBeDefined();
      expect(mockQueue.enqueue).toHaveBeenCalled();
    });

    it('should reject notification with invalid scheduled_for format', async () => {
      const response = await request(app)
        .post('/webhook/notify')
        .send({
          source: 'Test',
          message: 'Test message',
          scheduled_for: 'invalid-format',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid scheduled_for format');
      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should reject notification without source', async () => {
      const response = await request(app)
        .post('/webhook/notify')
        .send({
          message: 'Test message',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required fields: source and message',
      });
      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should reject notification without message', async () => {
      const response = await request(app)
        .post('/webhook/notify')
        .send({
          source: 'Test',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required fields: source and message',
      });
      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should default severity to info if not provided', async () => {
      await request(app)
        .post('/webhook/notify')
        .send({
          source: 'Test',
          message: 'Test message',
        });

      expect(mockQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'info',
        })
      );
    });
  });

  describe('GET /webhook/notify/:id', () => {
    it('should return notification by id', async () => {
      const response = await request(app).get('/webhook/notify/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        source: 'Test',
        title: 'Test Title',
        message: 'Test message',
        severity: 'info',
        status: 'sent',
        created_at: '2024-01-01T00:00:00.000Z',
        scheduled_for: '2024-01-01T00:00:00.000Z',
        sent_at: '2024-01-01T00:01:00.000Z',
        retry_count: 0,
        max_retries: 3,
        last_error: null,
        discord_message_id: 'discord-123',
      });
    });

    it('should return 404 if notification not found', async () => {
      mockDatabase.getNotificationById.mockResolvedValue(null);

      const response = await request(app).get('/webhook/notify/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Notification not found' });
    });

    it('should return 400 for invalid notification id', async () => {
      const response = await request(app).get('/webhook/notify/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid notification ID' });
    });
  });

  describe('DELETE /webhook/notify/:id', () => {
    it('should cancel notification', async () => {
      mockQueue.cancel.mockResolvedValue(true);

      const response = await request(app).delete('/webhook/notify/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'cancelled',
        notification_id: 1,
      });
      expect(mockQueue.cancel).toHaveBeenCalledWith(1);
    });

    it('should return 404 if notification cannot be cancelled', async () => {
      mockQueue.cancel.mockResolvedValue(false);

      const response = await request(app).delete('/webhook/notify/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Notification not found or already processed',
      });
    });

    it('should return 400 for invalid notification id', async () => {
      const response = await request(app).delete('/webhook/notify/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid notification ID' });
    });
  });

  describe('POST /webhook/notify/:id/retry', () => {
    it('should retry failed notification', async () => {
      mockQueue.retry.mockResolvedValue(true);

      const response = await request(app).post('/webhook/notify/1/retry');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'retrying',
        notification_id: 1,
      });
      expect(mockQueue.retry).toHaveBeenCalledWith(1);
    });

    it('should return 404 if notification cannot be retried', async () => {
      mockQueue.retry.mockResolvedValue(false);

      const response = await request(app).post('/webhook/notify/999/retry');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Notification not found or not in failed state',
      });
    });

    it('should return 400 for invalid notification id', async () => {
      const response = await request(app).post('/webhook/notify/invalid/retry');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid notification ID' });
    });
  });

  describe('POST /webhook/notify with signature verification', () => {
    let webhookServerWithSecret: WebhookServer;
    let appWithSecret: express.Application;
    const secret = 'test-secret-key';

    beforeEach(() => {
      webhookServerWithSecret = new WebhookServer(mockQueue, mockDatabase, secret);
      appWithSecret = (webhookServerWithSecret as any).app;
    });

    function generateSignature(body: any, secret: string): string {
      return crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');
    }

    it('should accept request with valid signature', async () => {
      const body = {
        source: 'Test',
        message: 'Test message',
      };
      const signature = generateSignature(body, secret);

      const response = await request(appWithSecret)
        .post('/webhook/notify')
        .set('x-webhook-signature', signature)
        .send(body);

      expect(response.status).toBe(202);
      expect(mockQueue.enqueue).toHaveBeenCalled();
    });

    it('should reject request with invalid signature', async () => {
      const body = {
        source: 'Test',
        message: 'Test message',
      };

      const response = await request(appWithSecret)
        .post('/webhook/notify')
        .set('x-webhook-signature', 'invalid-signature')
        .send(body);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should reject request without signature', async () => {
      const body = {
        source: 'Test',
        message: 'Test message',
      };

      const response = await request(appWithSecret)
        .post('/webhook/notify')
        .send(body);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('POST /webhook/message', () => {
    it('should accept valid message', async () => {
      mockQueue.enqueue.mockResolvedValue(50);

      const response = await request(app)
        .post('/webhook/message')
        .send({
          source: 'Test',
          message: 'Test message',
        });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        status: 'queued',
        notification_id: 50,
      });
      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        source: 'Test',
        message: 'Test message',
        severity: 'info',
      });
    });

    it('should reject message without source', async () => {
      const response = await request(app)
        .post('/webhook/message')
        .send({
          message: 'Test message',
        });

      expect(response.status).toBe(400);
      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should reject message without message field', async () => {
      const response = await request(app)
        .post('/webhook/message')
        .send({
          source: 'Test',
        });

      expect(response.status).toBe(400);
      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Not found' });
    });

    it('should return 404 for unknown POST routes', async () => {
      const response = await request(app)
        .post('/unknown-route')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Not found' });
    });
  });
});
