import {
  Client,
  Collection,
  Interaction,
  SlashCommandBuilder,
  CommandInteraction,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
} from 'discord.js';
import { Database, NotificationStatus, QueuedNotification } from './database.js';
import { PersistentNotificationQueue } from './queue/persistentQueue.js';
import { formatRelativeTime } from './utils/dateParser.js';
import type { HomeAssistantClient } from './homeAssistant/client.js';
import type { AutomationTriggerQueue } from './homeAssistant/automationQueue.js';

interface Command {
  data: any;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// Discord embed colors
const DISCORD_COLORS = {
  INFO: 0x3498db,
  SUCCESS: 0x2ecc71,
} as const;

// Health monitoring thresholds
const HEALTH_THRESHOLDS = {
  FAILED_WARNING: 5,
  FAILED_CRITICAL: 10,
  QUEUE_DEPTH_WARNING: 100,
} as const;

export class CommandHandler {
  private commands: Collection<string, Command>;
  private client: Client;
  private database: Database;
  private queue: PersistentNotificationQueue;
  private haClient: HomeAssistantClient | null = null;
  private haQueue: AutomationTriggerQueue | null = null;

  constructor(
    client: Client,
    database: Database,
    queue: PersistentNotificationQueue,
    haClient?: HomeAssistantClient,
    haQueue?: AutomationTriggerQueue
  ) {
    this.commands = new Collection();
    this.client = client;
    this.database = database;
    this.queue = queue;
    this.haClient = haClient || null;
    this.haQueue = haQueue || null;

    this.registerCommands();
  }

  /**
   * Format a notification preview with title and truncated message
   */
  private formatNotificationPreview(notification: QueuedNotification, maxLength: number = 100): string {
    const preview = notification.message.substring(0, maxLength);
    const ellipsis = notification.message.length > maxLength ? '...' : '';
    const title = notification.title ? `_${notification.title}_\n` : '';
    return `${title}${preview}${ellipsis}`;
  }

  private registerCommands(): void {
    // Ping command
    this.commands.set('ping', {
      data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Responds with pong!'),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.reply('Pong! 🏓');
      },
    });

    // Enhanced Status command
    this.commands.set('status', {
      data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Get bot and queue status'),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const stats = await this.queue.getStats();

        const scheduled = await this.database.getScheduledNotifications(1);
        const nextScheduled = scheduled.length > 0
          ? `${formatRelativeTime(scheduled[0].scheduledFor)}`
          : 'None';

        const embed = new EmbedBuilder()
          .setColor(DISCORD_COLORS.INFO)
          .setTitle('Bot Status')
          .addFields(
            { name: 'Uptime', value: `${hours}h ${minutes}m`, inline: true },
            { name: 'Queue Size', value: `${this.queue.getQueueSize()}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Pending', value: `${stats.pending}`, inline: true },
            { name: 'Processing', value: `${stats.processing}`, inline: true },
            { name: 'Scheduled', value: `${stats.scheduled}`, inline: true },
            { name: 'Failed', value: `${stats.failed}`, inline: true },
            { name: 'Sent (24h)', value: `${stats.sent24h}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Next Scheduled', value: nextScheduled, inline: false }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      },
    });

    // Enhanced History command
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
        )
        .addStringOption((option) =>
          option
            .setName('status')
            .setDescription('Filter by status')
            .addChoices(
              { name: 'All', value: 'all' },
              { name: 'Pending', value: 'pending' },
              { name: 'Sent', value: 'sent' },
              { name: 'Failed', value: 'failed' },
              { name: 'Cancelled', value: 'cancelled' }
            )
        ),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        const limit = interaction.options.getInteger('limit') || 10;
        const statusFilter = interaction.options.getString('status') || 'all';

        const status = statusFilter === 'all' ? undefined : (statusFilter as NotificationStatus);
        const history = await this.database.getNotificationHistory(limit, status);

        if (history.length === 0) {
          await interaction.editReply('No notifications found.');
          return;
        }

        const historyText = history
          .map((n) => {
            const statusEmoji = this.getStatusEmoji(n.status);
            const dateStr = n.createdAt.toLocaleString();
            return `${statusEmoji} **${n.source}** [ID: ${n.id}] - ${dateStr}\n${this.formatNotificationPreview(n)}`;
          })
          .join('\n\n');

        const filterText = status ? ` (${statusFilter})` : '';
        await interaction.editReply({
          content: `**Recent Notifications${filterText} (${history.length}):**\n\n${historyText}`,
        });
      },
    });

    // Schedule command
    this.commands.set('schedule', {
      data: new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('Schedule a notification for later')
        .addStringOption((option) =>
          option
            .setName('time')
            .setDescription('When to send (e.g., "5m", "2h", "1d")')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('source')
            .setDescription('Notification source')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('Notification message')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('Notification title')
        )
        .addStringOption((option) =>
          option
            .setName('severity')
            .setDescription('Notification severity')
            .addChoices(
              { name: 'Info', value: 'info' },
              { name: 'Warning', value: 'warning' },
              { name: 'Error', value: 'error' }
            )
        ),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        const time = interaction.options.getString('time', true);
        const source = interaction.options.getString('source', true);
        const message = interaction.options.getString('message', true);
        const title = interaction.options.getString('title');
        const severity = interaction.options.getString('severity') as 'info' | 'warning' | 'error' || 'info';

        try {
          const notificationId = await this.queue.enqueue({
            source,
            title: title || undefined,
            message,
            severity,
            scheduledFor: time,
          });

          await interaction.editReply(
            `Notification scheduled! (ID: ${notificationId})\nWill be sent ${formatRelativeTime(new Date(Date.now() + this.parseTimeToMs(time)))}`
          );
        } catch (error) {
          await interaction.editReply(
            `Failed to schedule notification: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      },
    });

    // Scheduled notifications command
    this.commands.set('scheduled', {
      data: new SlashCommandBuilder()
        .setName('scheduled')
        .setDescription('List upcoming scheduled notifications')
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('Number of notifications to show')
            .setMinValue(1)
            .setMaxValue(20)
        ),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        const limit = interaction.options.getInteger('limit') || 10;
        const scheduled = await this.database.getScheduledNotifications(limit);

        if (scheduled.length === 0) {
          await interaction.editReply('No scheduled notifications found.');
          return;
        }

        const scheduledText = scheduled
          .map((n) => {
            const timeStr = formatRelativeTime(n.scheduledFor);
            return `**[ID: ${n.id}]** ${n.source} - ${timeStr}\n${this.formatNotificationPreview(n)}`;
          })
          .join('\n\n');

        await interaction.editReply({
          content: `**Scheduled Notifications (${scheduled.length}):**\n\n${scheduledText}`,
        });
      },
    });

    // Cancel notification command
    this.commands.set('cancel', {
      data: new SlashCommandBuilder()
        .setName('cancel')
        .setDescription('Cancel a pending or scheduled notification')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('Notification ID')
            .setRequired(true)
        ),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        const id = interaction.options.getInteger('id', true);
        const cancelled = await this.queue.cancel(id);

        if (cancelled) {
          await interaction.editReply(`Notification ${id} has been cancelled.`);
        } else {
          await interaction.editReply(
            `Could not cancel notification ${id}. It may not exist or has already been processed.`
          );
        }
      },
    });

    // Retry notification command
    this.commands.set('retry', {
      data: new SlashCommandBuilder()
        .setName('retry')
        .setDescription('Manually retry a failed notification')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('Notification ID')
            .setRequired(true)
        ),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        const id = interaction.options.getInteger('id', true);
        const retried = await this.queue.retry(id);

        if (retried) {
          await interaction.editReply(`Retrying notification ${id}...`);
        } else {
          await interaction.editReply(
            `Could not retry notification ${id}. It may not exist or is not in a failed state.`
          );
        }
      },
    });

    // Failed notifications command
    this.commands.set('failed', {
      data: new SlashCommandBuilder()
        .setName('failed')
        .setDescription('Show failed notifications')
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('Number of notifications to show')
            .setMinValue(1)
            .setMaxValue(20)
        ),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        const limit = interaction.options.getInteger('limit') || 10;
        const failed = await this.database.getFailedNotifications(limit);

        if (failed.length === 0) {
          await interaction.editReply('No failed notifications found.');
          return;
        }

        const failedText = failed
          .map((n) => {
            return `**[ID: ${n.id}]** ${n.source} - Retries: ${n.retryCount}/${n.maxRetries}\n${this.formatNotificationPreview(n, 80)}\nError: ${n.lastError || 'Unknown'}`;
          })
          .join('\n\n');

        await interaction.editReply({
          content: `**Failed Notifications (${failed.length}):**\n\n${failedText}`,
        });
      },
    });

    // Queue stats command
    this.commands.set('queue-stats', {
      data: new SlashCommandBuilder()
        .setName('queue-stats')
        .setDescription('Detailed queue statistics and health'),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        const stats = await this.queue.getStats();
        const totalInQueue = stats.pending + stats.processing + stats.scheduled;

        const embed = new EmbedBuilder()
          .setColor(DISCORD_COLORS.SUCCESS)
          .setTitle('Queue Statistics')
          .setDescription('Detailed statistics about the notification queue')
          .addFields(
            { name: 'Queue Status', value: '\u200B', inline: false },
            { name: 'Pending (Due Now)', value: `${stats.pending}`, inline: true },
            { name: 'Processing', value: `${stats.processing}`, inline: true },
            { name: 'Scheduled (Future)', value: `${stats.scheduled}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: 'Performance', value: '\u200B', inline: false },
            { name: 'Sent (Last 24h)', value: `${stats.sent24h}`, inline: true },
            { name: 'Failed', value: `${stats.failed}`, inline: true },
            { name: 'Total In Queue', value: `${totalInQueue}`, inline: true }
          )
          .setTimestamp();

        // Add health indicator
        let healthStatus = '🟢 Healthy';
        if (stats.failed > HEALTH_THRESHOLDS.FAILED_CRITICAL) {
          healthStatus = '🔴 High Failure Rate';
        } else if (totalInQueue > HEALTH_THRESHOLDS.QUEUE_DEPTH_WARNING) {
          healthStatus = '🟡 High Queue Depth';
        } else if (stats.failed > HEALTH_THRESHOLDS.FAILED_WARNING) {
          healthStatus = '🟡 Some Failures';
        }

        embed.addFields({ name: 'Health Status', value: healthStatus, inline: false });

        await interaction.editReply({ embeds: [embed] });
      },
    });

    // Test notification command
    this.commands.set('test', {
      data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Send a test notification'),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();
        const notificationId = await this.queue.enqueue({
          source: 'Test',
          title: 'Test Notification',
          message: 'This is a test notification from the bot!',
          severity: 'info',
        });
        await interaction.editReply(`Test notification queued! (ID: ${notificationId})`);
      },
    });

    // Remind command
    this.commands.set('remind', {
      data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Set a reminder to be sent later')
        .addStringOption((option) =>
          option
            .setName('time')
            .setDescription('When to remind you (e.g., "5m", "2h", "1d")')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('What to remind you about')
            .setRequired(true)
        ),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        const time = interaction.options.getString('time', true);
        const message = interaction.options.getString('message', true);
        const username = interaction.user.username;

        try {
          const notificationId = await this.queue.enqueue({
            source: 'Reminder',
            title: `Reminder for ${username}`,
            message,
            severity: 'info',
            scheduledFor: time,
          });

          const timeMs = this.parseTimeToMs(time);
          const scheduledDate = new Date(Date.now() + timeMs);

          await interaction.editReply(
            `✅ Reminder set! (ID: ${notificationId})\nI'll remind you ${formatRelativeTime(scheduledDate)}`
          );
        } catch (error) {
          await interaction.editReply(
            `Failed to set reminder: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      },
    });

    // ========================================================================
    // Home Assistant Commands
    // ========================================================================

    // Skip HA commands if not configured
    if (!this.haClient || !this.haQueue) {
      console.log('[Commands] Home Assistant integration not configured, skipping HA commands');
      return;
    }

    // ha-trigger command
    this.commands.set('ha-trigger', {
      data: new SlashCommandBuilder()
        .setName('ha-trigger')
        .setDescription('Trigger a Home Assistant automation')
        .addStringOption((option) =>
          option
            .setName('automation_id')
            .setDescription('Home Assistant automation entity ID')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('time')
            .setDescription('When to trigger (e.g., "5m", "2h", "1d", "now")')
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option
            .setName('notify')
            .setDescription('Send Discord notification on completion')
            .setRequired(false)
        ),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        const automationId = interaction.options.getString('automation_id', true);
        const time = interaction.options.getString('time') || 'now';
        const notify = interaction.options.getBoolean('notify') ?? false;

        try {
          // Get automation details (optional, for friendly name)
          let automationName: string | undefined;
          try {
            const automation = await this.haClient!.getAutomation(automationId);
            automationName = automation?.friendly_name;
          } catch {
            // Ignore - we'll proceed without friendly name
          }

          const triggerId = await this.haQueue!.enqueue({
            automationId,
            automationName,
            scheduledFor: time,
            triggeredBy: interaction.user.id,
            notifyOnComplete: notify,
          });

          const scheduledDate = new Date(Date.now() + this.parseTimeToMs(time));
          const displayName = automationName || automationId;

          await interaction.editReply(
            `✅ Automation trigger scheduled! (ID: ${triggerId})\n` +
              `**Automation:** ${displayName}\n` +
              `**When:** ${time === 'now' ? 'Immediately' : formatRelativeTime(scheduledDate)}\n` +
              `**Notify:** ${notify ? 'Yes' : 'No'}`
          );
        } catch (error) {
          await interaction.editReply(
            `Failed to schedule automation trigger: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      },
    });

    // ha-scheduled command
    this.commands.set('ha-scheduled', {
      data: new SlashCommandBuilder()
        .setName('ha-scheduled')
        .setDescription('List scheduled automation triggers')
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('Number of results to show')
            .setMinValue(1)
            .setMaxValue(20)
        ),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        const limit = interaction.options.getInteger('limit') || 10;

        try {
          const triggers = await this.database.queryAutomationTriggers({
            status: 'pending',
            limit,
            scheduledAfter: new Date(),
          });

          if (triggers.length === 0) {
            await interaction.editReply('No scheduled automation triggers found.');
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(DISCORD_COLORS.INFO)
            .setTitle('📅 Scheduled Automation Triggers')
            .setDescription(`Showing ${triggers.length} scheduled trigger(s)`)
            .setTimestamp();

          for (const trigger of triggers) {
            const displayName = trigger.automationName || trigger.automationId;
            embed.addFields({
              name: `#${trigger.id} - ${displayName}`,
              value:
                `**Automation ID:** ${trigger.automationId}\n` +
                `**Scheduled:** ${formatRelativeTime(trigger.scheduledFor)}\n` +
                `**Triggered By:** <@${trigger.triggeredBy}>`,
            });
          }

          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          await interaction.editReply(
            `Failed to retrieve scheduled triggers: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      },
    });

    // ha-cancel command
    this.commands.set('ha-cancel', {
      data: new SlashCommandBuilder()
        .setName('ha-cancel')
        .setDescription('Cancel a pending automation trigger')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('Trigger ID to cancel')
            .setRequired(true)
        ),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        const id = interaction.options.getInteger('id', true);

        try {
          await this.haQueue!.cancelTrigger(id);
          await interaction.editReply(`✅ Automation trigger #${id} has been cancelled.`);
        } catch (error) {
          await interaction.editReply(
            `Failed to cancel trigger: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      },
    });

    // ha-history command
    this.commands.set('ha-history', {
      data: new SlashCommandBuilder()
        .setName('ha-history')
        .setDescription('View automation trigger history')
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('Number of results to show')
            .setMinValue(1)
            .setMaxValue(50)
        )
        .addStringOption((option) =>
          option
            .setName('status')
            .setDescription('Filter by status')
            .addChoices(
              { name: 'All', value: 'all' },
              { name: 'Pending', value: 'pending' },
              { name: 'Triggered', value: 'triggered' },
              { name: 'Failed', value: 'failed' }
            )
        ),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        const limit = interaction.options.getInteger('limit') || 10;
        const status = interaction.options.getString('status') || 'all';

        try {
          const triggers = await this.database.queryAutomationTriggers({
            status: status as any,
            limit,
          });

          if (triggers.length === 0) {
            await interaction.editReply('No automation triggers found.');
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(DISCORD_COLORS.INFO)
            .setTitle('📜 Automation Trigger History')
            .setDescription(`Showing ${triggers.length} trigger(s)${status !== 'all' ? ` (${status})` : ''}`)
            .setTimestamp();

          for (const trigger of triggers) {
            const displayName = trigger.automationName || trigger.automationId;
            const emoji = this.getStatusEmoji(trigger.status as any);

            let value = `**Status:** ${emoji} ${trigger.status}\n` +
              `**Scheduled:** ${trigger.scheduledFor.toLocaleString()}\n` +
              `**Triggered By:** <@${trigger.triggeredBy}>`;

            if (trigger.triggeredAt) {
              value += `\n**Triggered At:** ${trigger.triggeredAt.toLocaleString()}`;
            }

            if (trigger.lastError) {
              value += `\n**Error:** ${trigger.lastError.substring(0, 100)}`;
            }

            embed.addFields({
              name: `#${trigger.id} - ${displayName}`,
              value,
            });
          }

          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          await interaction.editReply(
            `Failed to retrieve trigger history: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      },
    });

    // ha-test command
    this.commands.set('ha-test', {
      data: new SlashCommandBuilder()
        .setName('ha-test')
        .setDescription('Test Home Assistant connection'),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        try {
          const isConnected = await this.haClient!.validateConnection();

          if (isConnected) {
            // Try to list automations to verify access
            const automations = await this.haClient!.listAutomations(false);

            const embed = new EmbedBuilder()
              .setColor(DISCORD_COLORS.SUCCESS)
              .setTitle('✅ Home Assistant Connection OK')
              .addFields(
                {
                  name: 'Status',
                  value: 'Connected',
                  inline: true,
                },
                {
                  name: 'Automations Found',
                  value: automations.length.toString(),
                  inline: true,
                }
              )
              .setTimestamp()
              .setFooter({ text: 'Home Assistant' });

            await interaction.editReply({ embeds: [embed] });
          } else {
            await interaction.editReply(
              '❌ Failed to connect to Home Assistant. Please check your configuration.'
            );
          }
        } catch (error) {
          await interaction.editReply(
            `❌ Error testing connection: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      },
    });
  }

  private getStatusEmoji(status: NotificationStatus): string {
    switch (status) {
      case 'sent':
        return '✅';
      case 'pending':
        return '⏳';
      case 'processing':
        return '⚙️';
      case 'failed':
        return '❌';
      case 'cancelled':
        return '🚫';
      default:
        return '❓';
    }
  }

  private parseTimeToMs(time: string): number {
    const match = time.match(/^(\d+)(m|h|d)$/);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  }

  async handleInteraction(interaction: Interaction): Promise<void> {
    // Handle autocomplete interactions
    if (interaction.isAutocomplete()) {
      await this.handleAutocomplete(interaction);
      return;
    }

    // Handle command interactions
    if (!interaction.isCommand()) return;

    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction as ChatInputCommandInteraction);
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

  /**
   * Handle autocomplete interactions for Home Assistant automation IDs
   */
  private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    try {
      const focusedOption = interaction.options.getFocused(true);

      // Only handle automation_id autocomplete
      if (focusedOption.name !== 'automation_id') {
        await interaction.respond([]);
        return;
      }

      // Skip if HA client not available
      if (!this.haClient) {
        await interaction.respond([]);
        return;
      }

      // Fetch automations from Home Assistant (with caching)
      const automations = await this.haClient.listAutomations(true);

      // Filter based on what user typed
      const userInput = focusedOption.value.toLowerCase();
      const filtered = automations
        .filter(a =>
          a.entity_id.toLowerCase().includes(userInput) ||
          a.friendly_name.toLowerCase().includes(userInput)
        )
        .slice(0, 25); // Discord limit: 25 suggestions

      // Respond with suggestions
      await interaction.respond(
        filtered.map(a => ({
          name: `${a.friendly_name} (${a.entity_id})`.substring(0, 100), // Discord limit: 100 chars
          value: a.entity_id,
        }))
      );
    } catch (error) {
      console.error('[Commands] Error handling autocomplete:', error);
      // Respond with empty array on error
      try {
        await interaction.respond([]);
      } catch {
        // Ignore if already responded or timed out
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
