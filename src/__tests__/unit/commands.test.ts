import { jest } from '@jest/globals';
import { CommandHandler } from '../../commands.js';
import { Client, ChatInputCommandInteraction, InteractionResponse } from 'discord.js';
import { Database } from '../../database.js';
import { PersistentNotificationQueue } from '../../queue/persistentQueue.js';

describe('CommandHandler', () => {
  let commandHandler: CommandHandler;
  let mockClient: jest.Mocked<Client>;
  let mockDatabase: jest.Mocked<Database>;
  let mockQueue: jest.Mocked<PersistentNotificationQueue>;
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;

  beforeEach(() => {
    // @ts-ignore - Mock setup for testing
    mockClient = {
      application: {
        commands: {
          set: jest.fn<any>().mockResolvedValue([]),
        },
      },
    } as any;

    // @ts-ignore - Mock setup for testing
    mockDatabase = {
      getNotificationHistory: jest.fn<any>(),
      getScheduledNotifications: jest.fn<any>().mockResolvedValue([]),
      getFailedNotifications: jest.fn<any>().mockResolvedValue([]),
      getQueueStats: jest.fn<any>().mockResolvedValue({
        pending: 0,
        processing: 0,
        scheduled: 0,
        failed: 0,
        sent24h: 0,
      }),
      getNotificationById: jest.fn<any>(),
      cancelNotification: jest.fn<any>(),
      retryFailedNotification: jest.fn<any>(),
    } as any;

    // @ts-ignore - Mock setup for testing
    mockQueue = {
      getQueueSize: jest.fn<any>().mockReturnValue(0),
      enqueue: jest.fn<any>().mockResolvedValue(1),
      getStats: jest.fn<any>().mockResolvedValue({
        pending: 0,
        processing: 0,
        scheduled: 0,
        failed: 0,
        sent24h: 0,
      }),
      cancel: jest.fn<any>().mockResolvedValue(true),
      retry: jest.fn<any>().mockResolvedValue(true),
    } as any;

    // @ts-ignore - Mock setup for testing
    mockInteraction = {
      isCommand: jest.fn<any>().mockReturnValue(true),
      commandName: '',
      reply: jest.fn<any>().mockResolvedValue({} as InteractionResponse),
      editReply: jest.fn<any>().mockResolvedValue({} as InteractionResponse),
      deferReply: jest.fn<any>().mockResolvedValue({} as InteractionResponse),
      options: {
        getInteger: jest.fn<any>(),
        getString: jest.fn<any>(),
      },
      replied: false,
      deferred: false,
    } as any;

    commandHandler = new CommandHandler(mockClient, mockDatabase, mockQueue);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerGlobalCommands', () => {
    it('should register commands with Discord', async () => {
      await commandHandler.registerGlobalCommands();

      expect(mockClient.application?.commands.set).toHaveBeenCalled();
      const commandData = (mockClient.application?.commands.set as jest.Mock).mock
        .calls[0][0];
      expect(commandData).toHaveLength(10); // ping, status, history, test, schedule, scheduled, cancel, retry, failed, queue-stats
    });
  });

  describe('handleInteraction - ping command', () => {
    it('should respond with Pong!', async () => {
      mockInteraction.commandName = 'ping';

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.reply).toHaveBeenCalledWith('Pong! 🏓');
    });
  });

  describe('handleInteraction - status command', () => {
    it('should show bot status with uptime and queue statistics', async () => {
      mockInteraction.commandName = 'status';
      mockQueue.getStats.mockResolvedValue({
        pending: 5,
        processing: 1,
        scheduled: 3,
        failed: 2,
        sent24h: 42,
      });

      // Mock process.uptime to return a known value
      jest.spyOn(process, 'uptime').mockReturnValue(3665); // 1 hour, 1 minute, 5 seconds

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockQueue.getStats).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        })
      );
    });
  });

  describe('handleInteraction - history command', () => {
    it('should show recent notifications', async () => {
      mockInteraction.commandName = 'history';
      (mockInteraction.options.getInteger as any).mockReturnValue(null);
      (mockInteraction.options.getString as any).mockReturnValue(null);

      const mockHistory = [
        {
          id: 1,
          source: 'Home Assistant',
          title: 'Door Alert',
          message: 'Front door opened',
          createdAt: new Date('2024-01-01T12:00:00Z'),
          scheduledFor: new Date('2024-01-01T12:00:00Z'),
          status: 'sent',
          severity: 'info',
          retryCount: 0,
          maxRetries: 3,
        },
        {
          id: 2,
          source: 'Server',
          message: 'Backup completed',
          createdAt: new Date('2024-01-01T11:00:00Z'),
          scheduledFor: new Date('2024-01-01T11:00:00Z'),
          status: 'sent',
          severity: 'info',
          retryCount: 0,
          maxRetries: 3,
        },
      ];
      mockDatabase.getNotificationHistory.mockResolvedValue(mockHistory as any);

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockDatabase.getNotificationHistory).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should respect custom limit', async () => {
      mockInteraction.commandName = 'history';
      (mockInteraction.options.getInteger as any).mockReturnValue(5);
      (mockInteraction.options.getString as any).mockReturnValue(null);
      (mockDatabase.getNotificationHistory as any).mockResolvedValue([]);

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockDatabase.getNotificationHistory).toHaveBeenCalledWith(5, undefined);
    });

    it('should show message when no notifications found', async () => {
      mockInteraction.commandName = 'history';
      (mockInteraction.options.getInteger as any).mockReturnValue(null);
      (mockInteraction.options.getString as any).mockReturnValue(null);
      (mockDatabase.getNotificationHistory as any).mockResolvedValue([]);

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.editReply).toHaveBeenCalledWith('No notifications found.');
    });
  });

  describe('handleInteraction - test command', () => {
    it('should send test notification', async () => {
      mockInteraction.commandName = 'test';
      mockQueue.enqueue.mockResolvedValue(42);

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        source: 'Test',
        title: 'Test Notification',
        message: 'This is a test notification from the bot!',
        severity: 'info',
      });
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        'Test notification queued! (ID: 42)'
      );
    });
  });

  describe('handleInteraction - schedule command', () => {
    it('should schedule a notification', async () => {
      mockInteraction.commandName = 'schedule';
      (mockInteraction.options.getString as any).mockImplementation((name: string) => {
        const values: Record<string, string> = {
          time: '2h',
          source: 'Test',
          message: 'Scheduled message',
          severity: 'info',
        };
        return values[name] || null;
      });
      mockQueue.enqueue.mockResolvedValue(50);

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockQueue.enqueue).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('Notification scheduled')
      );
    });
  });

  describe('handleInteraction - scheduled command', () => {
    it('should list scheduled notifications', async () => {
      mockInteraction.commandName = 'scheduled';
      (mockInteraction.options.getInteger as any).mockReturnValue(null);

      const mockScheduled = [
        {
          id: 1,
          source: 'Test',
          message: 'Future notification',
          createdAt: new Date(),
          scheduledFor: new Date(Date.now() + 3600000),
          status: 'pending',
          severity: 'info',
          retryCount: 0,
          maxRetries: 3,
        },
      ];
      mockDatabase.getScheduledNotifications.mockResolvedValue(mockScheduled as any);

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockDatabase.getScheduledNotifications).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });

  describe('handleInteraction - cancel command', () => {
    it('should cancel a notification', async () => {
      mockInteraction.commandName = 'cancel';
      (mockInteraction.options.getInteger as any).mockReturnValue(1);
      mockQueue.cancel.mockResolvedValue(true);

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockQueue.cancel).toHaveBeenCalledWith(1);
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        'Notification 1 has been cancelled.'
      );
    });
  });

  describe('handleInteraction - retry command', () => {
    it('should retry a failed notification', async () => {
      mockInteraction.commandName = 'retry';
      (mockInteraction.options.getInteger as any).mockReturnValue(1);
      mockQueue.retry.mockResolvedValue(true);

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockQueue.retry).toHaveBeenCalledWith(1);
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        'Retrying notification 1...'
      );
    });
  });

  describe('handleInteraction - failed command', () => {
    it('should list failed notifications', async () => {
      mockInteraction.commandName = 'failed';
      (mockInteraction.options.getInteger as any).mockReturnValue(null);

      const mockFailed = [
        {
          id: 1,
          source: 'Test',
          message: 'Failed notification',
          retryCount: 3,
          lastError: 'Connection error',
        },
      ];
      mockDatabase.getFailedNotifications.mockResolvedValue(mockFailed);

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockDatabase.getFailedNotifications).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });

  describe('handleInteraction - queue-stats command', () => {
    it('should show queue statistics', async () => {
      mockInteraction.commandName = 'queue-stats';
      mockQueue.getStats.mockResolvedValue({
        pending: 2,
        processing: 1,
        scheduled: 3,
        failed: 1,
        sent24h: 50,
      });

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockQueue.getStats).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        })
      );
    });
  });

  describe('handleInteraction - error handling', () => {
    it('should handle command execution errors', async () => {
      mockInteraction.commandName = 'history';
      (mockDatabase.getNotificationHistory as any).mockRejectedValue(
        new Error('Database error')
      );

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'There was an error executing this command!',
        flags: 1 << 6,
      });
    });

    it('should handle errors after defer', async () => {
      mockInteraction.commandName = 'test';
      mockInteraction.deferred = true;
      (mockQueue.enqueue as any).mockRejectedValue(new Error('Queue error'));

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: 'There was an error executing this command!',
        flags: 1 << 6,
      });
    });

    it('should ignore non-command interactions', async () => {
      (mockInteraction.isCommand as any).mockReturnValue(false);

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.reply).not.toHaveBeenCalled();
    });

    it('should ignore unknown commands', async () => {
      mockInteraction.commandName = 'unknown';

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.reply).not.toHaveBeenCalled();
    });
  });
});
