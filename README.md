# Discord Home Server Bot

A Discord bot designed for personal use with Home Assistant integration. Receives notifications from your home server via webhooks and sends them to a Discord channel with persistent queue and scheduling capabilities.

## Features

- **Persistent Queue**: All notifications are saved to database before sending - never lose a notification!
- **Notification Scheduling**: Schedule notifications for future delivery (e.g., "send in 2 hours")
- **Automatic Retries**: Failed notifications retry automatically with exponential backoff
- **Webhook API**: Receive notifications from Home Assistant or any service via HTTP POST
- **RESTful Management**: Query, cancel, and retry notifications via API
- **Comprehensive Slash Commands**: Manage notifications and view queue statistics directly in Discord
- **SQLite Database**: Persistent storage of notification history, queue state, and bot settings
- **Docker Support**: Easy containerization and deployment
- **Webhook Security**: Optional signature verification for incoming webhooks
- **Graceful Shutdown**: Bot waits for in-flight notifications before shutting down

## Quick Start

### Prerequisites

- Discord bot token (from Discord Developer Portal)
- Discord channel ID where notifications will be sent
- Docker and Docker Compose (for containerized deployment)
- Node.js 18+ (for local development)

### 1. Set Up Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" tab and click "Add Bot"
4. Under TOKEN, click "Copy" to copy your bot token
5. Under "PRIVILEGED GATEWAY INTENTS", enable:
   - Message Content Intent
   - Server Members Intent (optional, but recommended)
6. Go to "OAuth2" → "URL Generator"
7. Select scopes: `bot`, `applications.commands`
8. Select permissions: `Send Messages`, `Embed Links`, `Read Messages/View Channels`
9. Copy the generated URL and open it to invite the bot to your server

### 2. Get Your Discord Channel ID

1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click on the channel where you want notifications
3. Click "Copy Channel ID"

### 3. Configure Environment

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and add:
- `DISCORD_TOKEN`: Your bot token
- `DISCORD_CHANNEL_ID`: Your channel ID
- `WEBHOOK_SECRET`: A random secret for webhook verification (optional)

### 4. Initialize Data Directory

Run the setup script to create the data directory:

```bash
./setup.sh
```

Or manually create it:
```bash
mkdir -p data
```

**Note**: The Docker container automatically fixes permissions on startup, so you don't need to worry about file ownership.

### 5. Run with Docker Compose

```bash
docker compose up --build -d
```

Use `--build` to ensure the image is built with the latest changes. The bot will start and listen for webhooks on `http://localhost:5000`

### 6. Test It

Use the `/test` slash command in Discord, or send a webhook:

```bash
curl -X POST http://localhost:5000/webhook/notify \
  -H "Content-Type: application/json" \
  -d '{
    "source": "Test",
    "title": "Hello!",
    "message": "This is a test notification",
    "severity": "info"
  }'
```

## Webhook API

### Send Notification

**Endpoint**: `POST /webhook/notify`

**Body**:
```json
{
  "source": "Home Assistant",
  "title": "Front Door",
  "message": "Motion detected",
  "severity": "warning",
  "scheduled_for": "2h"
}
```

**Fields**:
- `source` (required): Source of the notification (e.g., "Home Assistant", "Server")
- `title` (optional): Notification title
- `message` (required): Notification message
- `severity` (optional): One of `info`, `warning`, `error` (default: `info`)
- `scheduled_for` (optional): When to send the notification. Accepts:
  - Relative time: `"5m"`, `"2h"`, `"1d"` (minutes, hours, days)
  - Long form: `"5 minutes"`, `"2 hours"`, `"1 day"`
  - ISO 8601: `"2024-12-25T10:00:00Z"`
  - `"now"` or `"immediate"` for instant delivery (default)

**Response**: `202 Accepted`
```json
{
  "status": "queued",
  "notification_id": 42,
  "queue_size": 1,
  "scheduled_for": "2024-11-12T15:00:00.000Z",
  "scheduled_in": "in 2 hours"
}
```

### Get Notification Status

**Endpoint**: `GET /webhook/notify/:id`

**Response**: `200 OK`
```json
{
  "id": 42,
  "source": "Home Assistant",
  "title": "Front Door",
  "message": "Motion detected",
  "severity": "warning",
  "status": "sent",
  "created_at": "2024-11-12T13:00:00.000Z",
  "scheduled_for": "2024-11-12T15:00:00.000Z",
  "sent_at": "2024-11-12T15:00:01.000Z",
  "retry_count": 0,
  "max_retries": 3,
  "last_error": null,
  "discord_message_id": "1234567890"
}
```

### Cancel Notification

**Endpoint**: `DELETE /webhook/notify/:id`

Cancels a pending or scheduled notification.

**Response**: `200 OK`
```json
{
  "status": "cancelled",
  "notification_id": 42
}
```

### Retry Failed Notification

**Endpoint**: `POST /webhook/notify/:id/retry`

Manually retry a failed notification.

**Response**: `200 OK`
```json
{
  "status": "retrying",
  "notification_id": 42
}
```

### Health Check

**Endpoint**: `GET /health`

**Response**: `200 OK`
```json
{
  "status": "ok"
}
```

## Slash Commands

### Basic Commands
- `/ping`: Responds with pong (useful for testing)
- `/test`: Sends a test notification
- `/status`: Shows detailed bot and queue status with statistics
- `/history [limit] [status]`: Shows recent notifications (default: 10, max: 20)
  - Filter by status: `all`, `pending`, `sent`, `failed`, `cancelled`

### Queue Management
- `/schedule <time> <source> <message> [title] [severity]`: Schedule a notification
  - Example: `/schedule time:"2h" source:"Reminder" message:"Check the oven"`
- `/scheduled [limit]`: List upcoming scheduled notifications
- `/cancel <id>`: Cancel a pending or scheduled notification
- `/retry <id>`: Manually retry a failed notification
- `/failed [limit]`: Show failed notifications with error details
- `/queue-stats`: Detailed queue statistics and health monitoring

## Notification Scheduling Examples

### Using Webhooks

**Schedule a reminder for 2 hours from now:**
```bash
curl -X POST http://localhost:5000/webhook/notify \
  -H "Content-Type: application/json" \
  -d '{
    "source": "Reminder",
    "title": "Trash Day",
    "message": "Take out the trash",
    "scheduled_for": "2h"
  }'
```

**Schedule for specific date and time:**
```bash
curl -X POST http://localhost:5000/webhook/notify \
  -H "Content-Type: application/json" \
  -d '{
    "source": "Calendar",
    "message": "Meeting with team",
    "scheduled_for": "2024-12-25T10:00:00Z"
  }'
```

### Using Discord Commands

```
/schedule time:"5m" source:"Test" message:"Quick reminder"
/schedule time:"1d" source:"Daily" message:"Daily standup" severity:"info"
/scheduled
/cancel id:42
```

## Home Assistant Integration

### Send Immediate Notifications

```yaml
automation:
  - alias: "Discord notification - door opened"
    trigger:
      platform: state
      entity_id: binary_sensor.front_door
      to: "on"
    action:
      - service: rest_command.discord_notify
        data:
          source: "Home Assistant"
          title: "Security Alert"
          message: "Front door opened"
          severity: "warning"
```

Add to `configuration.yaml`:
```yaml
rest_command:
  discord_notify:
    url: http://discord-bot:5000/webhook/notify
    method: POST
    headers:
      Content-Type: application/json
    payload: >
      {
        "source": "{{ source }}",
        "title": "{{ title }}",
        "message": "{{ message }}",
        "severity": "{{ severity | default('info') }}"
      }
```

### Send Scheduled Notifications

```yaml
automation:
  - alias: "Discord notification - water plants reminder"
    trigger:
      platform: time
      at: "08:00:00"
    action:
      - service: rest_command.discord_schedule
        data:
          source: "Home Assistant"
          message: "Don't forget to water the plants!"
          scheduled_for: "2h"
```

Add to `configuration.yaml`:
```yaml
rest_command:
  discord_schedule:
    url: http://discord-bot:5000/webhook/notify
    method: POST
    headers:
      Content-Type: application/json
    payload: >
      {
        "source": "{{ source }}",
        "message": "{{ message }}",
        "scheduled_for": "{{ scheduled_for }}"
      }
```

## Database

The bot uses SQLite to store:
- **Notification Queue**: All notifications with status, retry count, and scheduling info
- **Notification History**: Complete record of all sent/failed notifications
- **Bot State**: Settings and configuration

Database file location: `./data/bot.db` (mounted in Docker)

### Database Schema

**Notifications Table**:
- `id`: Unique identifier
- `created_at`: When notification was created
- `scheduled_for`: When notification should be sent
- `sent_at`: When notification was actually sent
- `source`: Source of the notification
- `title`: Optional title
- `message`: Notification message
- `severity`: info, warning, or error
- `discord_message_id`: Discord message ID after sending
- `status`: pending, processing, sent, failed, or cancelled
- `retry_count`: Number of retry attempts
- `max_retries`: Maximum retries allowed
- `last_error`: Error message from last failure
- `metadata`: JSON field for additional data

### Query Examples

```bash
# Connect to database
sqlite3 data/bot.db

# View recent notifications with status
SELECT id, source, status, scheduled_for, sent_at
FROM notifications
ORDER BY created_at DESC
LIMIT 10;

# Check queue health
SELECT status, COUNT(*) as count
FROM notifications
GROUP BY status;

# View failed notifications
SELECT id, source, message, retry_count, last_error
FROM notifications
WHERE status = 'failed'
ORDER BY created_at DESC;

# View scheduled notifications
SELECT id, source, message, scheduled_for
FROM notifications
WHERE status = 'pending' AND scheduled_for > datetime('now')
ORDER BY scheduled_for ASC;
```

## Queue System

### How It Works

1. **Persistent Storage**: All notifications are saved to the database immediately
2. **Scheduled Processing**: A scheduler checks every 30 seconds for due notifications
3. **Automatic Retry**: Failed notifications retry with exponential backoff (60s, 120s, 240s)
4. **State Management**: Notifications go through states: `pending` → `processing` → `sent` (or `failed`)
5. **Graceful Restart**: On bot restart, pending/processing notifications are automatically recovered

### Configuration

Set these environment variables to customize queue behavior:

```bash
QUEUE_RETRY_BASE_DELAY=60        # Base delay between retries (seconds)
QUEUE_MAX_RETRIES=3               # Maximum retry attempts per notification
QUEUE_SCHEDULER_INTERVAL=30       # How often to check for due notifications (seconds)
QUEUE_CLEANUP_DAYS=90             # Delete old sent notifications after N days
```

### Monitoring

Use `/queue-stats` to monitor:
- Pending notifications (due now)
- Processing notifications
- Scheduled notifications (future)
- Failed notifications
- Sent count (last 24 hours)
- Health status indicator

## Development

### Local Setup

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Linting

```bash
npm run lint
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DISCORD_TOKEN` | Discord bot token | ✅ | - |
| `DISCORD_CHANNEL_ID` | Channel ID for notifications | ✅ | - |
| `WEBHOOK_PORT` | Port for webhook server | ❌ | 5000 |
| `WEBHOOK_SECRET` | Secret for webhook verification | ❌ | - |
| `DATABASE_PATH` | Path to SQLite database | ❌ | ./data/bot.db |
| `LOG_LEVEL` | Logging level | ❌ | info |
| `QUEUE_RETRY_BASE_DELAY` | Base retry delay (seconds) | ❌ | 60 |
| `QUEUE_MAX_RETRIES` | Max retry attempts | ❌ | 3 |
| `QUEUE_SCHEDULER_INTERVAL` | Scheduler check interval (seconds) | ❌ | 30 |
| `QUEUE_CLEANUP_DAYS` | Delete old notifications after N days | ❌ | 90 |

## Troubleshooting

### Bot doesn't connect to Discord
- Check `DISCORD_TOKEN` is correct
- Ensure bot has all required intents enabled in Developer Portal
- Check bot has permission to send messages in the channel

### Webhooks not working
- Verify `DISCORD_CHANNEL_ID` is correct
- Check webhook server is running: `curl http://localhost:5000/health`
- Check firewall allows port 5000
- Check database is writable (permissions on `./data` directory)

### Database "SQLITE_READONLY" or "SQLITE_CANTOPEN" errors
- These errors occur when the Docker container can't access the database file
- **Solution**: The container now automatically fixes permissions on startup
- If you still encounter issues:
  1. Ensure the `data` directory exists: `mkdir -p data`
  2. Rebuild and restart the container: `docker compose up --build -d`
  3. Check container logs: `docker compose logs discord-bot`
- The entrypoint script automatically sets correct ownership for the nodejs user (uid 1001)

### Commands not showing up
- Give it a few seconds after bot starts
- Try restarting the bot or Discord client
- Verify bot has `/applications.commands` scope

### Notifications not sending
- Check `/status` command to see queue health
- Check `/failed` command to see error details
- Query database to check notification status:
  ```sql
  SELECT id, status, retry_count, last_error FROM notifications WHERE status != 'sent';
  ```
- Check Discord bot has permission to send embeds in the channel

### Scheduled notifications not processing
- Check scheduler is running (bot logs should show scheduler initialization)
- Verify `QUEUE_SCHEDULER_INTERVAL` is set correctly
- Check database for pending scheduled notifications:
  ```sql
  SELECT * FROM notifications WHERE status = 'pending' AND scheduled_for <= datetime('now');
  ```

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
docker-compose up -d
```

### Build image manually

```bash
docker build -t discord-home-bot .
```

### Run standalone

```bash
docker run -d \
  --name discord-home-bot \
  -e DISCORD_TOKEN=your_token \
  -e DISCORD_CHANNEL_ID=your_channel_id \
  -e QUEUE_SCHEDULER_INTERVAL=30 \
  -p 5000:5000 \
  -v discord-bot-data:/app/data \
  discord-home-bot
```

## Security Notes

- Keep `DISCORD_TOKEN` secret and never commit it to version control
- Use `WEBHOOK_SECRET` to verify webhook requests in production
- The webhook endpoint is publicly accessible—use the secret or firewall rules to restrict access
- For production deployment, use HTTPS and a reverse proxy (e.g., nginx)
- Consider rate limiting on the webhook endpoint to prevent abuse
- Regularly backup the database file (`./data/bot.db`)

## Architecture

The bot uses a three-layer architecture:

1. **Database Layer** (`database.ts`): Handles all persistence and data integrity
2. **Queue Layer** (`queue/`): Manages notification processing, retry logic, and scheduling
3. **API Layer** (`webhook.ts`, `commands.ts`): Handles incoming requests and user interactions

All state transitions are atomic and logged for monitoring. The persistent queue ensures no notifications are lost, even during bot restarts or Discord outages.

## License

MIT
