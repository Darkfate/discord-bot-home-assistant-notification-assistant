import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type NotificationStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface NotificationInput {
  source: string;
  title?: string;
  message: string;
  severity?: 'info' | 'warning' | 'error';
  scheduledFor?: Date | string;
  maxRetries?: number;
  metadata?: Record<string, any>;
}

export interface QueuedNotification {
  id: number;
  createdAt: Date;
  scheduledFor: Date;
  sentAt?: Date;
  source: string;
  title?: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  discordMessageId?: string;
  status: NotificationStatus;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  metadata?: Record<string, any>;
}

export interface QueueStats {
  pending: number;
  processing: number;
  scheduled: number;
  failed: number;
  sent24h: number;
}

export class Database {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (err) {
      console.error('Failed to create data directory:', err);
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));

    // Check if we need to migrate the notifications table
    await this.migrateNotificationsTable();

    // Bot state/settings table
    await run(`
      CREATE TABLE IF NOT EXISTS bot_state (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Home Assistant entity tracking (optional - for future use)
    await run(`
      CREATE TABLE IF NOT EXISTS ha_entities (
        entity_id TEXT PRIMARY KEY,
        friendly_name TEXT,
        last_state TEXT,
        last_update DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async migrateNotificationsTable(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));

    // Check if old table exists
    const tableExists = await new Promise<boolean>((resolve, reject) => {
      this.db!.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'",
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });

    if (tableExists) {
      // Check if it has the new schema by checking for scheduled_for column
      const hasNewSchema = await new Promise<boolean>((resolve, reject) => {
        this.db!.get(
          "PRAGMA table_info(notifications)",
          (err, row: any) => {
            if (err) reject(err);
            else {
              // Check all columns
              this.db!.all("PRAGMA table_info(notifications)", (err, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows.some(r => r.name === 'scheduled_for'));
              });
            }
          }
        );
      });

      if (!hasNewSchema) {
        console.log('Migrating notifications table to new schema...');

        // Backup old data
        await run('CREATE TABLE IF NOT EXISTS notifications_backup AS SELECT * FROM notifications');

        // Drop old table
        await run('DROP TABLE notifications');

        console.log('Old notifications table backed up and dropped');
      }
    }

    // Create new notifications table with updated schema
    await run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        scheduled_for DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sent_at DATETIME,
        source TEXT NOT NULL,
        title TEXT,
        message TEXT NOT NULL,
        severity TEXT DEFAULT 'info',
        discord_message_id TEXT,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        last_error TEXT,
        metadata TEXT
      )
    `);

    // Create indexes for efficient querying
    await run('CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status)');
    await run('CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON notifications(scheduled_for)');
    await run('CREATE INDEX IF NOT EXISTS idx_notifications_status_scheduled ON notifications(status, scheduled_for)');
  }

  // ============================================================================
  // Queue Operations
  // ============================================================================

  async saveNotificationToQueue(notification: NotificationInput): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const scheduledFor = notification.scheduledFor
      ? (notification.scheduledFor instanceof Date
          ? notification.scheduledFor.toISOString()
          : new Date(notification.scheduledFor).toISOString())
      : new Date().toISOString();

    const metadata = notification.metadata ? JSON.stringify(notification.metadata) : null;

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO notifications (
          source, title, message, severity, scheduled_for, max_retries, metadata, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          notification.source,
          notification.title || null,
          notification.message,
          notification.severity || 'info',
          scheduledFor,
          notification.maxRetries || 3,
          metadata,
        ],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getNotificationById(id: number): Promise<QueuedNotification | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM notifications WHERE id = ?',
        [id],
        (err, row: any) => {
          if (err) reject(err);
          else if (!row) resolve(null);
          else resolve(this.rowToQueuedNotification(row));
        }
      );
    });
  }

  async updateNotificationStatus(
    id: number,
    status: NotificationStatus,
    error?: string
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run('BEGIN TRANSACTION');

        const sentAt = status === 'sent' ? new Date().toISOString() : null;

        this.db!.run(
          `UPDATE notifications
           SET status = ?, last_error = ?, sent_at = ?
           WHERE id = ?`,
          [status, error || null, sentAt, id],
          (err) => {
            if (err) {
              this.db!.run('ROLLBACK');
              reject(err);
            } else {
              this.db!.run('COMMIT', (commitErr) => {
                if (commitErr) reject(commitErr);
                else resolve();
              });
            }
          }
        );
      });
    });
  }

  async updateNotificationDiscordId(id: number, discordMessageId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        'UPDATE notifications SET discord_message_id = ? WHERE id = ?',
        [discordMessageId, id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async incrementRetryCount(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        'UPDATE notifications SET retry_count = retry_count + 1 WHERE id = ?',
        [id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // ============================================================================
  // Scheduling Operations
  // ============================================================================

  async getPendingNotifications(): Promise<QueuedNotification[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT * FROM notifications
         WHERE status = 'pending'
         ORDER BY scheduled_for ASC`,
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(row => this.rowToQueuedNotification(row)));
        }
      );
    });
  }

  async getDueNotifications(beforeTime?: Date): Promise<QueuedNotification[]> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffTime = (beforeTime || new Date()).toISOString();

    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT * FROM notifications
         WHERE status = 'pending' AND scheduled_for <= ?
         ORDER BY scheduled_for ASC`,
        [cutoffTime],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(row => this.rowToQueuedNotification(row)));
        }
      );
    });
  }

  async getScheduledNotifications(limit: number = 50): Promise<QueuedNotification[]> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT * FROM notifications
         WHERE status = 'pending' AND scheduled_for > ?
         ORDER BY scheduled_for ASC
         LIMIT ?`,
        [now, limit],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(row => this.rowToQueuedNotification(row)));
        }
      );
    });
  }

  async getProcessingNotifications(): Promise<QueuedNotification[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT * FROM notifications
         WHERE status = 'processing'
         ORDER BY created_at ASC`,
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(row => this.rowToQueuedNotification(row)));
        }
      );
    });
  }

  // ============================================================================
  // Management Operations
  // ============================================================================

  async cancelNotification(id: number): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        `UPDATE notifications SET status = 'cancelled'
         WHERE id = ? AND status IN ('pending', 'processing')`,
        [id],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  async retryFailedNotification(id: number): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        `UPDATE notifications
         SET status = 'pending', retry_count = 0, last_error = NULL
         WHERE id = ? AND status = 'failed'`,
        [id],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  async getFailedNotifications(limit: number = 50): Promise<QueuedNotification[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT * FROM notifications
         WHERE status = 'failed'
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(row => this.rowToQueuedNotification(row)));
        }
      );
    });
  }

  async cleanupOldNotifications(olderThanDays: number): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffDateStr = cutoffDate.toISOString();

    return new Promise((resolve, reject) => {
      this.db!.run(
        `DELETE FROM notifications
         WHERE status = 'sent' AND sent_at < ?`,
        [cutoffDateStr],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  async getQueueStats(): Promise<QueueStats> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const stats: QueueStats = {
        pending: 0,
        processing: 0,
        scheduled: 0,
        failed: 0,
        sent24h: 0,
      };

      const now = new Date().toISOString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Get status counts
      this.db!.get(
        `SELECT
          SUM(CASE WHEN status = 'pending' AND scheduled_for <= ? THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'pending' AND scheduled_for > ? THEN 1 ELSE 0 END) as scheduled,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'sent' AND sent_at > ? THEN 1 ELSE 0 END) as sent24h
         FROM notifications`,
        [now, now, yesterday],
        (err, row: any) => {
          if (err) reject(err);
          else {
            stats.pending = row.pending || 0;
            stats.scheduled = row.scheduled || 0;
            stats.processing = row.processing || 0;
            stats.failed = row.failed || 0;
            stats.sent24h = row.sent24h || 0;
            resolve(stats);
          }
        }
      );
    });
  }

  async getNotificationHistory(limit: number = 50, status?: NotificationStatus): Promise<QueuedNotification[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM notifications';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return new Promise((resolve, reject) => {
      this.db!.all(query, params, (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.rowToQueuedNotification(row)));
      });
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private rowToQueuedNotification(row: any): QueuedNotification {
    return {
      id: row.id,
      createdAt: new Date(row.created_at),
      scheduledFor: new Date(row.scheduled_for),
      sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
      source: row.source,
      title: row.title,
      message: row.message,
      severity: row.severity as 'info' | 'warning' | 'error',
      discordMessageId: row.discord_message_id,
      status: row.status as NotificationStatus,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      lastError: row.last_error,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  async setState(key: string, value: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT OR REPLACE INTO bot_state (key, value) VALUES (?, ?)`,
        [key, value],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getState(key: string): Promise<string | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get(
        `SELECT value FROM bot_state WHERE key = ?`,
        [key],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row ? row.value : null);
        }
      );
    });
  }

  async close(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
