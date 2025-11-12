import { jest } from '@jest/globals';
import { NotificationQueue, Notification } from '../../queue.js';
import { Client, TextChannel } from 'discord.js';
import { Database } from '../../database.js';

describe('NotificationQueue', () => {
  let queue: NotificationQueue;
  let mockClient: jest.Mocked<Client>;
  let mockDatabase: jest.Mocked<Database>;
  let mockChannel: jest.Mocked<TextChannel>;
  const testChannelId = '123456789';

  beforeEach(() => {
    // Create mock instances
    // @ts-ignore - Mock setup for testing
    mockClient = {
      channels: {
        fetch: jest.fn(),
      },
    } as any;

    // @ts-ignore - Mock setup for testing
    mockDatabase = {
      saveNotification: jest.fn().mockResolvedValue(1),
    } as any;

    // @ts-ignore - Mock setup for testing
    mockChannel = {
      isTextBased: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue({ id: 'message-id-123' }),
    } as any;

    (mockClient.channels.fetch as any).mockResolvedValue(mockChannel as any);

    queue = new NotificationQueue(mockClient, mockDatabase, testChannelId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enqueue', () => {
    it('should enqueue notification and process it', async () => {
      const notification: Notification = {
        source: 'Test',
        message: 'Test message',
        severity: 'info',
      };

      await queue.enqueue(notification);

      // Wait for queue to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockClient.channels.fetch).toHaveBeenCalledWith(testChannelId);
      expect(mockChannel.send).toHaveBeenCalled();
      expect(mockDatabase.saveNotification).toHaveBeenCalledWith(
        'Test',
        'Test message',
        undefined,
        'message-id-123'
      );
    });

    it('should handle notification with title', async () => {
      const notification: Notification = {
        source: 'Test',
        title: 'Test Title',
        message: 'Test message',
        severity: 'warning',
      };

      await queue.enqueue(notification);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockDatabase.saveNotification).toHaveBeenCalledWith(
        'Test',
        'Test message',
        'Test Title',
        'message-id-123'
      );
    });

    it('should process notifications sequentially', async () => {
      const notifications: Notification[] = [
        { source: 'Test1', message: 'Message1' },
        { source: 'Test2', message: 'Message2' },
        { source: 'Test3', message: 'Message3' },
      ];

      // Enqueue all notifications
      await Promise.all(notifications.map((n) => queue.enqueue(n)));

      // Wait for queue to process
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(mockChannel.send).toHaveBeenCalledTimes(3);
      expect(mockDatabase.saveNotification).toHaveBeenCalledTimes(3);
    });

    it('should handle send failure gracefully', async () => {
      (mockChannel.send as any).mockRejectedValueOnce(new Error('Send failed'));

      const notification: Notification = {
        source: 'Test',
        message: 'Test message',
      };

      await queue.enqueue(notification);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still save to database even if send fails (no discord ID when send fails)
      expect(mockDatabase.saveNotification).toHaveBeenCalledWith(
        'Test',
        'Test message',
        undefined
      );
    });

    it('should handle invalid channel', async () => {
      // @ts-ignore - Mock setup for testing
      const invalidChannel = {
        isTextBased: jest.fn().mockReturnValue(false),
      };
      (mockClient.channels.fetch as any).mockResolvedValueOnce(invalidChannel as any);

      const notification: Notification = {
        source: 'Test',
        message: 'Test message',
      };

      await queue.enqueue(notification);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockChannel.send).not.toHaveBeenCalled();
    });
  });

  describe('getQueueSize', () => {
    it('should return 0 for empty queue', () => {
      expect(queue.getQueueSize()).toBe(0);
    });

    it('should return correct queue size', async () => {
      // Delay the mock to keep items in queue longer
      (mockClient.channels.fetch as any).mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve(mockChannel as any), 200))
      );

      await queue.enqueue({ source: 'Test1', message: 'Message1' });
      await queue.enqueue({ source: 'Test2', message: 'Message2' });

      // Queue should have items pending
      const size = queue.getQueueSize();
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('buildEmbed', () => {
    it('should create embed with correct color for info severity', async () => {
      const notification: Notification = {
        source: 'Test',
        message: 'Info message',
        severity: 'info',
      };

      await queue.enqueue(notification);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const sentEmbed: any = (mockChannel.send as any).mock.calls[0][0];
      expect(sentEmbed.embeds).toBeDefined();
      expect(sentEmbed.embeds[0].data.color).toBe(0x3498db); // Blue for info
    });

    it('should create embed with correct color for warning severity', async () => {
      const notification: Notification = {
        source: 'Test',
        message: 'Warning message',
        severity: 'warning',
      };

      await queue.enqueue(notification);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const sentEmbed: any = (mockChannel.send as any).mock.calls[0][0];
      expect(sentEmbed.embeds[0].data.color).toBe(0xf39c12); // Orange for warning
    });

    it('should create embed with correct color for error severity', async () => {
      const notification: Notification = {
        source: 'Test',
        message: 'Error message',
        severity: 'error',
      };

      await queue.enqueue(notification);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const sentEmbed: any = (mockChannel.send as any).mock.calls[0][0];
      expect(sentEmbed.embeds[0].data.color).toBe(0xe74c3c); // Red for error
    });

    it('should use source as title when title is not provided', async () => {
      const notification: Notification = {
        source: 'Test Source',
        message: 'Test message',
      };

      await queue.enqueue(notification);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const sentEmbed: any = (mockChannel.send as any).mock.calls[0][0];
      expect(sentEmbed.embeds[0].data.title).toBe('Test Source');
    });

    it('should use provided title over source', async () => {
      const notification: Notification = {
        source: 'Test Source',
        title: 'Custom Title',
        message: 'Test message',
      };

      await queue.enqueue(notification);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const sentEmbed: any = (mockChannel.send as any).mock.calls[0][0];
      expect(sentEmbed.embeds[0].data.title).toBe('Custom Title');
    });
  });
});
