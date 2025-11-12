# Sandbox Frontend Implementation Plan

## Overview
Create a decoupled web-based testing interface for the Discord Bot webhook API, deployable as an optional Docker Compose service under the `/sandbox` endpoint.

---

## 1. Architecture Design

### 1.1 Technology Stack
```
Frontend Framework: React 18 + TypeScript
Build Tool:         Vite (fast HMR, optimized builds)
UI Framework:       Tailwind CSS + shadcn/ui components
HTTP Client:        Axios
State Management:   React Query (server state) + Zustand (client state)
Backend:            Express.js (simple BFF for serving static files + proxying)
Container:          Node.js 20-alpine (multi-stage build)
```

**Rationale:**
- **React + TypeScript**: Type safety and component reusability
- **Vite**: Fast development experience, modern tooling
- **Tailwind + shadcn/ui**: Rapid UI development with accessible components
- **React Query**: Excellent for API state management with caching
- **Express BFF**: Simple reverse proxy to avoid CORS issues + serve static files
- **Separate container**: Complete decoupling from bot service

### 1.2 Service Architecture
```
┌─────────────────────────────────────────────────────────────┐
│  Browser (User)                                              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Sandbox Service (Port 3000)                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Express Server (/sandbox)                             │ │
│  │  ├── GET /sandbox/* → Serve React SPA                  │ │
│  │  └── /sandbox/api/* → Proxy to Bot Service             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot Service (Port 5000)                                     │
│  └── Webhook API (POST /webhook/notify, etc.)               │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Project Structure
```
/
├── src/                           # Existing bot source
├── sandbox/                       # NEW: Sandbox service
│   ├── frontend/                  # React application
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/            # shadcn/ui components
│   │   │   │   ├── NotificationTester.tsx
│   │   │   │   ├── NotificationManager.tsx
│   │   │   │   ├── QueueMonitor.tsx
│   │   │   │   ├── NotificationBrowser.tsx
│   │   │   │   └── TestingTools.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useNotifications.ts
│   │   │   │   ├── useQueueStats.ts
│   │   │   │   └── useWebhookAPI.ts
│   │   │   ├── lib/
│   │   │   │   ├── api.ts          # API client
│   │   │   │   ├── signature.ts    # HMAC signature generator
│   │   │   │   └── utils.ts
│   │   │   ├── types/
│   │   │   │   └── api.ts          # TypeScript types
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── tailwind.config.js
│   ├── server/                    # Express BFF
│   │   ├── src/
│   │   │   ├── index.ts           # Express app
│   │   │   └── proxy.ts           # API proxy middleware
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── Dockerfile                 # Multi-stage build
│   └── .dockerignore
├── docker-compose.yml             # UPDATED: Add sandbox service
└── docker-compose.override.yml    # NEW: Optional sandbox config
```

---

## 2. Feature Implementation Breakdown

### 2.1 Core Features

#### **A. Notification Tester** (Priority: HIGH)
**Purpose**: Interactive form to test webhook notifications

**Components:**
```tsx
<NotificationTester />
  ├── <NotificationForm />          # Input fields
  ├── <SchedulingPreview />         # Real-time time parsing preview
  ├── <SignatureGenerator />        # HMAC helper with copy button
  ├── <RequestViewer />             # Shows actual HTTP request
  └── <ResponseViewer />            # Shows API response
```

**Features:**
- Input validation with real-time feedback
- Pre-filled templates (immediate, 5m, 2h, errors, warnings)
- Signature generation toggle (auto-compute HMAC)
- cURL command export
- Request/response JSON prettifier
- "Send" button with loading states
- Success/error toast notifications

**API Integration:**
```typescript
POST /sandbox/api/webhook/notify
{
  source: string,
  message: string,
  title?: string,
  severity?: 'info' | 'warning' | 'error',
  scheduled_for?: string
}
```

---

#### **B. Notification Manager** (Priority: HIGH)
**Purpose**: Manage individual notifications

**Components:**
```tsx
<NotificationManager />
  ├── <NotificationSearch />        # Search by ID
  ├── <NotificationDetail />        # Full notification details
  └── <NotificationActions />       # Cancel/Retry buttons
```

**Features:**
- Search notification by ID
- Display all notification metadata
- Visual status indicator (color-coded badges)
- Action buttons:
  - Cancel (if pending/scheduled)
  - Retry (if failed)
  - Refresh status
- Lifecycle timeline visualization
- Discord message link (if sent)

**API Integration:**
```typescript
GET    /sandbox/api/webhook/notify/:id
DELETE /sandbox/api/webhook/notify/:id
POST   /sandbox/api/webhook/notify/:id/retry
```

---

#### **C. Queue Monitor** (Priority: MEDIUM)
**Purpose**: Real-time queue health dashboard

**Components:**
```tsx
<QueueMonitor />
  ├── <QueueStats />                # Total counts by status
  ├── <HealthIndicator />           # Visual health status
  ├── <StatusChart />               # Pie/bar chart
  └── <ScheduledTimeline />         # Upcoming scheduled notifications
```

**Features:**
- Auto-refresh every 10 seconds
- Status distribution visualization (Chart.js/Recharts)
- Health indicator:
  - 🟢 Green: No failed, queue healthy
  - 🟡 Yellow: 1-5 failed notifications
  - 🔴 Red: 6+ failed notifications
- Scheduled notifications timeline (next 24 hours)
- Quick stats cards:
  - Pending
  - Processing
  - Scheduled
  - Failed
  - Sent (24h)

**Custom Endpoint** (to add to bot service):
```typescript
GET /webhook/stats
Response: {
  pending: number,
  processing: number,
  scheduled: number,
  failed: number,
  sent24h: number,
  health: 'healthy' | 'degraded' | 'unhealthy'
}
```

---

#### **D. Notification Browser** (Priority: MEDIUM)
**Purpose**: Searchable notification history

**Components:**
```tsx
<NotificationBrowser />
  ├── <FilterBar />                 # Status, source, date filters
  ├── <SearchInput />               # Full-text search
  ├── <NotificationTable />         # Sortable table
  └── <Pagination />                # Page controls
```

**Features:**
- Filterable by:
  - Status (all, pending, sent, failed, cancelled)
  - Source (dropdown from unique sources)
  - Date range (last 24h, 7d, 30d, custom)
- Full-text search in message content
- Sortable columns (created_at, scheduled_for, sent_at)
- Pagination (10/25/50 per page)
- Click row to open detail modal
- Bulk actions (future: cancel multiple, delete old)

**Custom Endpoint** (to add to bot service):
```typescript
GET /webhook/notifications?status=&source=&search=&limit=&offset=&sort=
Response: {
  notifications: Notification[],
  total: number,
  page: number,
  limit: number
}
```

---

#### **E. Testing Tools** (Priority: LOW)
**Purpose**: Advanced testing utilities

**Components:**
```tsx
<TestingTools />
  ├── <PresetTemplates />           # Quick test payloads
  ├── <BatchSender />               # Send multiple notifications
  ├── <SignatureCalculator />       # Standalone HMAC tool
  └── <StressTester />              # Performance testing
```

**Features:**
- **Presets**:
  - Immediate notification
  - Scheduled (5m, 1h, 1d)
  - All severity levels
  - Edge cases (long messages, special characters)
- **Batch Sender**:
  - Send N notifications with delay
  - Variable sources/messages
  - Progress indicator
- **Signature Calculator**:
  - Input payload JSON
  - Shows HMAC-SHA256 signature
  - Copy to clipboard
- **Stress Tester**:
  - Send X notifications rapidly
  - Measure response times
  - Display success/failure rates

---

### 2.2 UI/UX Design

#### Layout Structure
```
┌────────────────────────────────────────────────────────────┐
│  HEADER: Sandbox Testing Environment                       │
│  [Bot Status: ●] [Last Sync: 2s ago] [Docs] [GitHub]     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  SIDEBAR (Left, 200px)         MAIN CONTENT (Flex-grow)  │
│  ┌──────────────────┐          ┌─────────────────────┐   │
│  │ 📤 Notification   │          │                     │   │
│  │    Tester         │          │  <Selected View>    │   │
│  ├──────────────────┤          │                     │   │
│  │ 🔍 Manager        │          │                     │   │
│  ├──────────────────┤          │                     │   │
│  │ 📊 Queue Monitor  │          │                     │   │
│  ├──────────────────┤          │                     │   │
│  │ 📜 Browser        │          │                     │   │
│  ├──────────────────┤          │                     │   │
│  │ 🧪 Testing Tools  │          │                     │   │
│  └──────────────────┘          └─────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

#### Color Scheme (Status-based)
```css
Status Colors:
- Pending:     bg-blue-100 text-blue-800
- Processing:  bg-purple-100 text-purple-800
- Sent:        bg-green-100 text-green-800
- Failed:      bg-red-100 text-red-800
- Cancelled:   bg-gray-100 text-gray-800

Severity Colors:
- Info:        bg-blue-500
- Warning:     bg-amber-500
- Error:       bg-red-500
```

---

## 3. Backend (Express BFF) Implementation

### 3.1 Express Server Structure

**File: `sandbox/server/src/index.ts`**
```typescript
import express from 'express';
import path from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.SANDBOX_PORT || 3000;
const BOT_API_URL = process.env.BOT_API_URL || 'http://discord-bot:5000';

// Proxy API requests to bot service
app.use('/sandbox/api', createProxyMiddleware({
  target: BOT_API_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/sandbox/api': '', // Remove /sandbox/api prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy] ${req.method} ${req.url} → ${BOT_API_URL}${req.path}`);
  },
}));

// Serve static React build
const staticPath = path.join(__dirname, '../../frontend/dist');
app.use('/sandbox', express.static(staticPath));

// SPA fallback (for client-side routing)
app.get('/sandbox/*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'sandbox' });
});

app.listen(PORT, () => {
  console.log(`Sandbox service running on http://localhost:${PORT}/sandbox`);
  console.log(`Proxying API calls to: ${BOT_API_URL}`);
});
```

### 3.2 Key Proxy Features
- **CORS Handling**: Proxy eliminates CORS issues
- **Request Logging**: All API calls logged for debugging
- **Path Rewriting**: `/sandbox/api/*` → bot service root paths
- **Environment-based**: BOT_API_URL configurable per environment

---

## 4. Docker Integration

### 4.1 Sandbox Dockerfile

**File: `sandbox/Dockerfile`**
```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY sandbox/frontend/package*.json ./
RUN npm ci
COPY sandbox/frontend/ ./
RUN npm run build

# Stage 2: Build server
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY sandbox/server/package*.json ./
RUN npm ci
COPY sandbox/server/ ./
RUN npm run build

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app

# Copy server build
COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=server-builder /app/server/package.json ./

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/index.js"]
```

### 4.2 Docker Compose Configuration

#### **Option A: Combined docker-compose.yml** (Simple Approach)
**File: `docker-compose.yml`** (Updated)
```yaml
version: '3.8'

services:
  discord-bot:
    build: .
    container_name: discord-home-bot
    environment:
      - DISCORD_TOKEN=${DISCORD_TOKEN}
      - DISCORD_CHANNEL_ID=${DISCORD_CHANNEL_ID}
      - WEBHOOK_PORT=5000
      - WEBHOOK_SECRET=${WEBHOOK_SECRET}
      - DATABASE_PATH=/app/data/bot.db
      - LOG_LEVEL=${LOG_LEVEL:-info}
    ports:
      - "${WEBHOOK_PORT:-5000}:5000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    networks:
      - home-server
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5000/health"]
      interval: 30s
      timeout: 3s
      retries: 3

  sandbox:
    build:
      context: ./sandbox
      dockerfile: Dockerfile
    container_name: discord-bot-sandbox
    environment:
      - SANDBOX_PORT=3000
      - BOT_API_URL=http://discord-bot:5000
    ports:
      - "${SANDBOX_PORT:-3000}:3000"
    depends_on:
      discord-bot:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - home-server
    profiles:
      - sandbox  # Optional profile for conditional deployment

networks:
  home-server:
    driver: bridge
```

#### **Option B: Override Pattern** (Recommended for Selective Deployment)
**File: `docker-compose.yml`** (Keep existing, no sandbox service)

**File: `docker-compose.sandbox.yml`** (New)
```yaml
version: '3.8'

services:
  sandbox:
    build:
      context: ./sandbox
      dockerfile: Dockerfile
    container_name: discord-bot-sandbox
    environment:
      - SANDBOX_PORT=3000
      - BOT_API_URL=http://discord-bot:5000
    ports:
      - "${SANDBOX_PORT:-3000}:3000"
    depends_on:
      discord-bot:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - home-server
```

**Usage:**
```bash
# Deploy without sandbox (production)
docker-compose up -d

# Deploy with sandbox (testing/development)
docker-compose -f docker-compose.yml -f docker-compose.sandbox.yml up -d

# Or with profiles (if using Option A)
docker-compose --profile sandbox up -d
```

### 4.3 Environment Variables

**New Variables:**
```bash
# Sandbox Configuration
SANDBOX_PORT=3000              # External port for sandbox service
BOT_API_URL=http://discord-bot:5000  # Internal bot API URL
```

---

## 5. Bot Service Enhancements

### 5.1 New API Endpoints Required

Add these endpoints to `src/webhook.ts`:

```typescript
// GET /webhook/stats - Queue statistics
app.get('/webhook/stats', async (req, res) => {
  try {
    const stats = await queue.getStats();
    const failed = stats.failed;

    const health = failed === 0 ? 'healthy' :
                   failed <= 5 ? 'degraded' : 'unhealthy';

    res.json({
      ...stats,
      health
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /webhook/notifications - List notifications with filters
app.get('/webhook/notifications', async (req, res) => {
  try {
    const {
      status,
      source,
      search,
      limit = 10,
      offset = 0,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    const result = await database.queryNotifications({
      status,
      source,
      search,
      limit: Number(limit),
      offset: Number(offset),
      sort,
      order
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to query notifications' });
  }
});
```

### 5.2 Database Methods to Add

Add to `src/database.ts`:

```typescript
interface QueryOptions {
  status?: string;
  source?: string;
  search?: string;
  limit: number;
  offset: number;
  sort: string;
  order: 'ASC' | 'DESC';
}

async queryNotifications(options: QueryOptions): Promise<{
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
}> {
  const { status, source, search, limit, offset, sort, order } = options;

  let query = 'SELECT * FROM notifications WHERE 1=1';
  const params: any[] = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (source) {
    query += ' AND source = ?';
    params.push(source);
  }

  if (search) {
    query += ' AND (message LIKE ? OR title LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  // Count query
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
  const countResult = await this.get(countQuery, params);
  const total = countResult.count;

  // Data query
  query += ` ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const notifications = await this.all(query, params);

  return {
    notifications,
    total,
    page: Math.floor(offset / limit) + 1,
    limit
  };
}
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Week 1)
**Deliverables:**
- [x] Project structure setup
- [x] Docker configuration (sandbox service)
- [x] Express BFF with proxy
- [x] React app scaffold with Vite
- [x] Tailwind + shadcn/ui setup
- [x] Basic routing and layout
- [x] API client implementation
- [x] Health check endpoint

**Tasks:**
1. Create `sandbox/` directory structure
2. Initialize frontend (Vite + React + TypeScript)
3. Initialize server (Express + TypeScript)
4. Create Dockerfile with multi-stage build
5. Update docker-compose.yml
6. Implement Express proxy middleware
7. Set up React Router
8. Create base layout components
9. Test end-to-end connection

---

### Phase 2: Core Features (Week 2)
**Deliverables:**
- [x] Notification Tester component
- [x] Notification Manager component
- [x] API integration hooks
- [x] Bot service endpoint additions

**Tasks:**
1. Build NotificationForm with validation
2. Implement scheduling preview
3. Add HMAC signature generator
4. Create request/response viewers
5. Build NotificationSearch component
6. Implement cancel/retry actions
7. Add `/webhook/stats` endpoint to bot
8. Add `/webhook/notifications` endpoint to bot
9. Create useNotifications hook
10. Create useQueueStats hook

---

### Phase 3: Advanced Features (Week 3)
**Deliverables:**
- [x] Queue Monitor dashboard
- [x] Notification Browser
- [x] Chart visualizations
- [x] Real-time updates

**Tasks:**
1. Build QueueStats cards
2. Implement status chart (Recharts)
3. Create scheduled timeline
4. Build notification table with filters
5. Add pagination controls
6. Implement search functionality
7. Add auto-refresh with polling
8. Create notification detail modal

---

### Phase 4: Polish & Testing Tools (Week 4)
**Deliverables:**
- [x] Testing Tools section
- [x] Documentation
- [x] Testing
- [x] Deployment guides

**Tasks:**
1. Build preset templates
2. Implement batch sender
3. Create signature calculator
4. Add stress testing tool
5. Write README for sandbox
6. Create deployment documentation
7. Write integration tests
8. Conduct end-to-end testing
9. Performance optimization
10. Accessibility audit

---

## 7. Future Enhancements (Out of Scope for MVP)

### Selective Deployment Strategy
**Goal**: Deploy sandbox in test environments, exclude from production

**Approach 1: Docker Compose Profiles**
```bash
# Production (no sandbox)
docker-compose up -d

# Testing/Staging (with sandbox)
docker-compose --profile sandbox up -d
```

**Approach 2: Environment-Specific Compose Files**
```bash
# Production
docker-compose -f docker-compose.yml up -d

# Testing
docker-compose -f docker-compose.yml -f docker-compose.test.yml up -d
```

**Approach 3: CI/CD Pipeline Conditional**
```yaml
# GitHub Actions example
- name: Deploy to Production
  run: docker-compose up -d
  if: github.ref == 'refs/heads/main'

- name: Deploy to Test
  run: docker-compose --profile sandbox up -d
  if: github.ref == 'refs/heads/develop'
```

### Additional Features
- **Authentication**: Add basic auth or token-based auth to sandbox
- **WebSocket**: Real-time notification updates without polling
- **Export**: Export notification history as CSV/JSON
- **Dark Mode**: Theme toggle
- **Advanced Analytics**: Success rates, avg response times, graphs
- **Mock Mode**: Sandbox can work without bot service (mocked responses)
- **Notification Templates**: Save and reuse common notification patterns
- **Webhooks Inbound**: Receive webhook callbacks in sandbox UI
- **Rate Limiting UI**: Configure and test rate limits

---

## 8. Testing Strategy

### 8.1 Frontend Testing
```bash
# Unit tests with Vitest
npm test

# E2E tests with Playwright
npm run test:e2e

# Coverage
npm run test:coverage
```

**Test Coverage:**
- Component rendering tests
- API hook tests (mock responses)
- Signature generation validation
- Form validation logic
- Date parsing edge cases

### 8.2 Integration Testing
- Docker compose up both services
- Test proxy connectivity
- Verify all API endpoints work through proxy
- Test HMAC signature verification
- Verify notification lifecycle end-to-end

### 8.3 Manual Testing Checklist
- [ ] Send immediate notification
- [ ] Send scheduled notification (5m, 1h, 1d)
- [ ] Cancel pending notification
- [ ] Retry failed notification
- [ ] Search notifications by ID
- [ ] Filter notifications by status
- [ ] View queue statistics
- [ ] Test signature with/without secret
- [ ] Test all severity levels
- [ ] Test long messages (>2000 chars)
- [ ] Test special characters in messages
- [ ] Verify mobile responsiveness
- [ ] Test keyboard navigation
- [ ] Verify screen reader accessibility

---

## 9. Documentation Requirements

### 9.1 Sandbox README
Create `sandbox/README.md` with:
- Quick start guide
- Development setup
- API documentation
- Component documentation
- Troubleshooting guide

### 9.2 Deployment Guide
Create `docs/SANDBOX_DEPLOYMENT.md` with:
- Docker deployment instructions
- Environment variable reference
- Nginx reverse proxy configuration
- SSL/TLS setup recommendations
- Production security checklist

### 9.3 User Guide
Create `docs/SANDBOX_USER_GUIDE.md` with:
- Feature walkthrough with screenshots
- Common testing scenarios
- HMAC signature guide
- Scheduling format reference
- FAQ

---

## 10. Security Considerations

### 10.1 Access Control
- **Current MVP**: No authentication (assumes internal network)
- **Recommendation**: Deploy behind VPN or add basic auth
- **Future**: Implement proper authentication system

### 10.2 HTTPS/TLS
- Sandbox should be behind reverse proxy (Nginx/Traefik)
- Use Let's Encrypt for TLS certificates
- Enforce HTTPS in production

### 10.3 API Security
- Bot service webhook secret should be used
- Sandbox should never expose Discord tokens
- Rate limiting on bot API recommended

### 10.4 Network Isolation
- Keep bot and sandbox on same Docker network
- Don't expose bot service port publicly
- Only expose sandbox port (or proxy)

---

## 11. Performance Targets

- **Initial Page Load**: < 2 seconds
- **API Response Time**: < 500ms (proxied)
- **Auto-refresh Interval**: 10 seconds (configurable)
- **Batch Operations**: Support 100+ notifications
- **Browser Compatibility**: Last 2 versions of Chrome, Firefox, Safari, Edge

---

## 12. Success Criteria

### MVP Complete When:
- [x] All 5 core features implemented and functional
- [x] Docker compose deployment works
- [x] Proxy successfully forwards requests to bot service
- [x] All existing bot webhooks testable through UI
- [x] Responsive design works on desktop and tablet
- [x] Documentation complete
- [x] Integration tests pass

### Quality Gates:
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] Lighthouse score > 90 for performance
- [ ] WCAG 2.1 AA accessibility compliance
- [ ] Cross-browser testing passed
- [ ] Security audit completed

---

## 13. Estimated Effort

| Phase | Duration | Complexity |
|-------|----------|------------|
| Phase 1: Foundation | 1 week | Medium |
| Phase 2: Core Features | 1 week | High |
| Phase 3: Advanced Features | 1 week | Medium |
| Phase 4: Polish & Testing | 1 week | Low |
| **Total** | **4 weeks** | **Medium-High** |

**Team Size**: 1 developer (full-time)

---

## 14. Open Questions

1. **Authentication**: Do we need any authentication for sandbox access in MVP?
   - *Recommendation*: No for MVP, but document security considerations

2. **Bot Service Changes**: Can we modify bot service to add new endpoints?
   - *Assumption*: Yes, as they're non-breaking additions

3. **Styling Preferences**: Any specific design system or color scheme?
   - *Recommendation*: Use Discord-like color palette (blues, grays)

4. **Port Conflicts**: Is port 3000 available for sandbox?
   - *Recommendation*: Make it configurable via environment variable

5. **Database Access**: Should sandbox have direct database access?
   - *Recommendation*: No, only through bot API endpoints

---

## 15. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CORS issues with proxy | Low | High | Use http-proxy-middleware with proper config |
| Docker build failures | Medium | Medium | Test multi-stage builds early, CI/CD pipeline |
| Performance issues with polling | Medium | Low | Implement debouncing, configurable intervals |
| Bot API changes | Low | High | Version API endpoints, maintain compatibility |
| Signature verification complexity | Medium | Medium | Provide clear examples and debugging tools |

---

## Appendix A: Key Dependencies

### Frontend Package.json
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.6.0",
    "recharts": "^2.10.0",
    "date-fns": "^3.0.0",
    "crypto-js": "^4.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0"
  }
}
```

### Server Package.json
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "http-proxy-middleware": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "ts-node": "^10.9.0"
  }
}
```

---

## Appendix B: API Contract Types

```typescript
// Shared TypeScript types
export interface Notification {
  id: number;
  created_at: string;
  scheduled_for: string;
  sent_at: string | null;
  source: string;
  title: string | null;
  message: string;
  severity: 'info' | 'warning' | 'error';
  discord_message_id: string | null;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  metadata: Record<string, any> | null;
}

export interface NotificationCreateRequest {
  source: string;
  message: string;
  title?: string;
  severity?: 'info' | 'warning' | 'error';
  scheduled_for?: string;
}

export interface NotificationCreateResponse {
  status: 'queued';
  notification_id: number;
  queue_size: number;
  scheduled_for?: string;
  scheduled_in?: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  scheduled: number;
  failed: number;
  sent24h: number;
  health: 'healthy' | 'degraded' | 'unhealthy';
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
}
```

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Clarify open questions** (see Section 14)
3. **Approve technology choices** (see Section 1.1)
4. **Set up project structure** (Phase 1, Day 1)
5. **Begin implementation** following phased approach

---

**Document Version**: 1.0
**Last Updated**: 2024-11-12
**Status**: Draft - Awaiting Approval
