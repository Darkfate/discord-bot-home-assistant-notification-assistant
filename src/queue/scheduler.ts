/**
 * Notification Scheduler
 *
 * Periodically checks the database for due notifications and queues them for processing.
 * Handles scheduled notifications (future delivery).
 */

import { Database } from '../database.js';
import { PersistentNotificationQueue } from './persistentQueue.js';

export class NotificationScheduler {
  private queue: PersistentNotificationQueue;
  private database: Database;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private intervalSeconds: number = 30;
  private isRunning: boolean = false;

  constructor(queue: PersistentNotificationQueue, database: Database) {
    this.queue = queue;
    this.database = database;
  }

  /**
   * Start the scheduler
   *
   * @param intervalSeconds - How often to check for due notifications (default: 30)
   */
  start(intervalSeconds: number = 30): void {
    if (this.schedulerInterval) {
      console.log('[Scheduler] Scheduler already running');
      return;
    }

    this.intervalSeconds = intervalSeconds;
    this.isRunning = true;

    console.log(`[Scheduler] Starting scheduler (checking every ${intervalSeconds}s)`);

    // Check immediately on start
    this.checkDueNotifications().catch((err) => {
      console.error('[Scheduler] Error during initial check:', err);
    });

    // Then check periodically
    this.schedulerInterval = setInterval(() => {
      if (this.isRunning) {
        this.checkDueNotifications().catch((err) => {
          console.error('[Scheduler] Error during scheduled check:', err);
        });
      }
    }, intervalSeconds * 1000);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      this.isRunning = false;
      console.log('[Scheduler] Scheduler stopped');
    }
  }

  /**
   * Check for due notifications and queue them for processing
   *
   * @returns Number of notifications queued
   */
  async checkDueNotifications(): Promise<number> {
    try {
      // Get all notifications that are due (scheduled_for <= now and status = pending)
      const dueNotifications = await this.database.getDueNotifications();

      if (dueNotifications.length > 0) {
        console.log(`[Scheduler] Found ${dueNotifications.length} due notification(s)`);

        // Process each due notification
        for (const notification of dueNotifications) {
          try {
            await this.queue.processNotification(notification.id);
          } catch (error) {
            console.error(
              `[Scheduler] Error processing notification ${notification.id}:`,
              error
            );
            // Continue processing other notifications even if one fails
          }
        }
      }

      return dueNotifications.length;
    } catch (error) {
      console.error('[Scheduler] Error checking for due notifications:', error);
      return 0;
    }
  }

  /**
   * Get scheduler status
   *
   * @returns True if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning && this.schedulerInterval !== null;
  }

  /**
   * Get scheduler interval
   *
   * @returns Interval in seconds
   */
  getInterval(): number {
    return this.intervalSeconds;
  }
}
