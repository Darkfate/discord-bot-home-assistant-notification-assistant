# Claude Development Guidelines

## Feature Development Workflow

**Every feature added or modified by Claude MUST follow this workflow:**

1. **Plan the feature** - Understand requirements and design
2. **Update existing tests** - Modify tests affected by the changes
3. **Write new tests** - Add comprehensive test coverage for new functionality
4. **Implement the feature** - Write the actual code
5. **Verify TypeScript compilation** - Run `npm run build` in all project directories
6. **Remove unused imports** - Clean up all unused code and imports
7. **Verify coverage** - Ensure code coverage thresholds are met
8. **Verify package-lock.json** - Ensure lock files exist for all package.json files
9. **Document the feature** - Add clear usage instructions
10. **Commit and push** - Include tests and documentation in the commit

**No feature is complete without tests, clean TypeScript compilation, AND documentation.**

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

#### 1. Test for Correctness, Not Just Coverage

**CRITICAL: Tests must verify expected behavior, not just exist to increase coverage metrics.**

**Good tests:**
- ✅ Define clear expected behavior and verify it
- ✅ Test specific inputs produce specific outputs
- ✅ Verify error conditions throw expected errors with correct messages
- ✅ Can fail when the code is incorrect
- ✅ Have meaningful assertions that actually validate something

**Bad tests to AVOID:**
- ❌ `expect(true).toBe(true)` - Tautologies that always pass
- ❌ `expect(error).toBeDefined()` in a catch block - Always passes since catch only runs on error
- ❌ Tests that accept any outcome as valid
- ❌ Tests that can never fail
- ❌ Tests written just to hit coverage thresholds
- ❌ Try-catch blocks where both success and failure are considered valid

**Example of a BAD test:**
```typescript
// ❌ BAD - This test provides no value
it('should handle errors gracefully', async () => {
  try {
    await riskyOperation();
    expect(true).toBe(true); // Always passes
  } catch (error) {
    expect(error).toBeDefined(); // Always passes in catch block
  }
});
```

**Example of a GOOD test:**
```typescript
// ✅ GOOD - Clear expectation of behavior
it('should throw DatabaseError when connection fails', async () => {
  await expect(database.initialize('/invalid/path'))
    .rejects
    .toThrow('Database connection failed');
});

// ✅ GOOD - Tests specific behavior
it('should return null when user not found', async () => {
  const result = await database.getUserById(999);
  expect(result).toBeNull();
});
```

**Before writing any test, ask yourself:**
1. What specific behavior am I testing?
2. What is the expected outcome?
3. Could this test ever fail if the code is wrong?
4. Am I testing actual behavior or just writing code that always passes?

**If a test can't fail, delete it. It's worse than no test because it creates false confidence.**

#### 2. What to Test

**Every feature MUST have:**

- **Unit tests** for individual functions and methods
- **Integration tests** for components that interact with external services
- **Error handling tests** for all error scenarios
- **Edge case tests** for boundary conditions

**When modifying existing features:**

- **Update affected tests** - Modify existing tests that are impacted by your changes
- **Add new test cases** - Add tests for new functionality within existing features
- **Verify all tests pass** - Ensure modifications don't break existing tests
- **Increase coverage** - Add tests for previously uncovered code paths if applicable

#### 3. Test Organization

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

#### 4. Test Naming Convention

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

#### 5. Mocking External Dependencies

Always mock external services:

```typescript
// Mock Discord.js client
jest.mock('discord.js');

// Mock database
jest.mock('../src/database');

// Mock Home Assistant API calls
jest.mock('node-fetch');
```

#### 6. Test Coverage Requirements

**Coverage is a side-effect of good tests, not the goal.**

- **Minimum 70% coverage** for all new code
- **100% coverage** for critical paths (authentication, data persistence, notifications)
- Run `npm run test:coverage` to check coverage

**IMPORTANT**: Never write meaningless tests just to hit coverage numbers. A single good test that verifies behavior is better than ten tests with `expect(true).toBe(true)`.

#### 7. Example Test Structure

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

#### Testing Requirements
1. ✅ **Update existing tests** affected by changes
2. ✅ **Write new tests** for all new features
3. ✅ **Write tests** for all bug fixes
4. ✅ **Add edge case tests** for boundary conditions
5. ✅ **Run `npm test`** and ensure all tests pass
6. ✅ **Run `npm run test:coverage`** and meet coverage thresholds (minimum 70%)
7. ✅ **Verify critical paths** have 100% coverage

#### Code Quality & Build Verification
8. ✅ **Run `npm run build`** in ALL project directories (root AND sandbox/frontend) to ensure TypeScript compiles
9. ✅ **Verify no unused imports** in TypeScript files
10. ✅ **Verify all imported modules exist** (especially from third-party libraries)
11. ✅ **Test Docker build locally** if Dockerfile or dependencies changed
12. ✅ **Run `npm run lint`** to ensure code style compliance
13. ✅ **Review code** for security vulnerabilities

#### Documentation Requirements
14. ✅ **Update README.md** with feature usage and examples
15. ✅ **Add JSDoc/TSDoc comments** to all public APIs
16. ✅ **Include usage examples** in documentation
17. ✅ **Document error handling** and common issues
18. ✅ **Update CHANGELOG.md** with changes
19. ✅ **Document breaking changes** if applicable

**All three categories (Testing, Code Quality, Documentation) must be completed before commit.**

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

### Testing Documentation

Document testing approach in:

1. **Inline comments** - Explain complex test scenarios
2. **Test descriptions** - Clear, readable test names
3. **README.md** - Add testing section with examples
4. **Pull requests** - Include testing summary

---

## TypeScript and Build Quality

**All TypeScript code must compile without errors before committing. This is critical for Docker builds.**

### TypeScript Compilation Standards

#### 1. Import Management

**CRITICAL: Unused imports will cause Docker build failures.**

**Good import practices:**
- ✅ Only import what you actually use
- ✅ Remove unused imports immediately
- ✅ Verify imports exist in the package before using them
- ✅ Check third-party library documentation for correct export names

**Bad import practices:**
- ❌ Leaving unused imports (e.g., `useState` when not used)
- ❌ Importing non-existent exports from libraries (e.g., `Flask` instead of `FlaskConical` from lucide-react)
- ❌ Importing types that are never referenced
- ❌ Keeping imports after refactoring code that used them

**Example of cleanup needed:**

```typescript
// ❌ BAD - Unused imports
import { useState, useEffect } from 'react';
import { Button, Select } from './ui';
import type { User, Profile } from './types';

function MyComponent() {
  return <Button>Click me</Button>;
}

// ✅ GOOD - Only used imports
import { Button } from './ui';

function MyComponent() {
  return <Button>Click me</Button>;
}
```

#### 2. Third-Party Library Verification

**Before using any import from a third-party library:**

1. **Check the library documentation** - Verify the export name exists
2. **Check package version** - Ensure you're using the correct version
3. **Test locally** - Build the project to verify the import works
4. **Common library gotchas:**
   - Icon libraries (lucide-react, react-icons): Icon names change between versions
   - UI libraries: Component exports may differ from documentation
   - Type libraries: Type names must match exactly

**Example verification process:**

```typescript
// Step 1: Check documentation or node_modules
// lucide-react exports: Check node_modules/lucide-react/dist/index.d.ts
// or official docs: https://lucide.dev

// Step 2: Use correct import
import { FlaskConical } from 'lucide-react'; // ✅ GOOD - Exists in library

// NOT:
import { Flask } from 'lucide-react'; // ❌ BAD - Doesn't exist in current version
```

#### 3. Type Safety

**Avoid implicit any types:**

```typescript
// ❌ BAD - Implicit any
const handleData = (data) => {
  return data.value;
};

// ✅ GOOD - Explicit types
const handleData = (data: { value: string }) => {
  return data.value;
};
```

**Use type imports for type-only references:**

```typescript
// ✅ GOOD - Import type separately if only used as type
import type { NotificationCreateRequest } from '../types/api';

// Also good if used as both type and value
import { NotificationCreateRequest } from '../types/api';
```

#### 4. Pre-Commit Build Verification

**MANDATORY: Always run builds before committing:**

```bash
# For root project
cd /path/to/project
npm run build

# For sandbox frontend
cd /path/to/project/sandbox/frontend
npm run build

# Both must complete without errors
```

**Common TypeScript errors to watch for:**

- `TS6133`: Declared but never read (unused variable/import)
- `TS2305`: Module has no exported member (wrong import name)
- `TS7006`: Parameter implicitly has any type (missing type annotation)
- `TS2307`: Cannot find module (missing dependency or wrong path)

### Multi-Project Build Verification

**This project has multiple TypeScript projects:**

1. **Root project** (`/`) - Main bot application
2. **Sandbox frontend** (`/sandbox/frontend`) - React frontend

**IMPORTANT: Both projects must build successfully.**

```bash
# Test root project
npm run build

# Test sandbox frontend
cd sandbox/frontend && npm run build

# If either fails, fix errors before committing
```

### Docker Build Considerations

**Docker builds will fail for any TypeScript compilation error.**

#### 1. Missing package-lock.json Files

**CRITICAL: Every package.json must have a corresponding package-lock.json.**

```bash
# Generate package-lock.json if missing
cd sandbox/frontend
npm install --package-lock-only --legacy-peer-deps
git add package-lock.json
```

**Why this matters:**
- `npm ci` (used in Docker) requires `package-lock.json`
- `npm ci` installs exact versions for reproducible builds
- Missing lock files cause immediate build failure

#### 2. Dependency Management

**Keep dependencies in sync:**

```json
// In package.json
{
  "dependencies": {
    "react": "^18.2.0",
    "lucide-react": "^0.292.0"
  }
}
```

**After adding/updating dependencies:**

```bash
# Update lock file
npm install

# Commit both files
git add package.json package-lock.json
```

#### 3. Dockerfile Verification

**When modifying frontend code, verify Docker build:**

```bash
# Test full Docker build
docker build -t test-build .

# This catches:
# - Missing package-lock.json
# - TypeScript compilation errors
# - Dependency issues
# - Build script failures
```

**If you don't have Docker locally, ensure:**
- ✅ All `package-lock.json` files exist
- ✅ Local `npm run build` succeeds in all directories
- ✅ No TypeScript errors reported

#### 4. Common Docker Build Failures

| Error | Cause | Solution |
|-------|-------|----------|
| `npm ci` requires package-lock.json | Missing lock file | Run `npm install --package-lock-only` |
| Module has no exported member | Wrong import name | Check library docs, fix import |
| Declared but never read | Unused import/variable | Remove unused code |
| Cannot find module | Missing dependency | Add to package.json, run `npm install` |

### IDE and Editor Integration

**Configure your editor to catch errors early:**

**VSCode settings.json:**
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true,
    "source.fixAll": true
  }
}
```

**Benefits:**
- Auto-remove unused imports on save
- Highlight type errors in real-time
- Show available exports from libraries

### TypeScript Best Practices Summary

**Before every commit:**

1. ✅ Remove all unused imports
2. ✅ Verify all imports exist in their libraries
3. ✅ Run `npm run build` in ALL project directories
4. ✅ Fix all TypeScript errors (no `any` types unless necessary)
5. ✅ Ensure package-lock.json exists for all package.json files
6. ✅ Test Docker build if you modified dependencies or Dockerfile

**Remember: TypeScript errors in development become Docker build failures in CI/CD.**

---

## Documentation Requirements

**Every feature MUST be documented with clear, user-friendly instructions.**

### What to Document

When adding or modifying features, create or update documentation that includes:

#### 1. Feature Overview

- **Purpose** - What the feature does and why it exists
- **Use cases** - When and why users would use this feature
- **Prerequisites** - Any setup or requirements needed

#### 2. Usage Instructions

**Must include step-by-step instructions with examples:**

```markdown
## Feature Name

### Description
Brief explanation of what this feature does.

### Prerequisites
- Requirement 1
- Requirement 2

### Usage

#### Basic Usage
\`\`\`typescript
// Example code showing basic usage
const result = myFeature.doSomething();
\`\`\`

#### Advanced Usage
\`\`\`typescript
// Example showing advanced scenarios
const advanced = myFeature.doSomethingAdvanced({
  option1: 'value',
  option2: true
});
\`\`\`

#### Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| option1 | string | 'default' | What this does |
| option2 | boolean | false | What this controls |

### Error Handling
Common errors and how to resolve them:
- **Error X**: Cause and solution
- **Error Y**: Cause and solution

### Examples
Real-world examples of using the feature.
```

#### 3. API Documentation

For functions, classes, and methods:

```typescript
/**
 * Brief description of what this function does
 *
 * @param param1 - Description of parameter 1
 * @param param2 - Description of parameter 2
 * @returns Description of return value
 * @throws {ErrorType} Description of when this error is thrown
 *
 * @example
 * ```typescript
 * const result = myFunction('value1', true);
 * console.log(result); // Expected output
 * ```
 */
export function myFunction(param1: string, param2: boolean): ResultType {
  // implementation
}
```

#### 4. Update Existing Documentation

When modifying features:

- **Update README.md** - Modify examples and usage instructions
- **Update inline comments** - Keep JSDoc comments current
- **Update CHANGELOG.md** - Document what changed and why
- **Update migration guides** - If breaking changes are introduced

### Where to Document

#### Primary Locations

1. **README.md** - Main project documentation
   - Getting started guide
   - Feature overview
   - Basic usage examples
   - Links to detailed documentation

2. **Inline code comments** - Technical documentation
   - JSDoc/TSDoc comments for all public APIs
   - Explain complex logic
   - Document non-obvious decisions

3. **Separate docs/ folder** - Detailed guides (if applicable)
   - `docs/features/` - Individual feature documentation
   - `docs/api/` - API reference
   - `docs/guides/` - How-to guides and tutorials

4. **CHANGELOG.md** - Track changes over time
   - Document all features, fixes, and changes
   - Include version numbers and dates
   - Link to relevant issues/PRs

#### Discord Bot Specific Documentation

For Discord bot features, document:

- **Command syntax** - Exact command format
- **Parameters** - Required and optional parameters
- **Permissions** - Required bot and user permissions
- **Examples** - Sample commands and expected responses
- **Rate limits** - Any usage restrictions

Example:

```markdown
### /notify Command

**Description**: Sends a notification to configured Discord channel from Home Assistant.

**Syntax**: `/notify <message> [--priority <level>]`

**Parameters**:
- `message` (required): The notification message to send
- `--priority` (optional): Priority level (low, medium, high). Default: medium

**Required Permissions**:
- Bot: SEND_MESSAGES, EMBED_LINKS
- User: MANAGE_MESSAGES (for high priority)

**Examples**:
\`\`\`
/notify "Front door opened"
/notify "Temperature critical!" --priority high
\`\`\`

**Response**: Confirmation message with notification ID
```

### Documentation Checklist

Before committing, ensure:

- [ ] **README.md updated** with feature overview and basic usage
- [ ] **Inline comments added** for all public functions/methods
- [ ] **JSDoc/TSDoc complete** with examples for all exported APIs
- [ ] **Usage examples provided** showing common scenarios
- [ ] **Error handling documented** with common errors and solutions
- [ ] **Configuration options listed** in a clear table format
- [ ] **Prerequisites documented** if feature has dependencies
- [ ] **Breaking changes noted** in CHANGELOG.md if applicable

### Documentation Quality Standards

Good documentation is:

- **Clear** - Easy to understand for target audience
- **Concise** - No unnecessary information
- **Complete** - Covers all use cases and edge cases
- **Current** - Always matches the actual code behavior
- **Examples-driven** - Shows practical usage, not just theory

Bad documentation:

- ❌ "This function does stuff" - Too vague
- ❌ No examples - Users don't know how to use it
- ❌ Outdated - Doesn't match current implementation
- ❌ Missing error cases - Users don't know what can go wrong

Good documentation:

- ✅ Clear purpose and use cases
- ✅ Multiple practical examples
- ✅ Up-to-date with code
- ✅ Documents errors and edge cases

---

## Summary

**Remember: Code without tests, clean builds, AND documentation is incomplete code.**

Every feature, bug fix, and modification must include:
1. **Comprehensive tests** - Unit, integration, error handling, and edge cases
2. **Updated test coverage** - Modify existing tests and add new ones
3. **Clean TypeScript compilation** - No errors, no unused imports, verified builds in all directories
4. **Valid package-lock.json files** - Present for all package.json files
5. **Clear documentation** - Usage instructions, examples, and API docs

**The feature is not done until it has tests, compiles cleanly, and has documentation.**

### Quick Pre-Commit Checklist

Run these commands before every commit:

```bash
# 1. Build all projects
npm run build
cd sandbox/frontend && npm run build && cd ../..

# 2. Run all tests
npm test
npm run test:coverage

# 3. Verify no TypeScript errors
# (Should be clean from step 1)

# 4. Commit with descriptive message
git add .
git commit -m "Your descriptive commit message"
git push
```

**If any step fails, fix the issues before pushing.**
