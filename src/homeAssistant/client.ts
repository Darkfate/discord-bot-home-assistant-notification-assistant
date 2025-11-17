/**
 * Home Assistant API Client
 *
 * Handles communication with Home Assistant REST API including:
 * - Triggering automations
 * - Listing automations (with caching for autocomplete)
 * - Connection validation
 */

import type {
  HAAutomation,
  Automation,
  HAApiError,
  HAClientConfig,
} from './types.js';

export class HomeAssistantClient {
  private url: string;
  private accessToken: string;
  private timeout: number;
  private verifySsl: boolean;

  // Autocomplete cache
  private automationCache: Automation[] | null = null;
  private cacheExpiry: number = 0;
  private cacheTTL: number = 60000; // 60 seconds

  constructor(config: HAClientConfig) {
    this.url = config.url.replace(/\/$/, ''); // Remove trailing slash
    this.accessToken = config.accessToken;
    this.timeout = config.timeout ?? 10000;
    this.verifySsl = config.verifySsl ?? true;
  }

  /**
   * Trigger a Home Assistant automation
   */
  async triggerAutomation(automationId: string): Promise<void> {
    const response = await this.fetch(`/api/services/automation/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity_id: automationId,
      }),
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(`Failed to trigger automation ${automationId}: ${error.message}`);
    }
  }

  /**
   * List all automations from Home Assistant
   * @param useCache Whether to use cached data (for autocomplete)
   */
  async listAutomations(useCache: boolean = true): Promise<Automation[]> {
    const now = Date.now();

    // Return cached if valid
    if (useCache && this.automationCache && now < this.cacheExpiry) {
      return this.automationCache;
    }

    // Fetch fresh data
    const response = await this.fetch('/api/states');

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(`Failed to list automations: ${error.message}`);
    }

    const entities: HAAutomation[] = await response.json();

    // Filter for automation entities
    const automations: Automation[] = entities
      .filter(entity => entity.entity_id.startsWith('automation.'))
      .map(entity => ({
        entity_id: entity.entity_id,
        friendly_name: entity.attributes.friendly_name || entity.entity_id,
        state: entity.state,
        last_triggered: entity.attributes.last_triggered
          ? new Date(entity.attributes.last_triggered)
          : undefined,
      }))
      .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));

    // Update cache
    this.automationCache = automations;
    this.cacheExpiry = now + this.cacheTTL;

    return automations;
  }

  /**
   * Get a specific automation by entity ID
   */
  async getAutomation(automationId: string): Promise<Automation | null> {
    const response = await this.fetch(`/api/states/${automationId}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(`Failed to get automation ${automationId}: ${error.message}`);
    }

    const entity: HAAutomation = await response.json();

    return {
      entity_id: entity.entity_id,
      friendly_name: entity.attributes.friendly_name || entity.entity_id,
      state: entity.state,
      last_triggered: entity.attributes.last_triggered
        ? new Date(entity.attributes.last_triggered)
        : undefined,
    };
  }

  /**
   * Validate connection to Home Assistant
   */
  async validateConnection(): Promise<boolean> {
    try {
      const response = await this.fetch('/api/');

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.message === 'API running.';
    } catch (error) {
      console.error('Failed to validate HA connection:', error);
      return false;
    }
  }

  /**
   * Clear the automation cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.automationCache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Make a fetch request to Home Assistant API
   */
  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.url}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          ...init?.headers,
          'Authorization': `Bearer ${this.accessToken}`,
        },
        signal: controller.signal,
        // Note: Node.js fetch doesn't support rejectUnauthorized directly
        // SSL verification is controlled by NODE_TLS_REJECT_UNAUTHORIZED env var
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`Request to Home Assistant timed out after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Parse error response from Home Assistant API
   */
  private async parseError(response: Response): Promise<HAApiError> {
    try {
      const data = await response.json();
      return {
        message: data.message || response.statusText,
        code: data.code,
        statusCode: response.status,
      };
    } catch {
      return {
        message: response.statusText || 'Unknown error',
        statusCode: response.status,
      };
    }
  }
}

/**
 * Create a Home Assistant client from environment variables
 */
export function createHAClientFromEnv(): HomeAssistantClient | null {
  const url = process.env.HA_URL;
  const accessToken = process.env.HA_ACCESS_TOKEN;

  if (!url || !accessToken) {
    console.log('Home Assistant integration disabled (HA_URL or HA_ACCESS_TOKEN not set)');
    return null;
  }

  const verifySsl = process.env.HA_VERIFY_SSL !== 'false';
  const timeout = parseInt(process.env.HA_TIMEOUT || '10000', 10);

  // Handle SSL verification for Node.js fetch
  if (!verifySsl && !process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
    console.warn('Warning: SSL verification disabled for Home Assistant connection');
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  return new HomeAssistantClient({
    url,
    accessToken,
    verifySsl,
    timeout,
  });
}
