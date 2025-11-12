/**
 * Shared types for the persistent queue system
 *
 * These types are re-exported from database.ts for convenience
 * and better code organization.
 */

export type {
  NotificationStatus,
  NotificationInput,
  QueuedNotification,
  QueueStats,
} from '../database.js';
