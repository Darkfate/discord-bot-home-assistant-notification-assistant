import PQueue from 'p-queue';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { Database } from './database.js';

export interface Notification {
  source: string;
  title?: string;
  message: string;
  severity?: 'info' | 'warning' | 'error';
  timestamp?: Date;
}

export class NotificationQueue {
  private queue: PQueue;
  private client: Client;
  private database: Database;
  private channelId: string;

  constructor(client: Client, database: Database, channelId: string) {
    this.client = client;
    this.database = database;
    this.channelId = channelId;
    // Concurrency of 1 ensures notifications are sent sequentially
    this.queue = new PQueue({ concurrency: 1 });
  }

  async enqueue(notification: Notification): Promise<void> {
    await this.queue.add(() => this.sendNotification(notification));
  }

  private async sendNotification(notification: Notification): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel || !channel.isTextBased()) {
        console.error('Invalid notification channel');
        return;
      }

      const embed = this.buildEmbed(notification);
      const message = await (channel as TextChannel).send({ embeds: [embed] });

      // Save to database with Discord message ID
      await this.database.saveNotification(
        notification.source,
        notification.message,
        notification.title,
        message.id
      );

      console.log(
        `[${notification.source}] Notification sent: ${notification.title || notification.message}`
      );
    } catch (error) {
      console.error('Failed to send notification:', error);
      // Still save to database even if Discord send failed
      await this.database.saveNotification(
        notification.source,
        notification.message,
        notification.title
      );
    }
  }

  private buildEmbed(notification: Notification): EmbedBuilder {
    const colors: Record<string, number> = {
      info: 0x3498db,
      warning: 0xf39c12,
      error: 0xe74c3c,
    };

    const color = colors[notification.severity || 'info'];

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(notification.title || notification.source)
      .setDescription(notification.message)
      .setFooter({ text: notification.source })
      .setTimestamp(notification.timestamp || new Date());

    return embed;
  }

  getQueueSize(): number {
    return this.queue.size;
  }
}
