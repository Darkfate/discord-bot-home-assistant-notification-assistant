# Testing Guide

This document explains how to run tests for the Discord Home Server Bot.

## Prerequisites

Before running tests, you need to install dependencies:

```bash
npm install
```

**Note:** If `npm install` fails due to network issues with the `sqlite3` native dependency, you may need to:
1. Wait for network connectivity to improve
2. Use a different npm registry mirror
3. Build sqlite3 from source with proper build tools installed

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Unit Tests Only

```bash
npm run test:unit
```

### Run Integration Tests Only

```bash
npm run test:integration
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

This will generate a coverage report in the `coverage/` directory.

## Test Structure

### Unit Tests (`src/__tests__/unit/`)

Unit tests verify individual components in isolation with mocked dependencies:

- **`commands.test.ts`** - Discord slash commands
- **`database.test.ts`** - Database operations
- **`dateParser.test.ts`** - Time parsing utilities
- **`webhook.test.ts`** - Webhook endpoints
- **`homeAssistant/client.test.ts`** - Home Assistant API client
- **`homeAssistant/automationQueue.test.ts`** - Automation trigger queue

### Integration Tests (`src/__tests__/integration/`)

Integration tests verify components working together:

- **`database.integration.test.ts`** - Full database lifecycle
- **`webhook.integration.test.ts`** - End-to-end webhook → notification flow

## Test Coverage

### Home Assistant Module Tests

The Home Assistant module includes comprehensive unit tests covering:

#### **HA Client Tests** (`homeAssistant/client.test.ts`)
- ✅ Connection validation
- ✅ Triggering automations
- ✅ Listing automations with filtering
- ✅ Caching behavior (60-second TTL)
- ✅ Error handling (network errors, timeouts, 404s)
- ✅ Sorting automations by friendly name
- ✅ Getting specific automations
- ✅ Cache clearing

#### **Automation Queue Tests** (`homeAssistant/automationQueue.test.ts`)
- ✅ Queue initialization (reset processing → pending)
- ✅ Enqueuing triggers with time parsing
- ✅ Processing triggers successfully
- ✅ Retry logic with exponential backoff
- ✅ Maximum retry handling (mark as failed)
- ✅ Canceling pending triggers
- ✅ Retrying failed triggers
- ✅ Skipping non-pending triggers
- ✅ Graceful shutdown
- ✅ Queue metrics (size, pending count)

## Writing Tests

### Example Unit Test

```typescript
import { HomeAssistantClient } from '../../../homeAssistant/client.js';

describe('HomeAssistantClient', () => {
  let client: HomeAssistantClient;

  beforeEach(() => {
    client = new HomeAssistantClient({
      url: 'http://localhost:8123',
      accessToken: 'test-token',
    });
  });

  it('should validate connection', async () => {
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'API running.' }),
    });

    const result = await client.validateConnection();
    expect(result).toBe(true);
  });
});
```

## Mocking

Tests use Jest for mocking:

- **Discord.js**: Mocked in unit tests to avoid requiring Discord connection
- **Database**: Mocked in automation queue tests; real SQLite in database tests
- **Home Assistant API**: Mocked using `jest.fn()` for `global.fetch`
- **Network requests**: All external API calls are mocked

## Troubleshooting

### Tests Fail with "Cannot find module"

Make sure you've built the TypeScript code:

```bash
npm run build
```

### sqlite3 Build Errors

If sqlite3 fails to build during `npm install`:

1. **On Linux:**
   ```bash
   sudo apt-get install build-essential python3
   npm install
   ```

2. **On macOS:**
   ```bash
   xcode-select --install
   npm install
   ```

3. **On Windows:**
   - Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
   - Install [Python](https://www.python.org/downloads/)
   - Run `npm install`

### Network Timeout During npm install

If npm times out downloading packages:

```bash
# Increase timeout
npm install --fetch-timeout=60000

# Or use a different registry
npm install --registry=https://registry.npmmirror.com
```

### Jest Not Found

If you get "jest: not found" after installing:

```bash
# Install Jest globally (temporary fix)
npm install -g jest

# Or use npx
npx jest
```

## Continuous Integration

When setting up CI/CD, use:

```yaml
# Example GitHub Actions workflow
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## Test Environment Variables

Tests use in-memory databases and mocked services, so no environment variables are required. The `.env` file is **not** needed for running tests.

## Coverage Goals

Aim for:
- **Unit tests**: >80% coverage
- **Integration tests**: Cover all critical user workflows
- **New features**: Write tests before or alongside implementation

## Adding New Tests

When adding new features:

1. Create test file in appropriate directory:
   - Unit tests: `src/__tests__/unit/`
   - Integration tests: `src/__tests__/integration/`

2. Follow naming convention: `<feature>.test.ts`

3. Structure tests with `describe` blocks:
   ```typescript
   describe('FeatureName', () => {
     describe('methodName', () => {
       it('should do something', () => {
         // Test code
       });
     });
   });
   ```

4. Run tests to verify:
   ```bash
   npm test
   ```

## Manual Testing

For features that require Discord or Home Assistant:

1. **Discord Commands:**
   - Set up `.env` with real Discord credentials
   - Run `npm run dev`
   - Test commands in Discord

2. **Home Assistant Integration:**
   - Set up `.env` with HA credentials
   - Run `npm run dev`
   - Use `/ha-test` to verify connection
   - Test automation triggers

3. **Webhooks:**
   - Run the bot locally
   - Use curl or Postman to send test webhooks:
     ```bash
     curl -X POST http://localhost:5000/webhook/notify \
       -H "Content-Type: application/json" \
       -d '{"source":"Test","message":"Hello"}'
     ```

## Need Help?

If you encounter issues running tests:

1. Check the [main README](./README.md) for setup instructions
2. Ensure Node.js 22+ is installed: `node --version`
3. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
4. Check the GitHub Issues for similar problems
