# Persistent Queue & Notification Scheduling Implementation Spec

## Overview
This specification outlines the implementation of a persistent queue system and notification scheduling for the Discord Home Server Bot. The goal is to ensure notifications are never lost and can be scheduled for future delivery.

## Key Requirements

### 1. Persistent Queue
- All notifications must be persisted to the database before processing
- Queue state must survive bot restarts
- Failed notifications should be retried with exponential backoff
- Queue should support priority levels (optional enhancement)

### 2. Notification Scheduling
- Support immediate delivery (default behavior)
- Support scheduled delivery at a specific datetime
- Support relative scheduling (e.g., "in 5 minutes", "in 2 hours")
- Scheduled notifications should be checked periodically and queued when due

### 3. Reliability
- Atomic operations for queue state transitions
- Retry logic with configurable max attempts
- Dead letter queue for permanently failed notifications
- Graceful handling of bot shutdown (persist in-flight notifications)

## Database Schema Changes

### Modified `notifications` Table
```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  scheduled_for DATETIME NOT NULL,  -- When to send (immediate = created_at)
  sent_at DATETIME,                 -- When actually sent
  source TEXT NOT NULL,
  title TEXT,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  discord_message_id TEXT,
  status TEXT DEFAULT 'pending',    -- pending, processing, sent, failed, cancelled
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error TEXT,
  metadata TEXT                     -- JSON for additional data
);

CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_scheduled_for ON notifications(scheduled_for);
CREATE INDEX idx_notifications_status_scheduled ON notifications(status, scheduled_for);
```

### New `notification_config` Table (Optional)
```sql
CREATE TABLE notification_config (
  source TEXT PRIMARY KEY,
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Architecture Changes

### File Structure
```
src/
├── index.ts                    # Main entry point (modify)
├── database.ts                 # Database class (modify extensively)
├── queue/
│   ├── persistentQueue.ts     # New: Persistent queue implementation
│   ├── scheduler.ts           # New: Notification scheduler
│   └── types.ts               # New: Shared types
├── webhook.ts                  # Webhook server (modify)
├── commands.ts                 # Command handler (modify + add new commands)
└── utils/
    ├── dateParser.ts          # New: Parse relative time strings
    └── retry.ts               # New: Retry logic with backoff
```

## Component Specifications

### 1. Database Class Extensions (`database.ts`)

#### New Methods Required:
```typescript
// Queue Operations
async saveNotificationToQueue(notification: NotificationInput): Promise<number>
async getNotificationById(id: number): Promise<QueuedNotification | null>
async updateNotificationStatus(id: number, status: NotificationStatus, error?: string): Promise<void>
async incrementRetryCount(id: number): Promise<void>

// Scheduling Operations
async getPendingNotifications(): Promise<QueuedNotification[]>
async getDueNotifications(beforeTime?: Date): Promise<QueuedNotification[]>
async getScheduledNotifications(limit?: number): Promise<QueuedNotification[]>

// Management Operations
async cancelNotification(id: number): Promise<boolean>
async retryFailedNotification(id: number): Promise<boolean>
async getFailedNotifications(limit?: number): Promise<QueuedNotification[]>
async cleanupOldNotifications(olderThanDays: number): Promise<number>

// Statistics
async getQueueStats(): Promise<QueueStats>
```

#### Types:
```typescript
interface NotificationInput {
  source: string;
  title?: string;
  message: string;
  severity?: 'info' | 'warning' | 'error';
  scheduledFor?: Date | string;  // ISO string or Date
  maxRetries?: number;
  metadata?: Record<string, any>;
}

interface QueuedNotification {
  id: number;
  createdAt: Date;
  scheduledFor: Date;
  sentAt?: Date;
  source: string;
  title?: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  discordMessageId?: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  metadata?: Record<string, any>;
}

type NotificationStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

interface QueueStats {
  pending: number;
  processing: number;
  scheduled: number;  // scheduled for future
  failed: number;
  sent24h: number;
}
```

### 2. Persistent Queue (`queue/persistentQueue.ts`)

#### Responsibilities:
- Initialize by loading pending notifications from database
- Process notifications in order of scheduled_for time
- Handle retry logic with exponential backoff
- Update notification status in database at each step
- Emit events for monitoring

#### Key Methods:
```typescript
class PersistentNotificationQueue {
  constructor(client: Client, database: Database, channelId: string);
  
  async initialize(): Promise<void>;
  async enqueue(notification: NotificationInput): Promise<number>; // Returns notification ID
  async processNotification(id: number): Promise<void>;
  async cancel(id: number): Promise<boolean>;
  async retry(id: number): Promise<boolean>;
  async shutdown(): Promise<void>;  // Graceful shutdown
  
  getStats(): QueueStats;
}
```

#### Processing Flow:
```
1. Load notification from DB by ID
2. Update status to 'processing'
3. Try to send to Discord:
   a. Success → Update status to 'sent', save discord_message_id, set sent_at
   b. Failure → Increment retry_count
      - If retry_count < max_retries: Update status back to 'pending', schedule retry
      - If retry_count >= max_retries: Update status to 'failed', save error
4. Commit transaction
```

#### Retry Strategy:
- Delay = base_delay * (2 ^ retry_count) seconds
- Base delay: 60 seconds (configurable)
- Max retries: 3 (configurable per notification)
- Example: 1min, 2min, 4min

### 3. Scheduler (`queue/scheduler.ts`)

#### Responsibilities:
- Periodically check database for due notifications
- Queue due notifications for processing
- Handle scheduled notifications (future delivery)

#### Key Methods:
```typescript
class NotificationScheduler {
  constructor(queue: PersistentNotificationQueue, database: Database);
  
  start(intervalSeconds?: number): void;
  stop(): void;
  async checkDueNotifications(): Promise<number>; // Returns count queued
}
```

#### Scheduler Logic:
```
Every 30 seconds (configurable):
1. Query database for notifications WHERE:
   - status = 'pending'
   - scheduled_for <= NOW()
2. For each notification:
   - Call queue.processNotification(id)
3. Log how many notifications were queued
```

### 4. Date Parser Utility (`utils/dateParser.ts`)

Parse human-readable time strings into Date objects:

```typescript
function parseScheduledTime(input: string | Date): Date;

// Examples:
// "now" or "immediate" → new Date()
// "5m" or "5 minutes" → now + 5 minutes
// "2h" or "2 hours" → now + 2 hours
// "1d" or "1 day" → now + 1 day
// "2024-12-25T10:00:00Z" → parse ISO string
// Date object → return as-is
```

### 5. Webhook Modifications (`webhook.ts`)

#### Changes to `/webhook/notify` endpoint:
```typescript
// Add support for scheduled_for parameter
POST /webhook/notify
{
  "source": "Home Assistant",
  "title": "Reminder",
  "message": "Take out trash",
  "severity": "info",
  "scheduled_for": "2h"  // NEW: optional scheduling
}

Response:
{
  "status": "queued",
  "notification_id": 123,
  "scheduled_for": "2024-11-12T15:30:00Z"
}
```

#### New Endpoints:
```typescript
// Cancel scheduled notification
DELETE /webhook/notify/:id
Response: { "status": "cancelled" }

// Get notification status
GET /webhook/notify/:id
Response: { ...notification details }

// Retry failed notification
POST /webhook/notify/:id/retry
Response: { "status": "retrying" }
```

### 6. Command Updates (`commands.ts`)

#### Modified Commands:
```typescript
/history [limit] [status]
// Add status filter: all, pending, sent, failed, scheduled

/status
// Enhanced to show:
// - Queue size by status
// - Scheduled notifications count
// - Failed notifications count
// - Next scheduled notification time
```

#### New Commands:
```typescript
/schedule <time> <source> <message>
// Schedule a notification
// Example: /schedule 2h "Reminder" "Check the oven"

/scheduled [limit]
// List upcoming scheduled notifications
// Shows: ID, scheduled time, source, message preview

/cancel <notification_id>
// Cancel a pending/scheduled notification

/retry <notification_id>
// Manually retry a failed notification

/failed [limit]
// Show failed notifications with error details

/queue-stats
// Detailed queue statistics and health
```

### 7. Main Entry Point Changes (`index.ts`)

```typescript
async function main() {
  // Initialize database
  await database.initialize();
  
  // Initialize persistent queue
  const queue = new PersistentNotificationQueue(client, database, CHANNEL_ID);
  await queue.initialize();
  
  // Initialize scheduler
  const scheduler = new NotificationScheduler(queue, database);
  scheduler.start(30); // Check every 30 seconds
  
  // Initialize command handler
  const commandHandler = new CommandHandler(client, database, queue);
  
  // Initialize webhook server
  const webhook = new WebhookServer(queue, WEBHOOK_SECRET);
  
  // Login and start
  await client.login(TOKEN);
  webhook.start(WEBHOOK_PORT);
}

// Enhanced graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  scheduler.stop();
  await queue.shutdown(); // Wait for in-flight notifications
  await client.destroy();
  await database.close();
  process.exit(0);
});
```

## Migration Strategy

Since backward compatibility is not required:

### Migration Steps:
1. Create backup of existing `data/bot.db`
2. Drop old `notifications` table
3. Create new `notifications` table with new schema
4. Create indexes
5. Optionally create `notification_config` table

### Migration SQL:
```sql
-- Backup existing data (optional)
CREATE TABLE notifications_backup AS SELECT * FROM notifications;

-- Drop and recreate
DROP TABLE notifications;

CREATE TABLE notifications (
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
);

CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_scheduled_for ON notifications(scheduled_for);
CREATE INDEX idx_notifications_status_scheduled ON notifications(status, scheduled_for);
```

## Configuration

### Environment Variables (add to `.env`):
```bash
# Queue Configuration
QUEUE_RETRY_BASE_DELAY=60        # Base retry delay in seconds
QUEUE_MAX_RETRIES=3               # Default max retries
QUEUE_SCHEDULER_INTERVAL=30      # Scheduler check interval in seconds
QUEUE_CLEANUP_DAYS=90            # Delete sent notifications after N days

# Optional
QUEUE_CONCURRENCY=1              # Parallel notification processing
```

## Testing Checklist

### Unit Tests Needed:
- [ ] Database queue operations (save, update, query)
- [ ] Date parser utility (all time formats)
- [ ] Retry logic with exponential backoff
- [ ] Scheduler due notification detection

### Integration Tests:
- [ ] Enqueue and process immediate notification
- [ ] Schedule notification for future delivery
- [ ] Notification retry after failure
- [ ] Bot restart with pending notifications
- [ ] Cancel scheduled notification
- [ ] Retry failed notification
- [ ] Webhook endpoints with scheduling

### Manual Testing:
- [ ] Send immediate notification via webhook
- [ ] Schedule notification for 1 minute from now
- [ ] Kill bot, restart, verify pending notifications process
- [ ] Disconnect Discord, verify retry logic works
- [ ] Use all new slash commands
- [ ] Verify queue statistics are accurate

## Error Handling

### Failure Scenarios:
1. **Discord API Error**: Retry with backoff, mark as failed after max retries
2. **Database Error**: Log error, attempt transaction rollback, alert admin
3. **Invalid Scheduled Time**: Return 400 error with clear message
4. **Bot Shutdown During Send**: Status remains 'processing', will retry on restart
5. **Notification Not Found**: Return 404 error

### Monitoring:
- Log all status transitions
- Track success/failure rates
- Alert on high failure rate (>10% in 1 hour)
- Monitor queue depth (alert if >100 pending)

## Performance Considerations

### Database:
- Index on `(status, scheduled_for)` for efficient scheduler queries
- Cleanup old sent notifications periodically (keep last 90 days)
- Use transactions for status updates

### Queue:
- Single concurrency prevents rate limiting issues
- Consider batching status updates if processing many notifications
- Scheduler interval balances responsiveness vs. database load

### Memory:
- Don't load all pending notifications into memory
- Process notifications one at a time
- Scheduler queries limited set of due notifications

## Future Enhancements

These can be added later:
- [ ] Priority levels (high, normal, low)
- [ ] Notification dependencies (send B after A succeeds)
- [ ] Batch notifications (combine multiple into one message)
- [ ] Custom retry strategies per source
- [ ] Notification rate limiting per source
- [ ] Webhook callbacks on notification delivery
- [ ] Notification preview/dry-run mode
- [ ] User notification preferences

## Success Criteria

Implementation is complete when:
1. ✅ All notifications persist to database before sending
2. ✅ Bot restart doesn't lose pending notifications
3. ✅ Failed notifications retry automatically
4. ✅ Notifications can be scheduled for future delivery
5. ✅ Webhook API supports scheduling parameter
6. ✅ New slash commands work correctly
7. ✅ Queue statistics are accurate
8. ✅ Graceful shutdown preserves queue state

## Example Usage

### Immediate Notification:
```bash
curl -X POST http://localhost:5000/webhook/notify \
  -H "Content-Type: application/json" \
  -d '{
    "source": "HomeAssistant",
    "message": "Front door opened"
  }'
```

### Scheduled Notification:
```bash
curl -X POST http://localhost:5000/webhook/notify \
  -H "Content-Type: application/json" \
  -d '{
    "source": "Reminder",
    "title": "Trash Day",
    "message": "Take out the trash",
    "scheduled_for": "6h"
  }'
```

### Check Status:
```bash
curl http://localhost:5000/webhook/notify/123
```

### Cancel Notification:
```bash
curl -X DELETE http://localhost:5000/webhook/notify/123
```

## Notes for Claude Code

- Focus on reliability and data integrity
- Use transactions for critical database operations
- Add comprehensive error logging
- Follow existing code style and patterns
- Test retry logic thoroughly
- Ensure graceful shutdown preserves all queue state
- Make scheduler interval configurable
- Add helpful log messages for debugging
- Consider adding JSDoc comments for public methods
- Validate all input dates/times before processing

## Questions to Consider During Implementation

1. Should we support recurring notifications? (e.g., daily reminder)
2. Should failed notifications block the queue or continue processing?
3. Do we need a web UI to manage the queue?
4. Should we add Prometheus metrics for monitoring?
5. Do we need notification templates?
6. Should we support notification editing after creation?
