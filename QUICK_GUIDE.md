# Quick Implementation Guide

## Implementation Order

Follow this order to minimize breaking changes and allow incremental testing:

### Phase 1: Database Foundation (Start Here)
1. **Update `database.ts`**:
   - Add migration logic to drop and recreate `notifications` table
   - Implement all new database methods (saveNotificationToQueue, getDueNotifications, etc.)
   - Add proper error handling and transactions
   - Test database operations independently

### Phase 2: Core Queue System
2. **Create `src/queue/types.ts`**:
   - Define all TypeScript interfaces and types
   - Export shared types for use across modules

3. **Create `src/utils/dateParser.ts`**:
   - Implement parseScheduledTime function
   - Support formats: "5m", "2h", "1d", ISO strings, Date objects
   - Test thoroughly with unit tests

4. **Create `src/queue/persistentQueue.ts`**:
   - Implement PersistentNotificationQueue class
   - Focus on core enqueue and processNotification methods
   - Add retry logic with exponential backoff
   - Implement graceful shutdown

### Phase 3: Scheduler
5. **Create `src/queue/scheduler.ts`**:
   - Implement NotificationScheduler class
   - Add periodic checking for due notifications
   - Integrate with PersistentNotificationQueue

### Phase 4: Integration
6. **Update `src/index.ts`**:
   - Replace old NotificationQueue with PersistentNotificationQueue
   - Initialize scheduler
   - Update graceful shutdown logic
   - Remove old queue.ts file

7. **Update `src/webhook.ts`**:
   - Modify POST /webhook/notify to accept scheduled_for
   - Add new endpoints: GET, DELETE, POST /retry
   - Update to use new queue.enqueue method

8. **Update `src/commands.ts`**:
   - Modify existing commands (/history, /status)
   - Add new commands (/schedule, /scheduled, /cancel, /retry, /failed, /queue-stats)

### Phase 5: Testing & Cleanup
9. **Test thoroughly**:
   - Test each component independently
   - Test integration between components
   - Test failure scenarios and retries
   - Test bot restart with pending notifications

10. **Cleanup**:
    - Remove old `src/queue.ts` file
    - Update README.md with new features
    - Add environment variables to .env.example

## Key Implementation Details

### Database Transactions
Always use transactions for critical operations:

```typescript
// Example pattern for status updates
async updateNotificationStatus(id: number, status: string, error?: string) {
  return new Promise((resolve, reject) => {
    this.db!.serialize(() => {
      this.db!.run('BEGIN TRANSACTION');
      
      this.db!.run(
        'UPDATE notifications SET status = ?, last_error = ?, sent_at = ? WHERE id = ?',
        [status, error || null, status === 'sent' ? new Date().toISOString() : null, id],
        (err) => {
          if (err) {
            this.db!.run('ROLLBACK');
            reject(err);
          } else {
            this.db!.run('COMMIT');
            resolve();
          }
        }
      );
    });
  });
}
```

### Retry Logic Pattern
```typescript
private async scheduleRetry(notification: QueuedNotification): Promise<void> {
  const retryDelay = this.calculateRetryDelay(notification.retryCount);
  const scheduledFor = new Date(Date.now() + retryDelay * 1000);
  
  await this.database.updateNotificationStatus(notification.id, 'pending');
  await this.database.incrementRetryCount(notification.id);
  
  console.log(`Scheduling retry for notification ${notification.id} in ${retryDelay}s`);
}

private calculateRetryDelay(retryCount: number): number {
  const baseDelay = parseInt(process.env.QUEUE_RETRY_BASE_DELAY || '60');
  return baseDelay * Math.pow(2, retryCount);
}
```

### Scheduler Pattern
```typescript
private schedulerInterval: NodeJS.Timeout | null = null;

start(intervalSeconds: number = 30): void {
  if (this.schedulerInterval) {
    console.log('Scheduler already running');
    return;
  }

  console.log(`Starting scheduler (checking every ${intervalSeconds}s)`);
  
  // Check immediately on start
  this.checkDueNotifications();
  
  // Then check periodically
  this.schedulerInterval = setInterval(() => {
    this.checkDueNotifications();
  }, intervalSeconds * 1000);
}

stop(): void {
  if (this.schedulerInterval) {
    clearInterval(this.schedulerInterval);
    this.schedulerInterval = null;
    console.log('Scheduler stopped');
  }
}
```

### Date Parser Examples
```typescript
export function parseScheduledTime(input: string | Date): Date {
  // If already a Date object, return it
  if (input instanceof Date) {
    return input;
  }

  const now = new Date();
  
  // Handle "now" or "immediate"
  if (input === 'now' || input === 'immediate') {
    return now;
  }

  // Handle relative time formats: "5m", "2h", "1d"
  const relativeMatch = input.match(/^(\d+)(m|h|d)$/);
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2];
    
    switch (unit) {
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    }
  }

  // Handle ISO string or parse as date
  try {
    const parsed = new Date(input);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date format: ${input}`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`Unable to parse date: ${input}`);
  }
}
```

## Testing Commands

### Test Immediate Notification:
```bash
curl -X POST http://localhost:5000/webhook/notify \
  -H "Content-Type: application/json" \
  -d '{"source":"Test","message":"Immediate notification"}'
```

### Test Scheduled Notification (1 minute):
```bash
curl -X POST http://localhost:5000/webhook/notify \
  -H "Content-Type: application/json" \
  -d '{"source":"Test","message":"Scheduled for 1 minute","scheduled_for":"1m"}'
```

### Check Notification Status:
```bash
curl http://localhost:5000/webhook/notify/1
```

### Cancel Notification:
```bash
curl -X DELETE http://localhost:5000/webhook/notify/1
```

### Retry Failed Notification:
```bash
curl -X POST http://localhost:5000/webhook/notify/1/retry
```

## Common Pitfalls to Avoid

1. **Don't forget to handle 'processing' status on restart**:
   - Notifications left in 'processing' state should be retried on bot restart
   - Add this to queue initialization

2. **Date handling**:
   - SQLite stores dates as strings, convert properly
   - Use ISO format: `new Date().toISOString()`
   - Parse back: `new Date(row.scheduled_for)`

3. **Race conditions**:
   - Use single concurrency in p-queue
   - Don't process same notification twice
   - Check status before processing

4. **Memory leaks**:
   - Clear interval timers on shutdown
   - Close database connections
   - Drain queue before exit

5. **Error messages**:
   - Store meaningful error messages in last_error column
   - Include error stack trace for debugging
   - Don't expose internal errors to webhook API

## Environment Variable Updates

Add to `.env.example`:
```bash
# Queue Configuration (optional)
QUEUE_RETRY_BASE_DELAY=60
QUEUE_MAX_RETRIES=3
QUEUE_SCHEDULER_INTERVAL=30
QUEUE_CLEANUP_DAYS=90
```

## Docker Considerations

The implementation should work seamlessly with Docker since:
- Database is already persisted via volume mount
- No additional ports needed
- Environment variables already supported
- Graceful shutdown works with Docker stop signals

## Success Validation

After implementation, verify:
1. ✅ Send immediate notification → appears in Discord instantly
2. ✅ Schedule notification for 1 minute → appears after 1 minute
3. ✅ Kill bot mid-send → notification retries after restart
4. ✅ Disconnect Discord → notification retries automatically
5. ✅ Check /status → shows accurate queue statistics
6. ✅ Use /scheduled → lists future notifications
7. ✅ Use /cancel → removes pending notification
8. ✅ Database persists between restarts

## Debugging Tips

Enable verbose logging:
```typescript
// In queue processing
console.log(`[Queue] Processing notification ${id}, status: ${status}`);
console.log(`[Queue] Retry ${retryCount}/${maxRetries}`);

// In scheduler
console.log(`[Scheduler] Found ${dueNotifications.length} due notifications`);

// In database
console.log(`[DB] Notification ${id} status: ${oldStatus} → ${newStatus}`);
```

Query database directly:
```bash
sqlite3 data/bot.db "SELECT id, source, status, scheduled_for FROM notifications ORDER BY id DESC LIMIT 10;"
```

## Next Steps After Implementation

1. Monitor for a few days to ensure stability
2. Add Prometheus metrics for production monitoring
3. Consider adding a web dashboard
4. Implement notification templates
5. Add support for recurring notifications
6. Implement priority levels
