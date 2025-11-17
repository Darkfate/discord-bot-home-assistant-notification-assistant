# Discord Home Server Bot

A Discord bot designed for personal use with Home Assistant integration. Receives notifications from your home server via webhooks and sends them to a Discord channel with persistent queue and scheduling capabilities.

## Features

- **Persistent Queue**: All notifications are saved to database before sending - never lose a notification!
- **Notification Scheduling**: Schedule notifications for future delivery (e.g., "send in 2 hours")
- **Home Assistant Automation Triggers**: Trigger HA automations from Discord with scheduling and autocomplete
- **Automatic Retries**: Failed notifications and automation triggers retry automatically with exponential backoff
- **Webhook API**: Receive notifications from Home Assistant or any service via HTTP POST
- **RESTful Management**: Query, cancel, and retry notifications via API
- **Comprehensive Slash Commands**: Manage notifications, trigger automations, and view queue statistics directly in Discord
- **SQLite Database**: Persistent storage of notification history, automation triggers, queue state, and bot settings
- **Docker Support**: Easy containerization and deployment
- **Webhook Security**: Optional signature verification for incoming webhooks
- **Graceful Shutdown**: Bot waits for in-flight notifications and automation triggers before shutting down

## Quick Start

### Prerequisites

**Required:**
- Discord bot token (from Discord Developer Portal)
- Discord channel ID where notifications will be sent
- Docker and Docker Compose (for containerized deployment)
- Node.js 22+ (for local development)

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

### 4. Choose Your Deployment Method

You can run the bot either with Docker (recommended for production) or locally for development.

#### Option A: Run Locally (No Docker Required)

1. **Prerequisites**: Ensure you have Node.js 22+ installed
   ```bash
   node --version  # Should be v22.0.0 or higher
   ```

2. **Run the local setup script**:

   **On Windows:**
   ```cmd
   run-local.bat
   ```

   **On Linux/Mac:**
   ```bash
   ./run-local.sh
   ```

   The script will:
   - Check Node.js version
   - Create `.env` file if needed (prompts you to configure it)
   - Create data directory
   - Install dependencies
   - Start the bot in development mode

3. **That's it!** The bot will start and listen for webhooks on `http://localhost:5000`

**Manual Setup** (if you prefer not to use the script):

**On Windows:**
```cmd
# 1. Copy environment file
copy .env.example .env

# 2. Edit .env and add your Discord token and channel ID
notepad .env

# 3. Create data directory
mkdir data

# 4. Install dependencies
npm install

# 5. Start the bot
npm run dev
```

**On Linux/Mac:**
```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env and add your Discord token and channel ID
nano .env  # or use your preferred editor

# 3. Create data directory
mkdir -p data

# 4. Install dependencies
npm install

# 5. Start the bot
npm run dev
```

#### Option B: Run with Docker Compose

1. **Initialize data and config directories**:
   ```bash
   ./setup.sh
   ```
   Or manually:
   ```bash
   mkdir -p data
   mkdir -p config
   ```

   **Note**: The Docker container automatically fixes permissions on startup.

2. **(Optional) Set up Home Assistant permissions**:
   If using Home Assistant integration, create the permissions config:
   ```bash
   cp config/ha-permissions.json.example config/ha-permissions.json
   # Edit config/ha-permissions.json and add your Discord user IDs
   ```

3. **Start with Docker Compose**:
   ```bash
   docker compose up --build -d
   ```

   Use `--build` to ensure the image is built with the latest changes. The bot will start and listen for webhooks on `http://localhost:5000`

### 5. Test It

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

### Get Queue Statistics

**Endpoint**: `GET /webhook/stats`

Get queue statistics with health indicator.

**Response**: `200 OK`
```json
{
  "pending": 2,
  "processing": 0,
  "scheduled": 5,
  "failed": 0,
  "sent24h": 42,
  "health": "healthy"
}
```

**Health Indicators**:
- `healthy`: No failed notifications
- `degraded`: 1-5 failed notifications
- `unhealthy`: 6+ failed notifications

### List Notifications

**Endpoint**: `GET /webhook/notifications`

Query notifications with filtering, search, and pagination.

**Query Parameters**:
- `status` (optional): Filter by status (`pending`, `sent`, `failed`, `cancelled`)
- `source` (optional): Filter by notification source
- `search` (optional): Full-text search in message and title
- `limit` (optional): Number of results per page (default: 10)
- `offset` (optional): Number of results to skip (default: 0)
- `sort` (optional): Sort field (`created_at`, `scheduled_for`, `sent_at`, `status`)
- `order` (optional): Sort order (`ASC`, `DESC`)

**Response**: `200 OK`
```json
{
  "notifications": [...],
  "total": 100,
  "page": 1,
  "limit": 10
}
```

**Example**:
```bash
# Get all failed notifications
curl "http://localhost:5000/webhook/notifications?status=failed&limit=20"

# Search notifications
curl "http://localhost:5000/webhook/notifications?search=door&limit=10"
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
- `/remind <time> <message>`: Set a reminder to be sent later
  - Example: `/remind time:"2h" message:"Check the oven"`
  - Example: `/remind time:"30m" message:"Meeting in 30 minutes"`
- `/schedule <time> <source> <message> [title] [severity]`: Schedule a notification
  - Example: `/schedule time:"2h" source:"Reminder" message:"Check the oven"`
- `/scheduled [limit]`: List upcoming scheduled notifications
- `/cancel <id>`: Cancel a pending or scheduled notification
- `/retry <id>`: Manually retry a failed notification
- `/failed [limit]`: Show failed notifications with error details
- `/queue-stats`: Detailed queue statistics and health monitoring

### Home Assistant Automation Control
- `/ha-trigger <automation_id> [time] [notify]`: Trigger a Home Assistant automation (with autocomplete!)
  - Example: `/ha-trigger automation_id:"automation.morning_routine" time:"now" notify:true`
  - Example: `/ha-trigger automation_id:"automation.evening_lights" time:"6h"`
- `/ha-test`: Test connection to Home Assistant
- `/ha-scheduled [limit]`: List scheduled automation triggers
- `/ha-cancel <id>`: Cancel a pending automation trigger
- `/ha-history [limit] [status]`: View automation trigger history

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

**Set a simple reminder:**
```
/remind time:"5m" message:"Quick reminder"
/remind time:"2h" message:"Check the oven"
/remind time:"1d" message:"Call mom"
```

**Schedule a notification with more options:**
```
/schedule time:"5m" source:"Test" message:"Quick reminder"
/schedule time:"1d" source:"Daily" message:"Daily standup" severity:"info"
```

**Manage scheduled notifications:**
```
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

### Trigger Home Assistant Automations from Discord

The bot can trigger Home Assistant automations directly from Discord commands, with support for scheduling and autocomplete.

#### Setup

1. **Get a Long-Lived Access Token from Home Assistant:**
   - In Home Assistant, go to your profile (click your username in the bottom left)
   - Scroll down to "Long-Lived Access Tokens"
   - Click "Create Token"
   - Give it a name like "Discord Bot"
   - Copy the token (you won't be able to see it again!)

2. **Add Home Assistant configuration to `.env`:**
   ```bash
   HA_URL=http://homeassistant.local:8123
   HA_ACCESS_TOKEN=your_long_lived_access_token_here
   HA_VERIFY_SSL=true
   HA_TIMEOUT=10000
   ```

   **Note:** If you're running both the bot and Home Assistant in Docker, use the service name or container IP instead of `localhost`.

3. **Restart the bot:**
   ```bash
   # Docker
   docker compose restart

   # Local
   npm run dev
   ```

4. **Verify the connection:**
   Use the `/ha-test` command in Discord to verify the bot can connect to Home Assistant.

#### Discord Commands

**`/ha-trigger`** - Trigger an automation immediately or at a scheduled time
- `automation_id` (required): Home Assistant automation entity ID (with autocomplete!)
- `time` (optional): When to trigger (e.g., "5m", "2h", "now") - default: "now"
- `notify` (optional): Send Discord notification on completion - default: false

Examples:
```
/ha-trigger automation_id:"automation.morning_routine" time:"now" notify:true
/ha-trigger automation_id:"automation.evening_lights" time:"6h" notify:false
/ha-trigger automation_id:"automation.water_plants" time:"2h" notify:true
```

**`/ha-test`** - Test Home Assistant connection
- Validates connection and shows how many automations are available

**`/ha-scheduled`** - List scheduled automation triggers
- `limit` (optional): Number of results to show (1-20, default: 10)

**`/ha-cancel`** - Cancel a pending automation trigger
- `id` (required): Trigger ID to cancel

**`/ha-history`** - View automation trigger history
- `limit` (optional): Number of results to show (1-50, default: 10)
- `status` (optional): Filter by status (all, pending, triggered, failed)

#### Features

- **Autocomplete**: Start typing an automation ID and the bot will suggest available automations with friendly names
- **Scheduling**: Schedule automations to trigger at a future time (e.g., "turn on lights in 2 hours")
- **Retry Logic**: Failed triggers automatically retry with exponential backoff (3 attempts)
- **Optional Notifications**: Choose whether to receive a Discord notification when the automation triggers
- **History Tracking**: View all past and scheduled automation triggers with timestamps and status

#### Finding Automation IDs

1. In Home Assistant, go to Settings → Automations & Scenes
2. Click on the automation you want to trigger
3. Click the three dots menu (⋮) in the top right
4. Click "Rename"
5. The Entity ID is shown below the name (e.g., `automation.morning_routine`)

Alternatively, use the autocomplete feature - just start typing in the `/ha-trigger` command and the bot will suggest automations!

#### Example Workflow

```
# Test the connection
/ha-test

# Trigger an automation immediately with notification
/ha-trigger automation_id:"automation.morning_routine" time:"now" notify:true

# Schedule an automation for later without notification
/ha-trigger automation_id:"automation.evening_lights" time:"6h" notify:false

# View scheduled triggers
/ha-scheduled

# View trigger history
/ha-history limit:20 status:"all"

# Cancel a scheduled trigger
/ha-cancel id:5
```

### Home Assistant Command Permissions

For security, Home Assistant commands can be restricted to a whitelist of authorized Discord users. This prevents unauthorized users from triggering your home automations.

#### Setup

1. **Create the permissions config file:**
   ```bash
   cp config/ha-permissions.json.example config/ha-permissions.json
   ```

2. **Add authorized user IDs:**

   Edit `config/ha-permissions.json`:
   ```json
   {
     "allowedUsers": [
       "123456789012345678",
       "987654321098765432"
     ]
   }
   ```

3. **Get Discord User IDs:**
   - Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
   - Right-click on a user and select "Copy User ID"
   - Add the ID to the `allowedUsers` array

4. **Restart the bot** (if running):
   ```bash
   # Docker
   docker compose restart

   # Local
   npm run dev
   ```

#### How It Works

- **Execution Protection**: Only whitelisted users can execute `/ha-trigger` and other HA commands
- **Autocomplete Protection**: Unauthorized users won't see your automation IDs in autocomplete (prevents information disclosure)
- **Hot-Reload**: The bot automatically reloads the config file when it changes—no restart needed!
- **Fail-Secure**: If the config file is missing or invalid, all users are denied access

#### Configuration Options

**Environment Variables:**
- `HA_PERMISSIONS_CONFIG`: Path to permissions config file (default: `./config/ha-permissions.json`)

**Config File Format:**
```json
{
  "allowedUsers": [
    "user_id_1",
    "user_id_2"
  ]
}
```

**Note:** The `config/ha-permissions.json` file is gitignored to prevent accidentally committing user IDs to version control.

#### Testing

1. **As an authorized user**: Try `/ha-trigger` - you should see autocomplete suggestions
2. **As an unauthorized user**: Try `/ha-trigger` - no autocomplete suggestions, command execution denied
3. **Check bot logs**: You'll see permission check messages on startup:
   ```
   [PermissionManager] Loaded 2 allowed user(s) for HA commands
   ```

#### Troubleshooting

**No one can use HA commands:**
- Check that `config/ha-permissions.json` exists
- Verify the JSON syntax is valid
- Ensure user IDs are strings (in quotes), not numbers
- Check bot logs for permission manager errors

**Commands not updating after config change:**
- The bot should auto-reload the config file
- If not, try restarting the bot
- Check that file watching is enabled (it's on by default)

**How to disable permission checks:**
- Remove or rename the `config/ha-permissions.json` file
- Note: This will deny ALL users by default (fail-secure behavior)
- To allow all users, you would need to modify the code

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
- `max_retries`: Maximum retries allowed (fixed at 3)
- `last_error`: Error message from last failure
- `metadata`: JSON field for additional data (reserved for future use)

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
QUEUE_SCHEDULER_INTERVAL=30       # How often to check for due notifications (seconds)
```

**Note**: Maximum retry attempts is fixed at 3 retries per notification.

### Monitoring

Use `/queue-stats` to monitor:
- Pending notifications (due now)
- Processing notifications
- Scheduled notifications (future)
- Failed notifications
- Sent count (last 24 hours)
- Health status indicator

## Development

### Quick Start for Development

The easiest way to run the bot locally for development:

**On Windows:**
```cmd
run-local.bat
```

**On Linux/Mac:**
```bash
./run-local.sh
```

This script handles all setup steps automatically and starts the bot in development mode with hot-reloading.

### Manual Development Setup

If you prefer to run commands manually:

```bash
# Install dependencies
npm install

# Start in development mode (with hot-reloading)
npm run dev
```

### Build for Production

```bash
# Build TypeScript to JavaScript
npm run build

# Run the built version
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
| `QUEUE_RETRY_BASE_DELAY` | Base retry delay (seconds) | ❌ | 60 |
| `QUEUE_SCHEDULER_INTERVAL` | Scheduler check interval (seconds) | ❌ | 30 |
| `HA_URL` | Home Assistant URL | ❌ | - |
| `HA_ACCESS_TOKEN` | Home Assistant long-lived access token | ❌ | - |
| `HA_VERIFY_SSL` | Verify SSL certificates | ❌ | true |
| `HA_TIMEOUT` | Home Assistant API timeout (ms) | ❌ | 10000 |
| `HA_PERMISSIONS_CONFIG` | Path to HA permissions config | ❌ | ./config/ha-permissions.json |

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

### Updating Docker Instance

To update your running Docker container with the latest changes:

**On Windows:**
```cmd
update.bat
```

**On Linux/Mac:**
```bash
./update.sh
```

The update script will:
1. Pull the latest code from git (if applicable)
2. Stop the current container
3. Pull latest base images
4. Rebuild the Docker image with latest changes
5. Start the updated container
6. Show status and recent logs

**Manual update:**
```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose down
docker compose build --no-cache
docker compose up -d

# View logs
docker compose logs -f
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
