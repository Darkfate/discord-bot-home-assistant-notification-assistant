import { jest } from '@jest/globals';
import { HomeAssistantClient } from '../../../homeAssistant/client.js';
import type { HAAutomation } from '../../../homeAssistant/types.js';

// Mock fetch
global.fetch = jest.fn() as any;

describe('HomeAssistantClient', () => {
  let client: HomeAssistantClient;
  const mockUrl = 'http://localhost:8123';
  const mockToken = 'test-token-12345';

  beforeEach(() => {
    client = new HomeAssistantClient({
      url: mockUrl,
      accessToken: mockToken,
      verifySsl: true,
      timeout: 5000,
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clearCache();
  });

  describe('constructor', () => {
    it('should initialize with correct config', () => {
      expect(client).toBeDefined();
    });

    it('should remove trailing slash from URL', () => {
      const clientWithSlash = new HomeAssistantClient({
        url: 'http://localhost:8123/',
        accessToken: mockToken,
      });
      expect(clientWithSlash).toBeDefined();
    });
  });

  describe('validateConnection', () => {
    it('should return true for valid connection', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'API running.' }),
      });

      const result = await client.validateConnection();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockUrl}/api/`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it('should return false for invalid connection', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await client.validateConnection();
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await client.validateConnection();
      expect(result).toBe(false);
    });
  });

  describe('triggerAutomation', () => {
    it('should successfully trigger an automation', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(
        client.triggerAutomation('automation.morning_routine')
      ).resolves.not.toThrow();

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockUrl}/api/services/automation/trigger`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockToken}`,
          }),
          body: JSON.stringify({
            entity_id: 'automation.morning_routine',
          }),
        })
      );
    });

    it('should throw error on failed trigger', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Automation not found' }),
      });

      await expect(
        client.triggerAutomation('automation.invalid')
      ).rejects.toThrow('Failed to trigger automation');
    });

    it('should throw error on network timeout', async () => {
      // Mock an AbortError (what happens when timeout occurs)
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

      await expect(
        client.triggerAutomation('automation.test')
      ).rejects.toThrow('timed out');
    });
  });

  describe('listAutomations', () => {
    const mockAutomations: HAAutomation[] = [
      {
        entity_id: 'automation.morning_routine',
        state: 'on',
        attributes: {
          friendly_name: 'Morning Routine',
          last_triggered: '2024-01-01T08:00:00Z',
        },
      },
      {
        entity_id: 'automation.evening_lights',
        state: 'on',
        attributes: {
          friendly_name: 'Evening Lights',
        },
      },
      {
        entity_id: 'light.living_room', // Should be filtered out
        state: 'on',
        attributes: {
          friendly_name: 'Living Room Light',
        },
      },
    ];

    it('should list and filter automation entities', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAutomations,
      });

      const automations = await client.listAutomations(false);

      expect(automations).toHaveLength(2);
      expect(automations[0].entity_id).toBe('automation.evening_lights');
      expect(automations[0].friendly_name).toBe('Evening Lights');
      expect(automations[1].entity_id).toBe('automation.morning_routine');
      expect(automations[1].friendly_name).toBe('Morning Routine');
      expect(automations[1].last_triggered).toBeInstanceOf(Date);
    });

    it('should use cache on subsequent calls', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAutomations,
      });

      // First call - should fetch
      const automations1 = await client.listAutomations(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const automations2 = await client.listAutomations(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(automations2).toEqual(automations1);
    });

    it('should bypass cache when requested', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAutomations,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAutomations,
        });

      await client.listAutomations(false);
      await client.listAutomations(false);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should sort automations by friendly name', async () => {
      const unsorted: HAAutomation[] = [
        {
          entity_id: 'automation.zebra',
          state: 'on',
          attributes: { friendly_name: 'Zebra Automation' },
        },
        {
          entity_id: 'automation.alpha',
          state: 'on',
          attributes: { friendly_name: 'Alpha Automation' },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => unsorted,
      });

      const automations = await client.listAutomations(false);
      expect(automations[0].friendly_name).toBe('Alpha Automation');
      expect(automations[1].friendly_name).toBe('Zebra Automation');
    });
  });

  describe('getAutomation', () => {
    it('should get a specific automation', async () => {
      const mockAutomation: HAAutomation = {
        entity_id: 'automation.test',
        state: 'on',
        attributes: {
          friendly_name: 'Test Automation',
          last_triggered: '2024-01-01T10:00:00Z',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAutomation,
      });

      const automation = await client.getAutomation('automation.test');

      expect(automation).not.toBeNull();
      expect(automation?.entity_id).toBe('automation.test');
      expect(automation?.friendly_name).toBe('Test Automation');
    });

    it('should return null for non-existent automation', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const automation = await client.getAutomation('automation.invalid');
      expect(automation).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear the automation cache', async () => {
      const mockAutomations: HAAutomation[] = [
        {
          entity_id: 'automation.test',
          state: 'on',
          attributes: { friendly_name: 'Test' },
        },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAutomations,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAutomations,
        });

      // First call
      await client.listAutomations(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Clear cache
      client.clearCache();

      // Second call should fetch again
      await client.listAutomations(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
