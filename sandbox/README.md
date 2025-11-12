# Discord Bot Sandbox - Webhook Testing Interface

A comprehensive web-based testing interface for the Discord Bot webhook API. This sandbox provides a user-friendly interface to test, monitor, and manage notifications without using Discord slash commands.

## Features

- **📤 Notification Tester**: Interactive form to test webhook notifications with scheduling and signature generation
- **🔍 Notification Manager**: Search and manage individual notifications by ID
- **📊 Queue Monitor**: Real-time dashboard showing queue health and statistics
- **📜 Notification Browser**: Searchable history with filters and pagination
- **🧪 Testing Tools**: Batch sending, stress testing, and HMAC signature calculator

## Quick Start

### With Docker Compose (Recommended)

Deploy the sandbox alongside the bot service:

```bash
# Deploy bot with sandbox
docker-compose -f docker-compose.yml -f docker-compose.sandbox.yml up -d

# Or rebuild after changes
docker-compose -f docker-compose.yml -f docker-compose.sandbox.yml up -d --build
```

Access the sandbox at: **http://localhost:3000/sandbox**

### Without Docker (Development)

#### 1. Install Dependencies

```bash
# Install frontend dependencies
cd sandbox/frontend
npm install

# Install server dependencies
cd ../server
npm install
```

#### 2. Start Services

```bash
# Terminal 1: Start bot service (from project root)
npm run dev

# Terminal 2: Start sandbox server
cd sandbox/server
npm run dev

# Terminal 3: Start frontend dev server
cd sandbox/frontend
npm run dev
```

Access the development sandbox at: **http://localhost:5173/sandbox**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Sandbox Service (Port 3000)                                 │
│  ├── GET /sandbox/* → Serve React SPA                       │
│  └── /sandbox/api/* → Proxy to Bot Service                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot Service (Port 5000)                                     │
│  └── Webhook API                                            │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

**Sandbox Service:**
- `SANDBOX_PORT`: Port for sandbox service (default: `3000`)
- `BOT_API_URL`: Internal bot API URL (default: `http://discord-bot:5000`)

**Bot Service:**
See main project README for bot configuration.

### Docker Compose

The sandbox is configured as an optional service in `docker-compose.sandbox.yml`:

```yaml
services:
  sandbox:
    build:
      context: ./sandbox
    environment:
      - SANDBOX_PORT=3000
      - BOT_API_URL=http://discord-bot:5000
    ports:
      - "3000:3000"
    depends_on:
      - discord-bot
```

## Using the Sandbox

### 1. Notification Tester

Test webhook notifications with various configurations:

1. **Fill in the form**:
   - Source: Origin of the notification (e.g., "Home Assistant")
   - Title: Optional title
   - Message: Notification content (required)
   - Severity: info, warning, or error
   - Schedule For: Leave empty for immediate, or use relative time (5m, 2h, 1d) or ISO date

2. **Enable HMAC Signature** (optional):
   - Toggle "Use HMAC Signature"
   - Enter webhook secret
   - Signature is automatically generated

3. **Send the notification**:
   - Click "Send Notification"
   - View response with notification ID
   - Copy cURL command for external testing

**Quick Presets:**
- Click preset buttons to load common test scenarios
- Immediate, scheduled, warning, error templates

### 2. Notification Manager

Search and manage individual notifications:

1. **Search by ID**:
   - Enter notification ID
   - Click "Search"

2. **View Details**:
   - Full notification metadata
   - Timeline (created, scheduled, sent)
   - Retry information
   - Discord message ID

3. **Actions**:
   - **Refresh**: Update notification status
   - **Cancel**: Cancel pending/scheduled notifications
   - **Retry**: Manually retry failed notifications

### 3. Queue Monitor

Real-time queue health dashboard:

- **Health Indicator**: 🟢 Healthy / 🟡 Degraded / 🔴 Unhealthy
- **Statistics Cards**:
  - Pending: Ready to process
  - Processing: Currently sending
  - Scheduled: Future delivery
  - Failed: Needs attention
  - Sent (24h): Successfully sent in last 24 hours

- **Queue Distribution Chart**: Visual breakdown by status
- **Auto-refresh**: Updates every 10 seconds

### 4. Notification Browser

Search and filter notification history:

1. **Filters**:
   - Status: All, pending, processing, sent, failed, cancelled
   - Source: Filter by notification source
   - Search: Full-text search in messages
   - Per Page: 10, 25, 50, 100

2. **Results Table**:
   - Sortable columns
   - Pagination controls
   - Click notification for details

3. **Clear Filters**: Reset all filters to default

### 5. Testing Tools

Advanced testing utilities:

#### **Quick Test Presets**
- One-click test notifications
- Immediate, scheduled, warning, error scenarios

#### **Batch Sender**
1. Set number of notifications (1-100)
2. Set delay between sends (0-10000ms)
3. Click "Start Batch Send"
4. Monitor progress bar

**Recommended tests**:
- 10 notifications @ 1000ms delay: Basic queue testing
- 50 notifications @ 100ms delay: High throughput testing
- 100 notifications @ 0ms delay: Maximum stress testing

#### **HMAC Signature Calculator**
1. Enter JSON payload
2. Enter webhook secret
3. Click "Calculate Signature"
4. Copy signature for external use

## API Endpoints

The sandbox proxies requests to the bot service at `/sandbox/api/*`:

### Bot Service Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sandbox/api/webhook/notify` | Create notification |
| GET | `/sandbox/api/webhook/notify/:id` | Get notification status |
| DELETE | `/sandbox/api/webhook/notify/:id` | Cancel notification |
| POST | `/sandbox/api/webhook/notify/:id/retry` | Retry failed notification |
| GET | `/sandbox/api/webhook/stats` | Queue statistics |
| GET | `/sandbox/api/webhook/notifications` | Query notifications |
| POST | `/sandbox/api/webhook/message` | Legacy message endpoint |
| GET | `/sandbox/api/health` | Health check |

### Example: Create Notification

```bash
curl -X POST http://localhost:3000/sandbox/api/webhook/notify \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: <hmac-sha256-signature>" \
  -d '{
    "source": "Home Assistant",
    "title": "Front Door",
    "message": "Motion detected",
    "severity": "warning",
    "scheduled_for": "5m"
  }'
```

**Response:**
```json
{
  "status": "queued",
  "notification_id": 42,
  "queue_size": 1,
  "scheduled_for": "2024-11-12T15:00:00.000Z",
  "scheduled_in": "in 5 minutes"
}
```

## Development

### Project Structure

```
sandbox/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── ui/        # shadcn/ui components
│   │   │   ├── NotificationTester.tsx
│   │   │   ├── NotificationManager.tsx
│   │   │   ├── QueueMonitor.tsx
│   │   │   ├── NotificationBrowser.tsx
│   │   │   ├── TestingTools.tsx
│   │   │   └── Layout.tsx
│   │   ├── hooks/         # React Query hooks
│   │   ├── lib/           # Utilities (API, signature, utils)
│   │   ├── types/         # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── server/                # Express BFF
│   ├── src/
│   │   └── index.ts       # Express server with proxy
│   ├── package.json
│   └── tsconfig.json
├── Dockerfile             # Multi-stage build
└── README.md
```

### Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui (UI components)
- React Query (server state)
- Axios (HTTP client)
- Recharts (charts)
- Crypto-JS (HMAC signature generation)

**Backend:**
- Express.js (BFF server)
- http-proxy-middleware (API proxy)
- TypeScript

### Building

```bash
# Build frontend
cd sandbox/frontend
npm run build

# Build server
cd sandbox/server
npm run build

# Build Docker image
docker build -t discord-bot-sandbox ./sandbox
```

## Deployment

### Production Deployment

1. **Deploy without sandbox** (production):
   ```bash
   docker-compose up -d
   ```

2. **Deploy with sandbox** (testing/staging):
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.sandbox.yml up -d
   ```

### Reverse Proxy (Nginx)

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name sandbox.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Security Considerations

- **Access Control**: Deploy behind VPN or add basic auth for production
- **HTTPS**: Use reverse proxy with TLS/SSL certificates
- **Webhook Secret**: Always use HMAC signature verification in production
- **Network Isolation**: Keep bot and sandbox on same Docker network
- **Firewall**: Don't expose bot service port publicly

## Troubleshooting

### Sandbox Can't Connect to Bot

**Symptoms**: Proxy errors, 502 Bad Gateway

**Solutions**:
1. Verify bot service is running: `docker-compose ps`
2. Check BOT_API_URL environment variable
3. Ensure services are on same Docker network
4. Check bot service logs: `docker-compose logs discord-bot`

### Frontend Build Fails

**Symptoms**: TypeScript errors, build errors

**Solutions**:
1. Delete node_modules and reinstall: `rm -rf node_modules && npm install`
2. Clear Vite cache: `rm -rf node_modules/.vite`
3. Check Node.js version: `node --version` (requires 20+)

### 404 on Frontend Routes

**Symptoms**: Refreshing page shows 404

**Solutions**:
1. Ensure Express SPA fallback is configured correctly
2. Check Vite base path is set to `/sandbox/`
3. Verify static files are served from correct directory

### CORS Errors

**Symptoms**: API requests blocked by CORS policy

**Solutions**:
1. Ensure proxy is configured correctly in Express
2. Check origin headers
3. In development, Vite proxy should handle CORS

## Contributing

When modifying the sandbox:

1. **Frontend changes**: Edit components in `sandbox/frontend/src`
2. **Server changes**: Edit `sandbox/server/src/index.ts`
3. **Bot API changes**: Update bot service endpoints in `src/webhook.ts`

Run tests and linters before committing:

```bash
# Frontend
cd sandbox/frontend
npm run lint
npm run build  # Ensure build succeeds

# Server
cd sandbox/server
npm run build  # Ensure TypeScript compiles
```

## License

Same as main project.

## Support

For issues, questions, or contributions, see the main project repository.
