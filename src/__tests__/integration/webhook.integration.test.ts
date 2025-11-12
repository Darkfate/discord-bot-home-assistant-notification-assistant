import { jest } from '@jest/globals';
import { WebhookServer } from '../../webhook.js';
import { NotificationQueue } from '../../queue.js';
import { Database } from '../../database.js';
import { Client, TextChannel } from 'discord.js';
import request from 'supertest';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Webhook Integration Tests', () => {
  let webhookServer: WebhookServer;
  let queue: NotificationQueue;
  let database: Database;
  let mockClient: jest.Mocked<Client>;
  let mockChannel: jest.Mocked<TextChannel>;
  let app: any;
  const testDbPath = path.join(__dirname, 'integration-test.db');
  const testChannelId = '123456789';

  beforeAll(async () => {
    // Set up mock Discord client
    mockClient = {
      channels: {
        fetch: jest.fn<any, any>(),
      },
    } as any;

    mockChannel = {
      isTextBased: jest.fn<any, any>().mockReturnValue(true),
      send: jest.fn<any, any>().mockResolvedValue({ id: 'message-id-123' }),
    } as any;

    (mockClient.channels.fetch as any).mockResolvedValue(mockChannel as any);

    // Set up real database
    database = new Database(testDbPath);
    await database.initialize();

    // Set up real queue with mocked Discord client
    queue = new NotificationQueue(mockClient, database, testChannelId);

    // Set up webhook server
    webhookServer = new WebhookServer(queue, '');
    app = (webhookServer as any).app;
  });

  afterAll(async () => {
    await database.close();
    try {
      await fs.unlink(testDbPath);
    } catch (err) {
      // Ignore error if file doesn't exist
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-end notification flow', () => {
    it('should process notification from webhook to database', async () => {
      const notificationData = {
        source: 'Home Assistant',
        title: 'Door Alert',
        message: 'Front door opened',
        severity: 'warning',
      };

      // Send webhook request
      const response = await request(app)
        .post('/webhook/notify')
        .send(notificationData);

      expect(response.status).toBe(202);

      // Wait for queue to process
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify Discord message was sent
      expect(mockChannel.send).toHaveBeenCalled();
      const sentMessage: any = mockChannel.send.mock.calls[0][0];
      expect(sentMessage.embeds).toBeDefined();
      expect(sentMessage.embeds[0].data.title).toBe('Door Alert');
      expect(sentMessage.embeds[0].data.description).toBe('Front door opened');

      // Verify notification was saved to database
      const history = await database.getNotificationHistory(1);
      expect(history).toHaveLength(1);
      expect(history[0].source).toBe('Home Assistant');
      expect(history[0].title).toBe('Door Alert');
      expect(history[0].message).toBe('Front door opened');
      expect(history[0].discord_message_id).toBe('message-id-123');
    });

    it('should handle multiple notifications in sequence', async () => {
      const notifications = [
        { source: 'Test1', message: 'Message1', severity: 'info' },
        { source: 'Test2', message: 'Message2', severity: 'warning' },
        { source: 'Test3', message: 'Message3', severity: 'error' },
      ];

      // Send all notifications
      for (const notification of notifications) {
        await request(app).post('/webhook/notify').send(notification);
      }

      // Wait for queue to process
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify all messages were sent
      expect(mockChannel.send).toHaveBeenCalledTimes(3);

      // Verify all notifications were saved
      const history = await database.getNotificationHistory(10);
      expect(history.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Webhook signature verification integration', () => {
    let webhookServerWithSecret: WebhookServer;
    let appWithSecret: any;
    const secret = 'integration-test-secret';

    beforeAll(() => {
      webhookServerWithSecret = new WebhookServer(queue, secret);
      appWithSecret = (webhookServerWithSecret as any).app;
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    function generateSignature(body: any, secret: string): string {
      return crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');
    }

    it('should accept and process notification with valid signature', async () => {
      const notificationData = {
        source: 'Secure Source',
        message: 'Secure message',
      };
      const signature = generateSignature(notificationData, secret);

      const response = await request(appWithSecret)
        .post('/webhook/notify')
        .set('x-webhook-signature', signature)
        .send(notificationData);

      expect(response.status).toBe(202);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify it was processed
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should reject notification with tampered data', async () => {
      const originalData = {
        source: 'Original',
        message: 'Original message',
      };
      const signature = generateSignature(originalData, secret);

      // Tamper with the data
      const tamperedData = {
        source: 'Tampered',
        message: 'Tampered message',
      };

      const response = await request(appWithSecret)
        .post('/webhook/notify')
        .set('x-webhook-signature', signature)
        .send(tamperedData);

      expect(response.status).toBe(401);
      expect(mockChannel.send).not.toHaveBeenCalled();
    });
  });

  describe('Error handling integration', () => {
    it('should save notification to database even if Discord send fails', async () => {
      // Mock Discord send to fail
      (mockChannel.send as any).mockRejectedValueOnce(new Error('Discord API error'));

      const notificationData = {
        source: 'Error Test',
        message: 'This should still be saved',
      };

      await request(app).post('/webhook/notify').send(notificationData);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify notification was still saved to database
      const history = await database.getNotificationHistory(10);
      const saved = history.find((n) => n.source === 'Error Test');
      expect(saved).toBeDefined();
      expect(saved?.message).toBe('This should still be saved');
      // Discord message ID should be null since send failed
      expect(saved?.discord_message_id).toBeNull();
    });
  });
});
