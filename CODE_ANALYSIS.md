# Complete Code Analysis: Discord Bot for Home Assistant Notifications

> **Note**: This document provides a historical code analysis. For the most up-to-date API endpoints, slash commands, and features, please refer to the main README.md file.

## 📋 Project Overview

This is a **Discord notification bot** that serves as a bridge between Home Assistant (or any service) and Discord. It receives webhook notifications and reliably delivers them to a Discord channel while maintaining a searchable history.

---

## 🏗️ Project Structure

```
discord-bot-home-assistant-notification-assistant/
├── src/
│   ├── index.ts       # Application entry point & orchestrator
│   ├── commands.ts    # Discord slash commands (/ping, /status, /history, /test)
│   ├── database.ts    # SQLite database wrapper with promisified operations
│   ├── queue.ts       # Notification queue manager (sequential delivery)
│   └── webhook.ts     # Express HTTP webhook server
├── docker-compose.yml # Docker deployment configuration
├── Dockerfile         # Multi-stage Node.js container build
├── package.json       # Dependencies and npm scripts
├── tsconfig.json      # TypeScript configuration (strict mode, ES2020)
└── .env.example       # Environment variable template
```

---

## 🎯 Core Functionality

### What It Does:
1. **Receives notifications** via HTTP webhooks (`POST /webhook/notify`)
2. **Queues notifications** for reliable sequential delivery
3. **Sends to Discord** as rich embeds with color-coded severity
4. **Persists history** in SQLite database
5. **Provides slash commands** for interaction and history lookup

### Use Case:
Home automation alerts (door sensors, motion detection, temperature, etc.) sent directly to Discord with reliable delivery and searchable history.

---

## 🔧 Key Components

### **1. index.ts** - Application Orchestrator
**Location**: `src/index.ts`

- Initializes all components (Discord, Database, Queue, Commands, Webhook)
- Validates environment variables at startup
- Manages application lifecycle and graceful shutdown
- Sets up Discord event handlers

**Startup Sequence**:
```
Load env vars → Validate config → Initialize DB → Create queue →
Login to Discord → Register commands → Start webhook server
```

### **2. database.ts** - Data Persistence
**Location**: `src/database.ts`

**Database Tables**:
- `notifications` - Notification history with Discord message IDs
- `bot_state` - Key-value store for bot settings
- `ha_entities` - (Future) Home Assistant entity tracking

**Key Methods**:
- `saveNotification()` - Stores notification with metadata
- `getNotificationHistory(limit)` - Retrieves recent notifications
- `setState()/getState()` - Generic configuration storage

**Implementation Details**:
- Uses callback-to-promise pattern with `promisify()` for cleaner async code
- Promisified methods: `run`, `get`, `all`

### **3. queue.ts** - Notification Queue Manager
**Location**: `src/queue.ts`

**Features**:
- Uses `p-queue` library with **concurrency=1** for sequential delivery
- Prevents Discord rate limiting by processing one at a time
- Builds rich embeds with color-coded severity:
  - 🔵 **Info** (blue - #0099ff)
  - 🟠 **Warning** (orange - #ff9900)
  - 🔴 **Error** (red - #ff0000)
- Saves to database even if Discord send fails (resilience)
- Tracks queue size for status reporting

**Notification Interface**:
```typescript
{
  source: string;          // Required (e.g., "Home Assistant")
  message: string;         // Required
  title?: string;          // Optional
  severity?: 'info' | 'warning' | 'error';  // Optional (default: info)
  timestamp?: Date;        // Optional (auto-added)
}
```

### **4. webhook.ts** - HTTP Server
**Location**: `src/webhook.ts`

**Endpoints**:
- `GET /health` - Health check (returns 200 OK)
- `POST /webhook/notify` - Main notification endpoint (returns 202 Accepted)
- `POST /webhook/message` - Simple message endpoint

**Security**:
- Optional HMAC-SHA256 signature verification
- Header: `x-webhook-signature`
- Validates required fields (source, message)
- Returns 401 for invalid signatures
- Returns 202 Accepted with current queue size

**Signature Verification**:
```typescript
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');
```

### **5. commands.ts** - Discord Slash Commands
**Location**: `src/commands.ts`

**Available Commands**:
- `/ping` - Connectivity test (returns "Pong!")
- `/status` - Bot uptime and queue size
- `/history [limit]` - View last 1-20 notifications (default: 10)
- `/test` - Send test notification to verify pipeline

**Architecture**:
- Uses Discord.js Collection for command storage
- Commands defined with SlashCommandBuilder
- Automatic command registration on bot startup
- Error handling with ephemeral error messages

---

## 📦 Dependencies

### Runtime:
- **discord.js** (^14.14.0) - Discord API client
- **express** (^4.18.2) - HTTP server framework
- **sqlite3** (^5.1.6) - SQLite database driver
- **p-queue** (^7.4.1) - Promise-based queue
- **dotenv** (^16.3.1) - Environment variable loader

### Development:
- **typescript** (^5.3.3) - TypeScript compiler
- **tsx** (^4.7.0) - TypeScript execution for dev
- **@types/*** - TypeScript type definitions

---

## ⚙️ Configuration

### TypeScript Configuration (tsconfig.json):
- Target: ES2020
- Module: ES2020 (ESM modules)
- Strict mode enabled
- Source maps and declarations generated
- Output directory: `./dist`

### Required Environment Variables:
```env
DISCORD_TOKEN           # Bot token from Discord Developer Portal
DISCORD_CHANNEL_ID      # Target channel ID for notifications
```

### Optional Environment Variables:
```env
WEBHOOK_PORT=5000       # HTTP server port (default: 5000)
WEBHOOK_SECRET          # HMAC signature verification secret
DATABASE_PATH           # SQLite database file path (default: ./data/notifications.db)
LOG_LEVEL=info          # Logging verbosity
```

---

## 🔄 Application Flow

### Application Startup Flow:
```
main() in index.ts
  ↓
1. Load environment variables (dotenv)
  ↓
2. Validate required vars (TOKEN, CHANNEL_ID)
  ↓
3. Create Discord client with intents (Guilds, GuildMessages)
  ↓
4. Initialize database (create tables)
  ↓
5. Create NotificationQueue
  ↓
6. Create CommandHandler
  ↓
7. Login to Discord
  ↓
8. On ClientReady event:
   - Register slash commands
   - Start webhook server on port 5000
  ↓
9. Listen for:
   - InteractionCreate (slash commands)
   - Discord errors
   - SIGINT/SIGTERM (graceful shutdown)
```

### Notification Flow:
```
External Service (Home Assistant)
  ↓
POST /webhook/notify
  ↓
webhook.ts validates signature & body
  ↓
queue.enqueue(notification)
  ↓
NotificationQueue (p-queue)
  ↓
sendNotification() [sequential]
  ↓
Build Discord embed
  ↓
Send to Discord channel
  ↓
Save to database with message ID
  ↓
Return 202 Accepted
```

### Slash Command Flow:
```
User types /history in Discord
  ↓
Discord sends InteractionCreate event
  ↓
CommandHandler.handleInteraction()
  ↓
Find command in Collection
  ↓
Execute command logic
  ↓
Database.getNotificationHistory()
  ↓
Format response
  ↓
interaction.reply() to Discord
```

---

## 🎨 Architecture Highlights

### Design Patterns:

1. **Queue-Based Architecture** - Sequential processing prevents rate limiting and maintains order
2. **Separation of Concerns** - Each module has single responsibility
3. **Error Resilience** - Database saves happen even if Discord fails
4. **Modern TypeScript** - ES modules, strict mode, full typing
5. **Security First** - Optional HMAC verification, no hardcoded secrets
6. **Docker-Ready** - Multi-stage build, health checks, volume mounts

### Strengths:
- ✅ Clean, modular code structure
- ✅ Type-safe with TypeScript strict mode
- ✅ Reliable message delivery via queue
- ✅ Persistent searchable history
- ✅ Easy Docker deployment
- ✅ Comprehensive documentation
- ✅ Error handling with graceful degradation
- ✅ Health check endpoint for monitoring

### Code Quality:
- Modern async/await patterns
- Promisified database operations
- Proper TypeScript interfaces and types
- Error handling with try-catch blocks
- Unhandled rejection handlers
- Clean separation between concerns

### Potential Enhancements (from README):
- Direct Home Assistant WebSocket integration
- Advanced search/filtering
- Notification routing based on entity/domain
- Two-way communication (trigger services from Discord)
- Message reactions for interaction
- Notification templates

---

## 🐳 Docker Deployment

**Base Image**: `node:22-alpine` (minimal footprint)

**Features**:
- Multi-stage build for smaller image size
- Health check every 30s via `/health` endpoint
- Volume mount for database persistence: `./data:/app/data`
- Automatic restart: `unless-stopped`
- Bridge network: `home-server`
- Exposed port: 5000

**Docker Compose Configuration**:
```yaml
services:
  discord-bot:
    build: .
    container_name: ha-discord-bot
    restart: unless-stopped
    environment:
      - DISCORD_TOKEN=${DISCORD_TOKEN}
      - DISCORD_CHANNEL_ID=${DISCORD_CHANNEL_ID}
      - WEBHOOK_SECRET=${WEBHOOK_SECRET}
    volumes:
      - ./data:/app/data
    ports:
      - "5000:5000"
    networks:
      - home-server
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 🗄️ Database Schema

### notifications table:
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  title TEXT,
  severity TEXT DEFAULT 'info',
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  discord_message_id TEXT
)
```

### bot_state table:
```sql
CREATE TABLE IF NOT EXISTS bot_state (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### ha_entities table (future use):
```sql
CREATE TABLE IF NOT EXISTS ha_entities (
  entity_id TEXT PRIMARY KEY,
  friendly_name TEXT,
  last_state TEXT,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## 📝 Example Usage

### Sending a Notification (with signature):
```bash
curl -X POST http://localhost:5000/webhook/notify \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: <hmac-sha256-signature>" \
  -d '{
    "source": "Home Assistant",
    "title": "Motion Detected",
    "message": "Motion detected in Living Room",
    "severity": "warning"
  }'
```

### Home Assistant Automation Example:
```yaml
automation:
  - alias: "Send Discord Notification"
    trigger:
      - platform: state
        entity_id: binary_sensor.front_door
        to: "on"
    action:
      - service: rest_command.discord_notify
        data:
          source: "Home Assistant"
          title: "Front Door Opened"
          message: "The front door was opened"
          severity: "info"
```

---

## 💡 Summary

This is a **production-ready Discord bot** with a focus on:
- **Reliability** - Queue-based delivery ensures no notifications are lost
- **Maintainability** - Clean TypeScript architecture with proper separation
- **Ease of Use** - Simple deployment with Docker, slash commands for interaction
- **Extensibility** - Well-structured for adding features like WebSocket integration
- **Security** - Optional HMAC verification for webhook authentication

The codebase is well-organized, properly typed, and follows modern Node.js/TypeScript best practices. It's specifically designed for personal home automation but could easily be adapted for other notification use cases.

### Technology Stack Summary:
- **Language**: TypeScript (ES2020)
- **Runtime**: Node.js 22
- **Framework**: Discord.js 14, Express 4
- **Database**: SQLite3
- **Queue**: p-queue
- **Deployment**: Docker + Docker Compose

### Key Files to Understand:
1. `src/index.ts` - Start here to understand the initialization flow
2. `src/queue.ts` - Core notification delivery logic
3. `src/webhook.ts` - HTTP endpoint implementation
4. `src/commands.ts` - Discord command definitions
5. `src/database.ts` - Data persistence layer
