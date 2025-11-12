import {
  Client,
  Collection,
  Interaction,
  SlashCommandBuilder,
  CommandInteraction,
} from 'discord.js';
import { Database } from './database.js';
import { NotificationQueue } from './queue.js';

interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

export class CommandHandler {
  private commands: Collection<string, Command>;
  private client: Client;
  private database: Database;
  private queue: NotificationQueue;

  constructor(
    client: Client,
    database: Database,
    queue: NotificationQueue
  ) {
    this.commands = new Collection();
    this.client = client;
    this.database = database;
    this.queue = queue;

    this.registerCommands();
  }

  private registerCommands(): void {
    // Ping command
    this.commands.set('ping', {
      data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Responds with pong!'),
      execute: async (interaction: CommandInteraction) => {
        await interaction.reply('Pong! 🏓');
      },
    });

    // Status command
    this.commands.set('status', {
      data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Get bot status'),
      execute: async (interaction: CommandInteraction) => {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        await interaction.reply(
          `Bot Status:\n- Uptime: ${hours}h ${minutes}m\n- Queue Size: ${this.queue.getQueueSize()}`
        );
      },
    });

    // History command
    this.commands.set('history', {
      data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('Show recent notifications')
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('Number of notifications to show')
            .setMinValue(1)
            .setMaxValue(20)
        ),
      execute: async (interaction: CommandInteraction) => {
        const limit = interaction.options.getInteger('limit') || 10;
        const history = await this.database.getNotificationHistory(limit);

        if (history.length === 0) {
          await interaction.reply('No notifications found.');
          return;
        }

        const historyText = history
          .map(
            (n) =>
              `**${n.source}** - ${n.timestamp}\n${n.title ? `_${n.title}_\n` : ''}${n.message}`
          )
          .join('\n\n');

        await interaction.reply({
          content: `**Recent Notifications (${history.length}):**\n\n${historyText}`,
          flags: 1 << 6, // Ephemeral
        });
      },
    });

    // Test notification command
    this.commands.set('test', {
      data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Send a test notification'),
      execute: async (interaction: CommandInteraction) => {
        await interaction.deferReply();
        await this.queue.enqueue({
          source: 'Test',
          title: 'Test Notification',
          message: 'This is a test notification from the bot!',
          severity: 'info',
        });
        await interaction.editReply('Test notification queued! ✅');
      },
    });
  }

  async handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isCommand()) return;

    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction as CommandInteraction);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);
      const reply = {
        content: 'There was an error executing this command!',
        flags: 1 << 6, // Ephemeral
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  }

  async registerGlobalCommands(): Promise<void> {
    try {
      const commandData = this.commands.map((cmd) => cmd.data.toJSON());
      await this.client.application?.commands.set(commandData);
      console.log(`Registered ${commandData.length} global commands`);
    } catch (error) {
      console.error('Failed to register commands:', error);
    }
  }
}
