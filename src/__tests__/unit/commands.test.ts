import { jest } from '@jest/globals';
import { CommandHandler } from '../../commands.js';
import { Client, ChatInputCommandInteraction, InteractionResponse } from 'discord.js';
import { Database } from '../../database.js';
import { NotificationQueue } from '../../queue.js';

describe('CommandHandler', () => {
  let commandHandler: CommandHandler;
  let mockClient: jest.Mocked<Client>;
  let mockDatabase: jest.Mocked<Database>;
  let mockQueue: jest.Mocked<NotificationQueue>;
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;

  beforeEach(() => {
    // @ts-ignore - Mock setup for testing
    mockClient = {
      application: {
        commands: {
          set: jest.fn().mockResolvedValue([]),
        },
      },
    } as any;

    // @ts-ignore - Mock setup for testing
    mockDatabase = {
      getNotificationHistory: jest.fn(),
    } as any;

    // @ts-ignore - Mock setup for testing
    mockQueue = {
      getQueueSize: jest.fn().mockReturnValue(0),
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as any;

    // @ts-ignore - Mock setup for testing
    mockInteraction = {
      isCommand: jest.fn().mockReturnValue(true),
      commandName: '',
      reply: jest.fn().mockResolvedValue({} as InteractionResponse),
      editReply: jest.fn().mockResolvedValue({} as InteractionResponse),
      deferReply: jest.fn().mockResolvedValue({} as InteractionResponse),
      options: {
        getInteger: jest.fn(),
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
      expect(commandData).toHaveLength(4); // ping, status, history, test
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
    it('should show bot status with uptime and queue size', async () => {
      mockInteraction.commandName = 'status';
      mockQueue.getQueueSize.mockReturnValue(5);

      // Mock process.uptime to return a known value
      jest.spyOn(process, 'uptime').mockReturnValue(3665); // 1 hour, 1 minute, 5 seconds

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.stringContaining('Bot Status:')
      );
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.stringContaining('Uptime: 1h 1m')
      );
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.stringContaining('Queue Size: 5')
      );
    });
  });

  describe('handleInteraction - history command', () => {
    it('should show recent notifications', async () => {
      mockInteraction.commandName = 'history';
      (mockInteraction.options.getInteger as any).mockReturnValue(null);

      const mockHistory = [
        {
          id: 1,
          source: 'Home Assistant',
          title: 'Door Alert',
          message: 'Front door opened',
          timestamp: '2024-01-01 12:00:00',
        },
        {
          id: 2,
          source: 'Server',
          message: 'Backup completed',
          timestamp: '2024-01-01 11:00:00',
        },
      ];
      mockDatabase.getNotificationHistory.mockResolvedValue(mockHistory);

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockDatabase.getNotificationHistory).toHaveBeenCalledWith(10);
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Recent Notifications'),
          flags: 1 << 6, // Ephemeral
        })
      );
    });

    it('should respect custom limit', async () => {
      mockInteraction.commandName = 'history';
      (mockInteraction.options.getInteger as any).mockReturnValue(5);
      (mockDatabase.getNotificationHistory as any).mockResolvedValue([]);

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockDatabase.getNotificationHistory).toHaveBeenCalledWith(5);
    });

    it('should show message when no notifications found', async () => {
      mockInteraction.commandName = 'history';
      (mockInteraction.options.getInteger as any).mockReturnValue(null);
      (mockDatabase.getNotificationHistory as any).mockResolvedValue([]);

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.reply).toHaveBeenCalledWith('No notifications found.');
    });

    it('should format notifications with and without titles', async () => {
      mockInteraction.commandName = 'history';
      (mockInteraction.options.getInteger as any).mockReturnValue(null);

      const mockHistory = [
        {
          id: 1,
          source: 'Source1',
          title: 'Title1',
          message: 'Message1',
          timestamp: '2024-01-01 12:00:00',
        },
        {
          id: 2,
          source: 'Source2',
          message: 'Message2',
          timestamp: '2024-01-01 11:00:00',
        },
      ];
      (mockDatabase.getNotificationHistory as any).mockResolvedValue(mockHistory);

      await commandHandler.handleInteraction(mockInteraction as any);

      const replyContent: string = ((mockInteraction.reply as any).mock.calls[0][0] as any)
        .content;
      expect(replyContent).toContain('Source1');
      expect(replyContent).toContain('Title1');
      expect(replyContent).toContain('Message1');
      expect(replyContent).toContain('Source2');
      expect(replyContent).toContain('Message2');
    });
  });

  describe('handleInteraction - test command', () => {
    it('should send test notification', async () => {
      mockInteraction.commandName = 'test';

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        source: 'Test',
        title: 'Test Notification',
        message: 'This is a test notification from the bot!',
        severity: 'info',
      });
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        'Test notification queued! ✅'
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

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'There was an error executing this command!',
          flags: 1 << 6,
        })
      );
    });

    it('should handle errors after reply', async () => {
      mockInteraction.commandName = 'test';
      mockInteraction.replied = true;
      (mockQueue.enqueue as any).mockRejectedValue(new Error('Queue error'));

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'There was an error executing this command!',
          flags: 1 << 6,
        })
      );
    });

    it('should handle errors after defer', async () => {
      mockInteraction.commandName = 'test';
      mockInteraction.deferred = true;
      (mockQueue.enqueue as any).mockRejectedValue(new Error('Queue error'));

      await commandHandler.handleInteraction(mockInteraction as any);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'There was an error executing this command!',
        })
      );
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
