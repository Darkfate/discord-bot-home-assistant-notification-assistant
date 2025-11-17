/**
 * Home Assistant Integration Types
 */

/**
 * Home Assistant automation entity from API
 */
export interface HAAutomation {
  entity_id: string;
  state: 'on' | 'off';
  attributes: {
    friendly_name: string;
    last_triggered?: string;
    id?: string;
  };
}

/**
 * Simplified automation for internal use
 */
export interface Automation {
  entity_id: string;
  friendly_name: string;
  state: 'on' | 'off';
  last_triggered?: Date;
}

/**
 * Automation trigger status
 */
export type AutomationTriggerStatus =
  | 'pending'
  | 'processing'
  | 'triggered'
  | 'failed'
  | 'cancelled';

/**
 * Input for creating a new automation trigger
 */
export interface AutomationTriggerInput {
  automationId: string;
  automationName?: string;
  scheduledFor: string | Date;
  triggeredBy: string; // Discord user ID
  notifyOnComplete?: boolean;
  maxRetries?: number;
}

/**
 * Database record for automation trigger
 */
export interface AutomationTrigger {
  id: number;
  createdAt: Date;
  scheduledFor: Date;
  triggeredAt: Date | null;
  automationId: string;
  automationName: string | null;
  status: AutomationTriggerStatus;
  triggeredBy: string;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  notificationId: number | null;
  notifyOnComplete: boolean;
}

/**
 * Home Assistant API error
 */
export interface HAApiError {
  message: string;
  code?: string;
  statusCode?: number;
}

/**
 * Home Assistant client configuration
 */
export interface HAClientConfig {
  url: string;
  accessToken: string;
  verifySsl?: boolean;
  timeout?: number;
}

/**
 * Query options for automation triggers
 */
export interface AutomationTriggerQueryOptions {
  limit?: number;
  offset?: number;
  status?: AutomationTriggerStatus | 'all';
  triggeredBy?: string;
  automationId?: string;
  scheduledAfter?: Date;
  scheduledBefore?: Date;
}
