import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

    // Notification history table
    await run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        source TEXT NOT NULL,
        title TEXT,
        message TEXT NOT NULL,
        discord_message_id TEXT,
        status TEXT DEFAULT 'pending'
      )
    `);

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

  async saveNotification(
    source: string,
    message: string,
    title?: string,
    discordMessageId?: string
  ): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));
    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO notifications (source, title, message, discord_message_id, status)
         VALUES (?, ?, ?, ?, 'sent')`,
        [source, title || null, message, discordMessageId || null],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getNotificationHistory(limit: number = 50): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT * FROM notifications ORDER BY timestamp DESC LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
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
