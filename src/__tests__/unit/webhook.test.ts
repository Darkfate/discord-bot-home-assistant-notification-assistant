import { jest } from '@jest/globals';
import { WebhookServer } from '../../webhook.js';
import { NotificationQueue } from '../../queue.js';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';

describe('WebhookServer', () => {
  let webhookServer: WebhookServer;
  let mockQueue: jest.Mocked<NotificationQueue>;
  let app: express.Application;

  beforeEach(() => {
    // @ts-ignore - Mock setup for testing
    mockQueue = {
      enqueue: jest.fn<any>().mockResolvedValue(undefined),
      getQueueSize: jest.fn<any>().mockReturnValue(0),
    } as any;

    webhookServer = new WebhookServer(mockQueue, '');
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

      const response = await request(app)
        .post('/webhook/notify')
        .send({
          source: 'Test',
          message: 'Test message',
        });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        status: 'queued',
        queueSize: 1,
      });
      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        source: 'Test',
        message: 'Test message',
        severity: 'info',
      });
    });

    it('should accept notification with all fields', async () => {
      const response = await request(app)
        .post('/webhook/notify')
        .send({
          source: 'Home Assistant',
          title: 'Door Alert',
          message: 'Front door opened',
          severity: 'warning',
        });

      expect(response.status).toBe(202);
      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        source: 'Home Assistant',
        title: 'Door Alert',
        message: 'Front door opened',
        severity: 'warning',
      });
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

  describe('POST /webhook/notify with signature verification', () => {
    let webhookServerWithSecret: WebhookServer;
    let appWithSecret: express.Application;
    const secret = 'test-secret-key';

    beforeEach(() => {
      webhookServerWithSecret = new WebhookServer(mockQueue, secret);
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
      const response = await request(app)
        .post('/webhook/message')
        .send({
          source: 'Test',
          message: 'Test message',
        });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({ status: 'queued' });
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
