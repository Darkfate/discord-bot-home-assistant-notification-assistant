import { Database } from '../../database.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Database', () => {
  let database: Database;
  const testDbPath = path.join(__dirname, 'test.db');

  beforeEach(async () => {
    // Create a new database instance for each test
    database = new Database(testDbPath);
    await database.initialize();
  });

  afterEach(async () => {
    // Clean up: close database and remove test file
    await database.close();
    try {
      await fs.unlink(testDbPath);
    } catch (err) {
      // Ignore error if file doesn't exist
    }
  });

  describe('initialize', () => {
    it('should create database file', async () => {
      const fileExists = await fs.access(testDbPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should create required tables', async () => {
      // Try to insert data to verify tables exist
      await expect(
        database.saveNotification('test', 'message')
      ).resolves.toBeDefined();
    });
  });

  describe('saveNotification', () => {
    it('should save notification with all fields', async () => {
      const id = await database.saveNotification(
        'Home Assistant',
        'Test message',
        'Test title',
        '123456789'
      );

      expect(id).toBeGreaterThan(0);
    });

    it('should save notification without optional fields', async () => {
      const id = await database.saveNotification('Test', 'Message only');
      expect(id).toBeGreaterThan(0);
    });

    it('should throw error if database not initialized', async () => {
      const uninitializedDb = new Database(':memory:');
      await expect(
        uninitializedDb.saveNotification('test', 'message')
      ).rejects.toThrow('Database not initialized');
    });
  });

  describe('getNotificationHistory', () => {
    it('should return empty array when no notifications exist', async () => {
      const history = await database.getNotificationHistory();
      expect(history).toEqual([]);
    });

    it('should return saved notifications', async () => {
      await database.saveNotification('Source1', 'Message1', 'Title1');
      // Add a small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 100));
      await database.saveNotification('Source2', 'Message2', 'Title2');

      const history = await database.getNotificationHistory();
      expect(history).toHaveLength(2);

      // Verify both sources are present
      const sources = history.map(h => h.source);
      expect(sources).toContain('Source1');
      expect(sources).toContain('Source2');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await database.saveNotification(`Source${i}`, `Message${i}`);
      }

      const history = await database.getNotificationHistory(3);
      expect(history).toHaveLength(3);
    });

    it('should throw error if database not initialized', async () => {
      const uninitializedDb = new Database(':memory:');
      await expect(
        uninitializedDb.getNotificationHistory()
      ).rejects.toThrow('Database not initialized');
    });
  });

  describe('setState and getState', () => {
    it('should save and retrieve state', async () => {
      await database.setState('test_key', 'test_value');
      const value = await database.getState('test_key');
      expect(value).toBe('test_value');
    });

    it('should return null for non-existent key', async () => {
      const value = await database.getState('non_existent');
      expect(value).toBeNull();
    });

    it('should update existing state', async () => {
      await database.setState('key', 'value1');
      await database.setState('key', 'value2');
      const value = await database.getState('key');
      expect(value).toBe('value2');
    });

    it('should throw error if database not initialized', async () => {
      const uninitializedDb = new Database(':memory:');
      await expect(
        uninitializedDb.setState('key', 'value')
      ).rejects.toThrow('Database not initialized');
      await expect(
        uninitializedDb.getState('key')
      ).rejects.toThrow('Database not initialized');
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      // Create a new database instance to test close
      const tempDb = new Database(':memory:');
      await tempDb.initialize();
      await tempDb.close();

      // Attempting operations after close should fail
      await expect(
        tempDb.saveNotification('test', 'message')
      ).rejects.toThrow();
    });

    it('should handle closing uninitialized database', async () => {
      const uninitializedDb = new Database(':memory:');
      await expect(uninitializedDb.close()).resolves.toBeUndefined();
    });
  });
});
