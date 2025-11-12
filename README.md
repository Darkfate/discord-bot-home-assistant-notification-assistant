# Discord Home Server Bot

A Discord bot designed for personal use with Home Assistant integration. Receives notifications from your home server via webhooks and sends them to a Discord channel.

## Features

- **Webhook-based notifications**: Receive notifications from Home Assistant or any service that can send HTTP POST requests
- **Notification queue**: Reliable, sequential delivery of notifications
- **SQLite database**: Persistent storage of notification history and bot state
- **Slash commands**: Modern Discord command interface
- **Docker support**: Easy containerization and deployment
- **Webhook signature verification**: Optional security layer for incoming webhooks

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

### 4. Run with Docker Compose

```bash
docker-compose up -d
```

The bot will start and listen for webhooks on `http://localhost:5000`

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
  "severity": "warning"
}
```

**Fields**:
- `source` (required): Source of the notification (e.g., "Home Assistant", "Server")
- `title` (optional): Notification title
- `message` (required): Notification message
- `severity` (optional): One of `info`, `warning`, `error` (default: `info`)

**Response**: `202 Accepted`

### Health Check

**Endpoint**: `GET /health`

**Response**: `200 OK`

## Slash Commands

- `/ping`: Responds with pong (useful for testing)
- `/status`: Shows bot uptime and queue size
- `/history [limit]`: Shows recent notifications (default 10, max 20)
- `/test`: Sends a test notification

## Home Assistant Integration

To send notifications from Home Assistant to your Discord bot:

### Using Automation

```yaml
automation:
  - alias: "Discord notification example"
    trigger:
      platform: state
      entity_id: binary_sensor.front_door
      to: "on"
    action:
      - service: notify.webhook
        data:
          message: "Front door opened"
          title: "Security Alert"
          data:
            source: "Home Assistant"
            severity: "warning"
```

### Using RESTful Notification Service

Add to `configuration.yaml`:

```yaml
notify:
  - name: discord_bot
    platform: rest
    resource: http://discord-bot:5000/webhook/notify
    headers:
      Content-Type: application/json
    data:
      source: "Home Assistant"
```

Then use in automations:

```yaml
service: notify.discord_bot
data:
  title: "Door Alert"
  message: "Front door opened"
  data:
    severity: "warning"
```

## Database

The bot uses SQLite to store:
- Notification history (with Discord message IDs)
- Bot state/settings
- Home Assistant entity tracking (for future use)

Database file location: `./data/bot.db` (mounted in Docker)

### Query Examples

```bash
# Connect to database
sqlite3 data/bot.db

# View recent notifications
SELECT source, title, message, timestamp FROM notifications ORDER BY timestamp DESC LIMIT 10;

# Get bot state
SELECT * FROM bot_state;
```

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

### Linting

```bash
npm run lint
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Discord bot token | ✅ |
| `DISCORD_CHANNEL_ID` | Channel ID for notifications | ✅ |
| `WEBHOOK_PORT` | Port for webhook server (default: 5000) | ❌ |
| `WEBHOOK_SECRET` | Secret for webhook verification | ❌ |
| `DATABASE_PATH` | Path to SQLite database | ❌ |
| `LOG_LEVEL` | Logging level (default: info) | ❌ |

## Troubleshooting

### Bot doesn't connect to Discord
- Check `DISCORD_TOKEN` is correct
- Ensure bot has all required intents enabled in Developer Portal
- Check bot has permission to send messages in the channel

### Webhooks not working
- Verify `DISCORD_CHANNEL_ID` is correct
- Check webhook server is running: `curl http://localhost:5000/health`
- Check firewall allows port 5000

### Commands not showing up
- Give it a few seconds after bot starts
- Try restarting the bot or Discord client
- Verify bot has `/applications.commands` scope

## Docker Deployment

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
  -p 5000:5000 \
  -v discord-bot-data:/app/data \
  discord-home-bot
```

## Security Notes

- Keep `DISCORD_TOKEN` secret and never commit it
- Use `WEBHOOK_SECRET` to verify webhook requests
- The webhook endpoint is publicly accessible—use the secret or firewall rules to restrict access
- For production, use HTTPS and reverse proxy (e.g., nginx)

## Future Enhancements

- Direct Home Assistant integration via websocket
- Database query commands for advanced history search
- Notification filtering and routing
- Home Assistant service call responses
- Message reactions for bot interaction

## License

MIT
