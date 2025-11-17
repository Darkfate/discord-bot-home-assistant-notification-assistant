import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PermissionManager } from '../../permissions.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('PermissionManager', () => {
  let tempDir: string;
  let tempConfigPath: string;

  beforeEach(() => {
    // Create a temporary directory for test configs
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'permissions-test-'));
    tempConfigPath = path.join(tempDir, 'ha-permissions.json');
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor and loadConfig', () => {
    it('should load valid config file successfully', () => {
      const config = {
        allowedUsers: ['123456789', '987654321']
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(config));

      const pm = new PermissionManager(tempConfigPath, false);

      expect(pm.getAllowedUserCount()).toBe(2);
      expect(pm.getAllowedUsers()).toEqual(['123456789', '987654321']);
    });

    it('should handle missing config file gracefully', () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.json');
      const pm = new PermissionManager(nonExistentPath, false);

      expect(pm.getAllowedUserCount()).toBe(0);
      expect(pm.getAllowedUsers()).toEqual([]);
    });

    it('should handle malformed JSON gracefully', () => {
      fs.writeFileSync(tempConfigPath, '{ invalid json }');

      const pm = new PermissionManager(tempConfigPath, false);

      expect(pm.getAllowedUserCount()).toBe(0);
      expect(pm.getAllowedUsers()).toEqual([]);
    });

    it('should handle config with missing allowedUsers array', () => {
      const config = {
        someOtherField: 'value'
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(config));

      const pm = new PermissionManager(tempConfigPath, false);

      expect(pm.getAllowedUserCount()).toBe(0);
      expect(pm.getAllowedUsers()).toEqual([]);
    });

    it('should handle config with non-array allowedUsers', () => {
      const config = {
        allowedUsers: 'not-an-array'
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(config));

      const pm = new PermissionManager(tempConfigPath, false);

      expect(pm.getAllowedUserCount()).toBe(0);
      expect(pm.getAllowedUsers()).toEqual([]);
    });

    it('should handle empty allowedUsers array', () => {
      const config = {
        allowedUsers: []
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(config));

      const pm = new PermissionManager(tempConfigPath, false);

      expect(pm.getAllowedUserCount()).toBe(0);
      expect(pm.getAllowedUsers()).toEqual([]);
    });

    it('should remove duplicate user IDs', () => {
      const config = {
        allowedUsers: ['123456789', '987654321', '123456789']
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(config));

      const pm = new PermissionManager(tempConfigPath, false);

      expect(pm.getAllowedUserCount()).toBe(2);
    });
  });

  describe('isUserAllowed', () => {
    it('should return true for allowed user', () => {
      const config = {
        allowedUsers: ['123456789', '987654321']
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(config));

      const pm = new PermissionManager(tempConfigPath, false);

      expect(pm.isUserAllowed('123456789')).toBe(true);
      expect(pm.isUserAllowed('987654321')).toBe(true);
    });

    it('should return false for non-allowed user', () => {
      const config = {
        allowedUsers: ['123456789']
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(config));

      const pm = new PermissionManager(tempConfigPath, false);

      expect(pm.isUserAllowed('999999999')).toBe(false);
    });

    it('should return false when config is missing', () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.json');
      const pm = new PermissionManager(nonExistentPath, false);

      expect(pm.isUserAllowed('123456789')).toBe(false);
    });

    it('should be case-sensitive', () => {
      const config = {
        allowedUsers: ['AbCdEf123']
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(config));

      const pm = new PermissionManager(tempConfigPath, false);

      expect(pm.isUserAllowed('AbCdEf123')).toBe(true);
      expect(pm.isUserAllowed('abcdef123')).toBe(false);
    });
  });

  describe('getAllowedUsers', () => {
    it('should return array of allowed user IDs', () => {
      const config = {
        allowedUsers: ['123456789', '987654321', '555555555']
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(config));

      const pm = new PermissionManager(tempConfigPath, false);

      const users = pm.getAllowedUsers();
      expect(users).toHaveLength(3);
      expect(users).toContain('123456789');
      expect(users).toContain('987654321');
      expect(users).toContain('555555555');
    });

    it('should return empty array when no users allowed', () => {
      const config = {
        allowedUsers: []
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(config));

      const pm = new PermissionManager(tempConfigPath, false);

      expect(pm.getAllowedUsers()).toEqual([]);
    });
  });

  describe('getAllowedUserCount', () => {
    it('should return correct count of allowed users', () => {
      const config = {
        allowedUsers: ['123', '456', '789']
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(config));

      const pm = new PermissionManager(tempConfigPath, false);

      expect(pm.getAllowedUserCount()).toBe(3);
    });

    it('should return 0 when no users allowed', () => {
      const config = {
        allowedUsers: []
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(config));

      const pm = new PermissionManager(tempConfigPath, false);

      expect(pm.getAllowedUserCount()).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clean up resources without error', () => {
      const config = {
        allowedUsers: ['123456789']
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(config));

      const pm = new PermissionManager(tempConfigPath, false);

      expect(() => pm.destroy()).not.toThrow();
    });
  });

  describe('file watching', () => {
    it('should reload config when file changes', (done) => {
      const initialConfig = {
        allowedUsers: ['123456789']
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(initialConfig));

      const pm = new PermissionManager(tempConfigPath, true);

      expect(pm.getAllowedUserCount()).toBe(1);

      // Wait a bit, then update the config
      setTimeout(() => {
        const updatedConfig = {
          allowedUsers: ['123456789', '987654321']
        };
        fs.writeFileSync(tempConfigPath, JSON.stringify(updatedConfig));

        // Wait for file watcher to trigger reload
        setTimeout(() => {
          expect(pm.getAllowedUserCount()).toBe(2);
          expect(pm.isUserAllowed('987654321')).toBe(true);
          pm.destroy();
          done();
        }, 500);
      }, 100);
    }, 10000); // 10 second timeout for this test
  });
});
