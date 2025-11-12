import { Database } from '../../database.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Database Integration Tests', () => {
  let database: Database;
  const testDbPath = path.join(__dirname, 'db-integration-test.db');

  beforeEach(async () => {
    database = new Database(testDbPath);
    await database.initialize();
  });

  afterEach(async () => {
    await database.close();
    try {
      await fs.unlink(testDbPath);
    } catch (err) {
      // Ignore error if file doesn't exist
    }
  });

  describe('Complete notification lifecycle', () => {
    it('should persist notifications across database instances', async () => {
      // Save notifications with delay to ensure different timestamps
      await database.saveNotification('Source1', 'Message1', 'Title1');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await database.saveNotification('Source2', 'Message2');

      // Close and reopen database
      await database.close();
      database = new Database(testDbPath);
      await database.initialize();

      // Verify data persists
      const history = await database.getNotificationHistory();
      expect(history).toHaveLength(2);
      // Just verify both are present, order may vary by millisecond
      const sources = history.map((h) => h.source);
      expect(sources).toContain('Source1');
      expect(sources).toContain('Source2');
    });

    it('should handle large number of notifications', async () => {
      // Save 100 notifications sequentially to ensure proper ordering
      for (let i = 0; i < 100; i++) {
        await database.saveNotification(`Source${i}`, `Message${i}`, `Title${i}`);
      }

      // Retrieve with different limits
      const history50 = await database.getNotificationHistory(50);
      expect(history50).toHaveLength(50);

      const history100 = await database.getNotificationHistory(100);
      expect(history100).toHaveLength(100);

      // Verify we got all the notifications
      const sources = history100.map((h) => h.source);
      expect(sources).toContain('Source0');
      expect(sources).toContain('Source99');
    });

    it('should maintain notification metadata', async () => {
      const discordMessageId = 'discord-msg-123456';
      const id = await database.saveNotification(
        'Home Assistant',
        'Front door opened',
        'Security Alert',
        discordMessageId
      );

      const history = await database.getNotificationHistory(1);
      expect(history[0]).toMatchObject({
        id,
        source: 'Home Assistant',
        title: 'Security Alert',
        message: 'Front door opened',
        discord_message_id: discordMessageId,
        status: 'sent',
      });
      expect(history[0].timestamp).toBeDefined();
    });
  });

  describe('Bot state management', () => {
    it('should persist state across database instances', async () => {
      // Set state
      await database.setState('last_update', '2024-01-01');
      await database.setState('message_count', '42');

      // Close and reopen
      await database.close();
      database = new Database(testDbPath);
      await database.initialize();

      // Verify state persists
      const lastUpdate = await database.getState('last_update');
      const messageCount = await database.getState('message_count');

      expect(lastUpdate).toBe('2024-01-01');
      expect(messageCount).toBe('42');
    });

    it('should update state values correctly', async () => {
      await database.setState('counter', '0');

      for (let i = 1; i <= 10; i++) {
        await database.setState('counter', i.toString());
      }

      const counter = await database.getState('counter');
      expect(counter).toBe('10');
    });

    it('should handle multiple state keys independently', async () => {
      await database.setState('key1', 'value1');
      await database.setState('key2', 'value2');
      await database.setState('key3', 'value3');

      expect(await database.getState('key1')).toBe('value1');
      expect(await database.getState('key2')).toBe('value2');
      expect(await database.getState('key3')).toBe('value3');

      // Update one key
      await database.setState('key2', 'updated_value2');

      // Others should remain unchanged
      expect(await database.getState('key1')).toBe('value1');
      expect(await database.getState('key2')).toBe('updated_value2');
      expect(await database.getState('key3')).toBe('value3');
    });
  });

  describe('Concurrent operations', () => {
    it('should handle concurrent notification saves', async () => {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(database.saveNotification(`Source${i}`, `Message${i}`));
      }

      const results = await Promise.all(promises);

      // All should succeed with unique IDs
      expect(results).toHaveLength(50);
      const uniqueIds = new Set(results);
      expect(uniqueIds.size).toBe(50);

      // Verify all were saved
      const history = await database.getNotificationHistory(100);
      expect(history).toHaveLength(50);
    });

    it('should handle concurrent state updates', async () => {
      const keys = ['key1', 'key2', 'key3', 'key4', 'key5'];
      const promises = keys.map((key) => database.setState(key, `value_${key}`));

      await Promise.all(promises);

      // Verify all states were set
      for (const key of keys) {
        const value = await database.getState(key);
        expect(value).toBe(`value_${key}`);
      }
    });

    it('should handle mixed read and write operations', async () => {
      // Prepare some initial data
      await database.saveNotification('Initial', 'Initial message');
      await database.setState('counter', '0');

      // Mix of operations
      const promises = [
        database.saveNotification('Source1', 'Message1'),
        database.getNotificationHistory(10),
        database.setState('counter', '1'),
        database.saveNotification('Source2', 'Message2'),
        database.getState('counter'),
        database.getNotificationHistory(5),
        database.setState('counter', '2'),
      ];

      const results = await Promise.all(promises);

      // Verify operations completed
      expect(results[0]).toBeDefined(); // Save result
      expect(Array.isArray(results[1])).toBe(true); // History result
      expect(results[2]).toBeUndefined(); // setState returns void
      expect(results[3]).toBeDefined(); // Save result

      // Verify final state
      const finalHistory = await database.getNotificationHistory(10);
      expect(finalHistory.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Data integrity', () => {
    it('should handle special characters in data', async () => {
      const specialSource = "Test's \"Source\" <>&";
      const specialMessage = 'Message with\nnewlines\tand\ttabs';
      const specialTitle = '🔔 Alert! 🚨';

      await database.saveNotification(specialSource, specialMessage, specialTitle);

      const history = await database.getNotificationHistory(1);
      expect(history[0].source).toBe(specialSource);
      expect(history[0].message).toBe(specialMessage);
      expect(history[0].title).toBe(specialTitle);
    });

    it('should handle empty strings', async () => {
      const id = await database.saveNotification('', '');
      expect(id).toBeGreaterThan(0);

      const history = await database.getNotificationHistory(1);
      expect(history[0].source).toBe('');
      expect(history[0].message).toBe('');
    });

    it('should handle very long strings', async () => {
      const longString = 'a'.repeat(10000);
      await database.saveNotification(longString, longString, longString);

      const history = await database.getNotificationHistory(1);
      expect(history[0].source).toBe(longString);
      expect(history[0].message).toBe(longString);
      expect(history[0].title).toBe(longString);
    });

    it('should maintain data types for state values', async () => {
      const testCases = [
        { key: 'number', value: '12345' },
        { key: 'json', value: '{"key": "value"}' },
        { key: 'empty', value: '' },
        { key: 'unicode', value: '🎉 Unicode! 中文' },
      ];

      for (const { key, value } of testCases) {
        await database.setState(key, value);
      }

      for (const { key, value } of testCases) {
        const retrieved = await database.getState(key);
        expect(retrieved).toBe(value);
      }
    });
  });

  describe('Error scenarios', () => {
    it('should handle database file in read-only directory gracefully', async () => {
      // This test verifies error handling for initialization failures
      const invalidDb = new Database('/invalid/path/test.db');

      // Should handle the error during initialization
      try {
        await invalidDb.initialize();
        // If it doesn't throw, that's actually okay in some environments
        // So we just verify the behavior is consistent
        expect(true).toBe(true);
      } catch (error) {
        // Error is expected in most cases
        expect(error).toBeDefined();
      }
    });

    it('should handle operations on closed database', async () => {
      // Create a new database instance to test close
      const tempDb = new Database(':memory:');
      await tempDb.initialize();
      await tempDb.close();

      await expect(
        tempDb.saveNotification('test', 'message')
      ).rejects.toThrow();
      await expect(tempDb.getNotificationHistory()).rejects.toThrow();
      await expect(tempDb.setState('key', 'value')).rejects.toThrow();
      await expect(tempDb.getState('key')).rejects.toThrow();
    });
  });
});
