# Claude Development Guidelines

## Testing Requirements

**All features added or modified by Claude MUST include appropriate testing.**

### Testing Framework

This project uses **Jest** with **ts-jest** for TypeScript support. If not yet installed, add them with:

```bash
npm install --save-dev jest ts-jest @types/jest
npm install --save-dev @jest/globals
```

### Test Configuration

Configure Jest by adding to `package.json`:

```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

Create `jest.config.js`:

```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
    }],
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

### Testing Standards

#### 1. What to Test

**Every feature MUST have:**

- **Unit tests** for individual functions and methods
- **Integration tests** for components that interact with external services
- **Error handling tests** for all error scenarios
- **Edge case tests** for boundary conditions

#### 2. Test Organization

```
project/
├── src/
│   ├── commands.ts
│   ├── database.ts
│   ├── queue.ts
│   └── webhook.ts
└── __tests__/
    ├── commands.test.ts
    ├── database.test.ts
    ├── queue.test.ts
    └── webhook.test.ts
```

#### 3. Test Naming Convention

- Test files: `[feature].test.ts` or `[feature].spec.ts`
- Test descriptions: Use descriptive names that explain what is being tested

```typescript
describe('NotificationQueue', () => {
  describe('enqueue', () => {
    it('should add notification to queue successfully', () => {
      // test implementation
    });

    it('should reject duplicate notifications', () => {
      // test implementation
    });

    it('should throw error when queue is full', () => {
      // test implementation
    });
  });
});
```

#### 4. Mocking External Dependencies

Always mock external services:

```typescript
// Mock Discord.js client
jest.mock('discord.js');

// Mock database
jest.mock('../src/database');

// Mock Home Assistant API calls
jest.mock('node-fetch');
```

#### 5. Test Coverage Requirements

- **Minimum 70% coverage** for all new code
- **100% coverage** for critical paths (authentication, data persistence, notifications)
- Run `npm run test:coverage` to check coverage

#### 6. Example Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NotificationQueue } from '../src/queue';

describe('NotificationQueue', () => {
  let queue: NotificationQueue;

  beforeEach(() => {
    queue = new NotificationQueue();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should process notifications in order', async () => {
    const notification1 = { id: '1', message: 'Test 1' };
    const notification2 = { id: '2', message: 'Test 2' };

    await queue.enqueue(notification1);
    await queue.enqueue(notification2);

    const processed = await queue.process();

    expect(processed[0]).toEqual(notification1);
    expect(processed[1]).toEqual(notification2);
  });

  it('should handle errors gracefully', async () => {
    const invalidNotification = null;

    await expect(queue.enqueue(invalidNotification))
      .rejects
      .toThrow('Invalid notification');
  });
});
```

### Pre-Commit Checklist

Before committing any changes, Claude MUST:

1. ✅ Write tests for all new features
2. ✅ Write tests for all bug fixes
3. ✅ Update existing tests if modifying functionality
4. ✅ Run `npm test` and ensure all tests pass
5. ✅ Run `npm run test:coverage` and meet coverage thresholds
6. ✅ Run `npm run build` to ensure TypeScript compiles
7. ✅ Run `npm run lint` to ensure code style compliance

### Test-Driven Development (TDD)

When implementing new features, prefer TDD approach:

1. **Write the test first** - Define expected behavior
2. **Run the test** - Confirm it fails (red)
3. **Implement the feature** - Write minimal code to pass
4. **Run the test** - Confirm it passes (green)
5. **Refactor** - Improve code quality while keeping tests green

### Special Considerations for This Project

#### Discord Bot Testing

- Mock Discord.js Client, Message, and Interaction objects
- Test command parsing and validation
- Test permission checks
- Test rate limiting

#### Database Testing

- Use in-memory SQLite for tests (`:memory:`)
- Test migrations and schema changes
- Test concurrent access scenarios
- Clean up test data after each test

#### Webhook Testing

- Mock Express request/response objects
- Test authentication/authorization
- Test payload validation
- Test error responses

#### Queue Testing

- Test queue ordering (FIFO)
- Test concurrent processing
- Test retry logic
- Test queue overflow handling

### When Tests Can Be Skipped

Tests may only be skipped in these rare cases:

- Documentation-only changes
- Configuration file updates (package.json, tsconfig.json)
- README or markdown updates
- Trivial typo fixes in comments

**All code changes require tests. No exceptions.**

### Continuous Integration

All tests must pass in CI/CD pipeline before merging. Configure GitHub Actions to:

```yaml
- run: npm install
- run: npm run build
- run: npm run lint
- run: npm test
- run: npm run test:coverage
```

### Documentation

Document testing approach in:

1. **Inline comments** - Explain complex test scenarios
2. **Test descriptions** - Clear, readable test names
3. **README.md** - Add testing section with examples
4. **Pull requests** - Include testing summary

---

## Summary

**Remember: Code without tests is incomplete code.** Every feature, bug fix, and modification must include comprehensive tests that verify correctness, handle errors, and cover edge cases.
