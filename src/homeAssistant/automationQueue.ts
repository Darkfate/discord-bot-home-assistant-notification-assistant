/**
 * Automation Trigger Queue
 *
 * Manages the lifecycle of Home Assistant automation triggers from scheduling to execution.
 * All triggers are persisted to the database before processing.
 */

import PQueue from 'p-queue';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { Database } from '../database.js';
import { parseScheduledTime } from '../utils/dateParser.js';
import { HomeAssistantClient } from './client.js';
import type {
  AutomationTrigger,
  AutomationTriggerInput,
  AutomationTriggerStatus,
} from './types.js';

export class AutomationTriggerQueue {
  private queue: PQueue;
  private client: Client;
  private database: Database;
  private haClient: HomeAssistantClient;
  private channelId: string;
  private isShuttingDown: boolean = false;

  constructor(
    client: Client,
    database: Database,
    haClient: HomeAssistantClient,
    channelId: string
  ) {
    this.client = client;
    this.database = database;
    this.haClient = haClient;
    this.channelId = channelId;
    // Concurrency of 1 ensures triggers are processed sequentially
    this.queue = new PQueue({ concurrency: 1 });
  }

  /**
   * Initialize the queue by recovering triggers left in 'processing' state
   */
  async initialize(): Promise<void> {
    console.log('[HA Queue] Initializing automation trigger queue...');

    // Find triggers stuck in 'processing' state and reset them to 'pending'
    const processingTriggers = await this.database.queryAutomationTriggers({
      status: 'processing',
      limit: 1000,
    });

    if (processingTriggers.length > 0) {
      console.log(
        `[HA Queue] Found ${processingTriggers.length} trigger(s) in processing state, resetting to pending...`
      );

      for (const trigger of processingTriggers) {
        await this.database.updateAutomationTriggerStatus(trigger.id, 'pending');
      }
    }

    console.log('[HA Queue] Queue initialized successfully');
  }

  /**
   * Enqueue an automation trigger for processing
   *
   * @param input - Automation trigger input
   * @returns Trigger ID
   */
  async enqueue(input: AutomationTriggerInput): Promise<number> {
    // Parse scheduled time
    let scheduledFor: Date;
    if (typeof input.scheduledFor === 'string') {
      scheduledFor = parseScheduledTime(input.scheduledFor);
    } else {
      scheduledFor = input.scheduledFor;
    }

    // Save to database
    const triggerId = await this.database.saveAutomationTrigger({
      ...input,
      scheduledFor,
    });

    console.log(
      `[HA Queue] Trigger ${triggerId} enqueued for automation "${input.automationId}" - scheduled for ${scheduledFor.toISOString()}`
    );

    // If scheduled for immediate execution (now or in the past), process it
    if (scheduledFor.getTime() <= Date.now()) {
      await this.processTrigger(triggerId);
    }

    return triggerId;
  }

  /**
   * Process an automation trigger by ID
   *
   * @param id - Trigger ID
   */
  async processTrigger(id: number): Promise<void> {
    // Add to queue to ensure sequential processing
    await this.queue.add(async () => {
      // Skip if shutting down
      if (this.isShuttingDown) {
        console.log(`[HA Queue] Skipping trigger ${id} due to shutdown`);
        return;
      }

      // Get trigger from database
      const trigger = await this.database.getAutomationTrigger(id);

      if (!trigger) {
        console.error(`[HA Queue] Trigger ${id} not found in database`);
        return;
      }

      // Skip if already processed or cancelled
      if (trigger.status !== 'pending') {
        console.log(`[HA Queue] Skipping trigger ${id} with status ${trigger.status}`);
        return;
      }

      // Mark as processing
      await this.database.updateAutomationTriggerStatus(id, 'processing');

      try {
        console.log(`[HA Queue] Processing trigger ${id} for automation ${trigger.automationId}...`);

        // Trigger the automation via HA API
        await this.haClient.triggerAutomation(trigger.automationId);

        // Mark as triggered
        await this.database.updateAutomationTriggerStatus(id, 'triggered');

        console.log(`[HA Queue] ✓ Trigger ${id} completed successfully`);

        // Send notification if requested
        if (trigger.notifyOnComplete) {
          await this.sendSuccessNotification(trigger);
        }
      } catch (error: any) {
        console.error(`[HA Queue] ✗ Trigger ${id} failed:`, error.message);

        // Update retry count
        await this.database.incrementAutomationTriggerRetry(id);

        // Get updated trigger to check retry count
        const updatedTrigger = await this.database.getAutomationTrigger(id);

        if (!updatedTrigger) {
          console.error(`[HA Queue] Trigger ${id} disappeared during retry`);
          return;
        }

        // Check if max retries exceeded
        if (updatedTrigger.retryCount >= updatedTrigger.maxRetries) {
          console.log(`[HA Queue] Trigger ${id} exceeded max retries, marking as failed`);
          await this.database.updateAutomationTriggerStatus(id, 'failed', error.message);

          // Send failure notification if requested
          if (updatedTrigger.notifyOnComplete) {
            await this.sendFailureNotification(updatedTrigger, error.message);
          }
        } else {
          // Calculate retry delay
          const delay = this.calculateRetryDelay(updatedTrigger.retryCount);
          console.log(
            `[HA Queue] Trigger ${id} will retry in ${delay}s (attempt ${updatedTrigger.retryCount + 1}/${updatedTrigger.maxRetries + 1})`
          );

          // Reset to pending for retry
          await this.database.updateAutomationTriggerStatus(id, 'pending', error.message);

          // Schedule retry
          setTimeout(() => {
            this.processTrigger(id).catch(err =>
              console.error(`[HA Queue] Retry of trigger ${id} failed:`, err)
            );
          }, delay * 1000);
        }
      }
    });
  }

  /**
   * Cancel a pending automation trigger
   *
   * @param id - Trigger ID
   */
  async cancelTrigger(id: number): Promise<void> {
    const trigger = await this.database.getAutomationTrigger(id);

    if (!trigger) {
      throw new Error(`Trigger ${id} not found`);
    }

    if (trigger.status !== 'pending') {
      throw new Error(`Cannot cancel trigger ${id} with status ${trigger.status}`);
    }

    await this.database.updateAutomationTriggerStatus(id, 'cancelled');
    console.log(`[HA Queue] Trigger ${id} cancelled`);
  }

  /**
   * Retry a failed automation trigger
   *
   * @param id - Trigger ID
   */
  async retryTrigger(id: number): Promise<void> {
    const trigger = await this.database.getAutomationTrigger(id);

    if (!trigger) {
      throw new Error(`Trigger ${id} not found`);
    }

    if (trigger.status !== 'failed') {
      throw new Error(`Cannot retry trigger ${id} with status ${trigger.status}`);
    }

    // Reset status and retry count
    await this.database.updateAutomationTriggerStatus(id, 'pending');
    console.log(`[HA Queue] Trigger ${id} queued for retry`);

    // Process immediately
    await this.processTrigger(id);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = parseInt(process.env.QUEUE_RETRY_BASE_DELAY || '60', 10);
    return baseDelay * Math.pow(2, retryCount); // 60s, 120s, 240s, etc.
  }

  /**
   * Send a success notification to Discord
   */
  private async sendSuccessNotification(trigger: AutomationTrigger): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(this.channelId);

      if (!channel || !channel.isTextBased()) {
        console.error('[HA Queue] Channel not found or not text-based');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71) // Green
        .setTitle('✓ Automation Triggered')
        .setDescription(
          trigger.automationName
            ? `**${trigger.automationName}** (${trigger.automationId})`
            : trigger.automationId
        )
        .addFields(
          {
            name: 'Triggered By',
            value: `<@${trigger.triggeredBy}>`,
            inline: true,
          },
          {
            name: 'Trigger ID',
            value: `#${trigger.id}`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Home Assistant' });

      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (error) {
      console.error('[HA Queue] Failed to send success notification:', error);
    }
  }

  /**
   * Send a failure notification to Discord
   */
  private async sendFailureNotification(trigger: AutomationTrigger, error: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(this.channelId);

      if (!channel || !channel.isTextBased()) {
        console.error('[HA Queue] Channel not found or not text-based');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c) // Red
        .setTitle('✗ Automation Trigger Failed')
        .setDescription(
          trigger.automationName
            ? `**${trigger.automationName}** (${trigger.automationId})`
            : trigger.automationId
        )
        .addFields(
          {
            name: 'Triggered By',
            value: `<@${trigger.triggeredBy}>`,
            inline: true,
          },
          {
            name: 'Trigger ID',
            value: `#${trigger.id}`,
            inline: true,
          },
          {
            name: 'Error',
            value: error.substring(0, 1024), // Limit to Discord field max
          },
          {
            name: 'Retries',
            value: `${trigger.retryCount}/${trigger.maxRetries}`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Home Assistant' });

      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (error) {
      console.error('[HA Queue] Failed to send failure notification:', error);
    }
  }

  /**
   * Graceful shutdown - wait for current operations to complete
   */
  async shutdown(): Promise<void> {
    console.log('[HA Queue] Shutting down automation trigger queue...');
    this.isShuttingDown = true;

    // Wait for queue to drain
    await this.queue.onIdle();

    console.log('[HA Queue] Queue shutdown complete');
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Get pending count
   */
  getPendingCount(): number {
    return this.queue.pending;
  }
}
