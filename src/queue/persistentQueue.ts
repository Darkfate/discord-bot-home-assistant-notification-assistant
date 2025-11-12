/**
 * Persistent Notification Queue
 *
 * Manages the lifecycle of notifications from creation to delivery.
 * All notifications are persisted to the database before processing.
 */

import PQueue from 'p-queue';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { Database, NotificationInput, QueuedNotification, QueueStats } from '../database.js';
import { parseScheduledTime } from '../utils/dateParser.js';

export class PersistentNotificationQueue {
  private queue: PQueue;
  private client: Client;
  private database: Database;
  private channelId: string;
  private isShuttingDown: boolean = false;

  constructor(client: Client, database: Database, channelId: string) {
    this.client = client;
    this.database = database;
    this.channelId = channelId;
    // Concurrency of 1 ensures notifications are sent sequentially
    this.queue = new PQueue({ concurrency: 1 });
  }

  /**
   * Initialize the queue by recovering notifications left in 'processing' state
   * This handles notifications that were being sent when the bot shut down
   */
  async initialize(): Promise<void> {
    console.log('[Queue] Initializing persistent notification queue...');

    // Find notifications stuck in 'processing' state and reset them to 'pending'
    const processingNotifications = await this.database.getProcessingNotifications();

    if (processingNotifications.length > 0) {
      console.log(
        `[Queue] Found ${processingNotifications.length} notification(s) in processing state, resetting to pending...`
      );

      for (const notification of processingNotifications) {
        await this.database.updateNotificationStatus(notification.id, 'pending');
      }
    }

    console.log('[Queue] Queue initialized successfully');
  }

  /**
   * Enqueue a notification for processing
   *
   * @param notification - Notification input
   * @returns Notification ID
   */
  async enqueue(notification: NotificationInput): Promise<number> {
    // Parse scheduled time if provided
    let scheduledFor: Date;
    if (notification.scheduledFor) {
      if (typeof notification.scheduledFor === 'string') {
        scheduledFor = parseScheduledTime(notification.scheduledFor);
      } else {
        scheduledFor = notification.scheduledFor;
      }
    } else {
      scheduledFor = new Date(); // Immediate delivery
    }

    // Save to database
    const notificationId = await this.database.saveNotificationToQueue({
      ...notification,
      scheduledFor,
    });

    console.log(
      `[Queue] Notification ${notificationId} enqueued from "${notification.source}" - scheduled for ${scheduledFor.toISOString()}`
    );

    // If scheduled for immediate delivery (now or in the past), process it
    if (scheduledFor.getTime() <= Date.now()) {
      await this.processNotification(notificationId);
    }

    return notificationId;
  }

  /**
   * Process a notification by ID
   *
   * @param id - Notification ID
   */
  async processNotification(id: number): Promise<void> {
    // Add to queue to ensure sequential processing
    await this.queue.add(async () => {
      // Skip if shutting down
      if (this.isShuttingDown) {
        console.log(`[Queue] Skipping notification ${id} due to shutdown`);
        return;
      }

      try {
        // Load notification from database
        const notification = await this.database.getNotificationById(id);

        if (!notification) {
          console.error(`[Queue] Notification ${id} not found in database`);
          return;
        }

        // Check if already processed or cancelled
        if (notification.status !== 'pending') {
          console.log(
            `[Queue] Notification ${id} has status "${notification.status}", skipping processing`
          );
          return;
        }

        // Check if scheduled for the future
        if (notification.scheduledFor.getTime() > Date.now()) {
          console.log(
            `[Queue] Notification ${id} is scheduled for ${notification.scheduledFor.toISOString()}, skipping for now`
          );
          return;
        }

        // Update status to 'processing'
        await this.database.updateNotificationStatus(id, 'processing');

        console.log(
          `[Queue] Processing notification ${id} from "${notification.source}" (retry ${notification.retryCount}/${notification.maxRetries})`
        );

        // Try to send to Discord
        await this.sendToDiscord(notification);

        // Mark as sent
        await this.database.updateNotificationStatus(id, 'sent');

        console.log(`[Queue] ✅ Notification ${id} sent successfully`);
      } catch (error) {
        console.error(`[Queue] ❌ Failed to send notification ${id}:`, error);

        // Handle failure with retry logic
        await this.handleFailure(id, error);
      }
    });
  }

  /**
   * Send notification to Discord
   *
   * @param notification - Queued notification
   */
  private async sendToDiscord(notification: QueuedNotification): Promise<void> {
    const channel = await this.client.channels.fetch(this.channelId);

    if (!channel || !channel.isTextBased()) {
      throw new Error('Invalid notification channel');
    }

    const embed = this.buildEmbed(notification);
    const message = await (channel as TextChannel).send({ embeds: [embed] });

    // Save Discord message ID
    await this.database.updateNotificationDiscordId(notification.id, message.id);
  }

  /**
   * Build Discord embed for notification
   *
   * @param notification - Queued notification
   * @returns Discord embed
   */
  private buildEmbed(notification: QueuedNotification): EmbedBuilder {
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
      .setTimestamp(notification.createdAt);

    // Add retry info if retried
    if (notification.retryCount > 0) {
      embed.addFields({
        name: 'Retry Info',
        value: `Attempt ${notification.retryCount + 1}/${notification.maxRetries + 1}`,
        inline: true,
      });
    }

    return embed;
  }

  /**
   * Handle notification failure with retry logic
   *
   * @param id - Notification ID
   * @param error - Error that occurred
   */
  private async handleFailure(id: number, error: any): Promise<void> {
    const notification = await this.database.getNotificationById(id);

    if (!notification) {
      console.error(`[Queue] Cannot handle failure for notification ${id}: not found`);
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if we should retry
    if (notification.retryCount < notification.maxRetries) {
      // Increment retry count
      await this.database.incrementRetryCount(id);

      // Calculate retry delay with exponential backoff
      const retryDelay = this.calculateRetryDelay(notification.retryCount);

      // Update status back to pending (will be picked up by scheduler)
      await this.database.updateNotificationStatus(id, 'pending', errorMessage);

      console.log(
        `[Queue] Notification ${id} will be retried in ${retryDelay}s (attempt ${notification.retryCount + 1}/${notification.maxRetries})`
      );

      // Schedule retry
      setTimeout(() => {
        this.processNotification(id).catch((err) => {
          console.error(`[Queue] Error during retry of notification ${id}:`, err);
        });
      }, retryDelay * 1000);
    } else {
      // Max retries reached, mark as failed
      await this.database.updateNotificationStatus(id, 'failed', errorMessage);

      console.error(
        `[Queue] Notification ${id} permanently failed after ${notification.retryCount} retries: ${errorMessage}`
      );
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   *
   * @param retryCount - Current retry count
   * @returns Delay in seconds
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = parseInt(process.env.QUEUE_RETRY_BASE_DELAY || '60', 10);
    return baseDelay * Math.pow(2, retryCount);
  }

  /**
   * Cancel a notification
   *
   * @param id - Notification ID
   * @returns True if cancelled, false if not found or already processed
   */
  async cancel(id: number): Promise<boolean> {
    const cancelled = await this.database.cancelNotification(id);

    if (cancelled) {
      console.log(`[Queue] Notification ${id} cancelled`);
    }

    return cancelled;
  }

  /**
   * Retry a failed notification
   *
   * @param id - Notification ID
   * @returns True if retried, false if not found or not failed
   */
  async retry(id: number): Promise<boolean> {
    const retried = await this.database.retryFailedNotification(id);

    if (retried) {
      console.log(`[Queue] Retrying notification ${id}`);
      await this.processNotification(id);
    }

    return retried;
  }

  /**
   * Get queue statistics
   *
   * @returns Queue statistics
   */
  async getStats(): Promise<QueueStats> {
    return await this.database.getQueueStats();
  }

  /**
   * Graceful shutdown - wait for in-flight notifications to complete
   */
  async shutdown(): Promise<void> {
    console.log('[Queue] Shutting down queue gracefully...');
    this.isShuttingDown = true;

    // Wait for all queued tasks to complete
    await this.queue.onIdle();

    console.log('[Queue] Queue shutdown complete');
  }

  /**
   * Get current queue size (in-memory)
   *
   * @returns Number of notifications being processed
   */
  getQueueSize(): number {
    return this.queue.size + this.queue.pending;
  }
}
