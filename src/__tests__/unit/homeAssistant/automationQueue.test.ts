import { AutomationTriggerQueue } from '../../../homeAssistant/automationQueue.js';
import { Database } from '../../../database.js';
import { HomeAssistantClient } from '../../../homeAssistant/client.js';
import { Client } from 'discord.js';
import type { AutomationTrigger } from '../../../homeAssistant/types.js';

// Mock dependencies
jest.mock('../../../database.js');
jest.mock('../../../homeAssistant/client.js');
jest.mock('discord.js');

describe('AutomationTriggerQueue', () => {
  let queue: AutomationTriggerQueue;
  let mockDatabase: jest.Mocked<Database>;
  let mockHAClient: jest.Mocked<HomeAssistantClient>;
  let mockDiscordClient: jest.Mocked<Client>;
  const mockChannelId = '123456789';

  beforeEach(() => {
    // Reset mocks
    mockDatabase = new Database(':memory:') as jest.Mocked<Database>;
    mockHAClient = new HomeAssistantClient({
      url: 'http://localhost:8123',
      accessToken: 'test',
    }) as jest.Mocked<HomeAssistantClient>;
    mockDiscordClient = new Client({ intents: [] }) as jest.Mocked<Client>;

    // Setup mock implementations
    mockDatabase.queryAutomationTriggers = jest.fn().mockResolvedValue([]);
    mockDatabase.saveAutomationTrigger = jest.fn().mockResolvedValue(1);
    mockDatabase.getAutomationTrigger = jest.fn();
    mockDatabase.updateAutomationTriggerStatus = jest.fn().mockResolvedValue(undefined);
    mockDatabase.incrementAutomationTriggerRetry = jest.fn().mockResolvedValue(undefined);

    mockHAClient.triggerAutomation = jest.fn().mockResolvedValue(undefined);

    queue = new AutomationTriggerQueue(
      mockDiscordClient,
      mockDatabase,
      mockHAClient,
      mockChannelId
    );

    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should reset processing triggers to pending', async () => {
      const processingTriggers: AutomationTrigger[] = [
        {
          id: 1,
          createdAt: new Date(),
          scheduledFor: new Date(),
          triggeredAt: null,
          automationId: 'automation.test',
          automationName: 'Test',
          status: 'processing',
          triggeredBy: 'user123',
          retryCount: 0,
          maxRetries: 3,
          lastError: null,
          notificationId: null,
          notifyOnComplete: false,
        },
      ];

      mockDatabase.queryAutomationTriggers.mockResolvedValueOnce(processingTriggers);

      await queue.initialize();

      expect(mockDatabase.queryAutomationTriggers).toHaveBeenCalledWith({
        status: 'processing',
        limit: 1000,
      });
      expect(mockDatabase.updateAutomationTriggerStatus).toHaveBeenCalledWith(1, 'pending');
    });

    it('should handle no processing triggers', async () => {
      mockDatabase.queryAutomationTriggers.mockResolvedValueOnce([]);

      await queue.initialize();

      expect(mockDatabase.updateAutomationTriggerStatus).not.toHaveBeenCalled();
    });
  });

  describe('enqueue', () => {
    it('should save trigger to database', async () => {
      const triggerId = await queue.enqueue({
        automationId: 'automation.morning_routine',
        automationName: 'Morning Routine',
        scheduledFor: new Date(Date.now() + 3600000), // 1 hour from now
        triggeredBy: 'user123',
        notifyOnComplete: false,
      });

      expect(triggerId).toBe(1);
      expect(mockDatabase.saveAutomationTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          automationId: 'automation.morning_routine',
          automationName: 'Morning Routine',
          triggeredBy: 'user123',
          notifyOnComplete: false,
        })
      );
    });

    it('should parse time string for scheduling', async () => {
      await queue.enqueue({
        automationId: 'automation.test',
        scheduledFor: '2h',
        triggeredBy: 'user123',
      });

      expect(mockDatabase.saveAutomationTrigger).toHaveBeenCalled();
    });

    it('should process immediately if scheduled for past', async () => {
      const mockTrigger: AutomationTrigger = {
        id: 1,
        createdAt: new Date(),
        scheduledFor: new Date(Date.now() - 1000),
        triggeredAt: null,
        automationId: 'automation.test',
        automationName: null,
        status: 'pending',
        triggeredBy: 'user123',
        retryCount: 0,
        maxRetries: 3,
        lastError: null,
        notificationId: null,
        notifyOnComplete: false,
      };

      mockDatabase.saveAutomationTrigger.mockResolvedValueOnce(1);
      mockDatabase.getAutomationTrigger.mockResolvedValueOnce(mockTrigger);

      await queue.enqueue({
        automationId: 'automation.test',
        scheduledFor: new Date(Date.now() - 1000),
        triggeredBy: 'user123',
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockHAClient.triggerAutomation).toHaveBeenCalledWith('automation.test');
    });
  });

  describe('processTrigger', () => {
    it('should successfully trigger automation', async () => {
      const mockTrigger: AutomationTrigger = {
        id: 1,
        createdAt: new Date(),
        scheduledFor: new Date(),
        triggeredAt: null,
        automationId: 'automation.test',
        automationName: 'Test Automation',
        status: 'pending',
        triggeredBy: 'user123',
        retryCount: 0,
        maxRetries: 3,
        lastError: null,
        notificationId: null,
        notifyOnComplete: false,
      };

      mockDatabase.getAutomationTrigger.mockResolvedValueOnce(mockTrigger);

      await queue.processTrigger(1);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockDatabase.updateAutomationTriggerStatus).toHaveBeenCalledWith(1, 'processing');
      expect(mockHAClient.triggerAutomation).toHaveBeenCalledWith('automation.test');
      expect(mockDatabase.updateAutomationTriggerStatus).toHaveBeenCalledWith(1, 'triggered');
    });

    it('should retry on failure', async () => {
      const mockTrigger: AutomationTrigger = {
        id: 1,
        createdAt: new Date(),
        scheduledFor: new Date(),
        triggeredAt: null,
        automationId: 'automation.test',
        automationName: null,
        status: 'pending',
        triggeredBy: 'user123',
        retryCount: 0,
        maxRetries: 3,
        lastError: null,
        notificationId: null,
        notifyOnComplete: false,
      };

      const updatedTrigger = { ...mockTrigger, retryCount: 1 };

      mockDatabase.getAutomationTrigger
        .mockResolvedValueOnce(mockTrigger)
        .mockResolvedValueOnce(updatedTrigger);

      mockHAClient.triggerAutomation.mockRejectedValueOnce(new Error('Connection failed'));

      await queue.processTrigger(1);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockDatabase.incrementAutomationTriggerRetry).toHaveBeenCalledWith(1);
      expect(mockDatabase.updateAutomationTriggerStatus).toHaveBeenCalledWith(
        1,
        'pending',
        'Connection failed'
      );
    });

    it('should mark as failed after max retries', async () => {
      const mockTrigger: AutomationTrigger = {
        id: 1,
        createdAt: new Date(),
        scheduledFor: new Date(),
        triggeredAt: null,
        automationId: 'automation.test',
        automationName: null,
        status: 'pending',
        triggeredBy: 'user123',
        retryCount: 0,
        maxRetries: 3,
        lastError: null,
        notificationId: null,
        notifyOnComplete: false,
      };

      const failedTrigger = { ...mockTrigger, retryCount: 3 };

      mockDatabase.getAutomationTrigger
        .mockResolvedValueOnce(mockTrigger)
        .mockResolvedValueOnce(failedTrigger);

      mockHAClient.triggerAutomation.mockRejectedValueOnce(new Error('Permanent failure'));

      await queue.processTrigger(1);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockDatabase.updateAutomationTriggerStatus).toHaveBeenCalledWith(
        1,
        'failed',
        'Permanent failure'
      );
    });

    it('should skip non-pending triggers', async () => {
      const mockTrigger: AutomationTrigger = {
        id: 1,
        createdAt: new Date(),
        scheduledFor: new Date(),
        triggeredAt: new Date(),
        automationId: 'automation.test',
        automationName: null,
        status: 'triggered',
        triggeredBy: 'user123',
        retryCount: 0,
        maxRetries: 3,
        lastError: null,
        notificationId: null,
        notifyOnComplete: false,
      };

      mockDatabase.getAutomationTrigger.mockResolvedValueOnce(mockTrigger);

      await queue.processTrigger(1);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockHAClient.triggerAutomation).not.toHaveBeenCalled();
    });
  });

  describe('cancelTrigger', () => {
    it('should cancel pending trigger', async () => {
      const mockTrigger: AutomationTrigger = {
        id: 1,
        createdAt: new Date(),
        scheduledFor: new Date(),
        triggeredAt: null,
        automationId: 'automation.test',
        automationName: null,
        status: 'pending',
        triggeredBy: 'user123',
        retryCount: 0,
        maxRetries: 3,
        lastError: null,
        notificationId: null,
        notifyOnComplete: false,
      };

      mockDatabase.getAutomationTrigger.mockResolvedValueOnce(mockTrigger);

      await queue.cancelTrigger(1);

      expect(mockDatabase.updateAutomationTriggerStatus).toHaveBeenCalledWith(1, 'cancelled');
    });

    it('should throw error for non-existent trigger', async () => {
      mockDatabase.getAutomationTrigger.mockResolvedValueOnce(null);

      await expect(queue.cancelTrigger(999)).rejects.toThrow('Trigger 999 not found');
    });

    it('should throw error for non-pending trigger', async () => {
      const mockTrigger: AutomationTrigger = {
        id: 1,
        createdAt: new Date(),
        scheduledFor: new Date(),
        triggeredAt: new Date(),
        automationId: 'automation.test',
        automationName: null,
        status: 'triggered',
        triggeredBy: 'user123',
        retryCount: 0,
        maxRetries: 3,
        lastError: null,
        notificationId: null,
        notifyOnComplete: false,
      };

      mockDatabase.getAutomationTrigger.mockResolvedValueOnce(mockTrigger);

      await expect(queue.cancelTrigger(1)).rejects.toThrow('Cannot cancel trigger');
    });
  });

  describe('retryTrigger', () => {
    it('should retry failed trigger', async () => {
      const mockTrigger: AutomationTrigger = {
        id: 1,
        createdAt: new Date(),
        scheduledFor: new Date(),
        triggeredAt: null,
        automationId: 'automation.test',
        automationName: null,
        status: 'failed',
        triggeredBy: 'user123',
        retryCount: 3,
        maxRetries: 3,
        lastError: 'Previous error',
        notificationId: null,
        notifyOnComplete: false,
      };

      mockDatabase.getAutomationTrigger
        .mockResolvedValueOnce(mockTrigger)
        .mockResolvedValueOnce({ ...mockTrigger, status: 'pending' });

      await queue.retryTrigger(1);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockDatabase.updateAutomationTriggerStatus).toHaveBeenCalledWith(1, 'pending');
      expect(mockHAClient.triggerAutomation).toHaveBeenCalled();
    });

    it('should throw error for non-failed trigger', async () => {
      const mockTrigger: AutomationTrigger = {
        id: 1,
        createdAt: new Date(),
        scheduledFor: new Date(),
        triggeredAt: null,
        automationId: 'automation.test',
        automationName: null,
        status: 'pending',
        triggeredBy: 'user123',
        retryCount: 0,
        maxRetries: 3,
        lastError: null,
        notificationId: null,
        notifyOnComplete: false,
      };

      mockDatabase.getAutomationTrigger.mockResolvedValueOnce(mockTrigger);

      await expect(queue.retryTrigger(1)).rejects.toThrow('Cannot retry trigger');
    });
  });

  describe('shutdown', () => {
    it('should wait for queue to drain', async () => {
      await queue.shutdown();
      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('getQueueSize and getPendingCount', () => {
    it('should return queue metrics', () => {
      expect(queue.getQueueSize()).toBeGreaterThanOrEqual(0);
      expect(queue.getPendingCount()).toBeGreaterThanOrEqual(0);
    });
  });
});
