# Claude Development Guidelines

## Feature Development Workflow

**Every feature added or modified by Claude MUST follow this workflow:**

1. **Plan the feature** - Understand requirements and design
2. **Update existing tests** - Modify tests affected by the changes
3. **Write new tests** - Add comprehensive test coverage for new functionality
4. **Implement the feature** - Write the actual code
5. **Update Docker configuration** - If feature requires config files or new environment variables (see Docker Configuration section)
6. **Verify TypeScript compilation** - Run `npm run build` in all project directories
7. **Remove unused imports** - Clean up all unused code and imports
8. **Verify coverage** - Ensure code coverage thresholds are met
9. **Verify package-lock.json** - Ensure lock files exist for all package.json files
10. **Document the feature** - Add clear usage instructions
11. **Commit and push** - Include tests and documentation in the commit

**No feature is complete without tests, clean TypeScript compilation, AND documentation.**

## Scope Management Guidelines

**CRITICAL: Only implement features that are explicitly requested and within the defined scope.**

### Core Principles

#### 1. Stick to the Defined Scope

**When implementing a feature:**
- ✅ **DO** implement exactly what was requested
- ✅ **DO** focus on the specific problem being solved
- ✅ **DO** implement features that are explicitly mentioned in the task description
- ❌ **DO NOT** add extra features "while you're at it"
- ❌ **DO NOT** implement related but unrequested functionality
- ❌ **DO NOT** over-engineer solutions with unnecessary abstractions
- ❌ **DO NOT** expand scope without explicit user approval

**Example of good scope adherence:**
```
User request: "Add a /status command that shows bot uptime"
✅ GOOD: Implement /status command that displays uptime
❌ BAD: Also add /health, /metrics, /diagnostics commands without being asked
```

**Example of scope creep to avoid:**
```
User request: "Fix the notification queue to handle duplicates"
✅ GOOD: Add duplicate detection to the queue
❌ BAD: Also rewrite the entire queue system with Redis, add retry logic,
        implement priority queues, add metrics, etc.
```

#### 2. When in Doubt, Ask for Clarification

**If you encounter any of these situations, STOP and ask the user:**

- **Ambiguous requirements** - Multiple valid interpretations exist
  - Example: "Add logging" - What should be logged? What log level? Where?

- **Missing specifications** - Critical details not provided
  - Example: "Add rate limiting" - What limits? Per user? Per server? Time window?

- **Implementation choices** - Multiple valid technical approaches
  - Example: "Add caching" - In-memory? Redis? What's the cache invalidation strategy?

- **Scope boundaries** - Unclear if something is in or out of scope
  - Example: "Improve error handling" - Just for webhooks? For entire application?

- **Trade-offs** - Different approaches have different pros/cons
  - Example: "Make it faster" - Optimize for memory or CPU? Acceptable trade-offs?

**Good clarification questions:**
```
User: "Add user authentication"
Claude: "I can help with that. To implement this correctly, I need to clarify a few things:
- What authentication method should I use? (OAuth, JWT, session-based, API keys?)
- Should I integrate with an existing auth provider (Discord, Google, etc.) or implement custom auth?
- What user roles/permissions are needed?
- Should I add user registration, or only login for existing users?"
```

**Bad assumption-making:**
```
User: "Add user authentication"
Claude: "I'll implement OAuth 2.0 with Google and GitHub providers, add role-based
        access control with 5 different roles, implement password reset, 2FA,
        session management, and audit logging."
❌ This makes too many assumptions and expands scope without confirmation
```

#### 3. Avoid "Nice to Have" Additions

**Do NOT add features just because they seem useful:**

❌ **Avoid adding without request:**
- Extra logging "for debugging purposes"
- Additional validation "to be safe"
- Extra configuration options "for flexibility"
- Metrics and monitoring "for observability"
- Alternative implementations "for future use"
- Utility functions "that might be useful later"

✅ **Only add when explicitly requested:**
- Features mentioned in the task description
- Features confirmed by the user during clarification
- Critical dependencies required for the requested feature to work

**Example of unnecessary additions:**
```typescript
// User asked to add a simple /ping command

// ❌ BAD - Scope creep
class PingCommand {
  private metrics: MetricsCollector;        // Not requested
  private logger: Logger;                   // Not requested
  private cache: Cache;                     // Not requested
  private rateLimiter: RateLimiter;        // Not requested

  async execute() {
    this.metrics.increment('ping.count');  // Not requested
    this.logger.info('Ping executed');     // Not requested
    const cached = await this.cache.get(); // Not requested
    // ... complex implementation
  }
}

// ✅ GOOD - Minimal, focused implementation
async function handlePing(): Promise<string> {
  return 'Pong!';
}
```

#### 4. Recognize Implicit vs Explicit Requirements

**Explicit requirements** - Clearly stated, implement these:
- "Add a /notify command"
- "Fix the database connection error"
- "Update the README with setup instructions"

**Implicit requirements** - Necessary for explicit requirements to work:
- If adding a command, basic error handling is implicit
- If fixing a bug, a test to prevent regression is implicit (per our testing guidelines)
- If adding a feature, updating related documentation is implicit (per our documentation guidelines)

**NOT implicit** - Do not assume these are needed:
- Performance optimizations (unless requested or clearly needed)
- Additional features in the same area
- Architectural changes or refactoring
- Alternative implementations
- Extra safety checks beyond standard practice

#### 5. Breaking Down Ambiguous Requests

**When a request could mean different things, break it down:**

```
User: "Improve the notification system"

Claude: "I can help improve the notification system. This request could mean several things:

1. Fix bugs in the current notification system?
2. Add new notification types or features?
3. Improve performance (faster delivery, better queuing)?
4. Enhance reliability (retry logic, error handling)?
5. Add configuration options (customize format, channels)?

Which aspect would you like me to focus on? Or is there a specific issue you're experiencing?"
```

**Don't assume - Ask first, implement second.**

### Scope Management Checklist

Before implementing any feature, verify:

- [ ] **Requirement is explicit** - Clearly stated by the user
- [ ] **Scope is clear** - No ambiguity about what to implement
- [ ] **Boundaries are defined** - Know what's in scope and out of scope
- [ ] **Approach is confirmed** - If multiple approaches exist, user has chosen one
- [ ] **Implicit needs identified** - Only including necessary dependencies, not "nice to haves"

If you cannot check all boxes, **ask for clarification before proceeding**.

### Examples of Good Scope Management

**Example 1: Clear scope, proceed directly**
```
User: "Add a /uptime command that shows how long the bot has been running in hours and minutes"
✅ Scope is clear, implement exactly as requested
```

**Example 2: Ambiguous scope, ask for clarification**
```
User: "Make the bot more reliable"
❌ Too vague
✅ Ask: "What reliability issues are you experiencing? Are you seeing crashes,
       missed messages, slow responses, or something else?"
```

**Example 3: Multiple approaches, confirm choice**
```
User: "Add caching to improve performance"
❌ Don't assume implementation
✅ Ask: "I can implement caching. To choose the best approach:
       - In-memory caching (simple, fast, but lost on restart)?
       - Redis caching (persistent, shareable, requires Redis server)?
       - What data should be cached?
       - What's an acceptable cache lifetime?"
```

**Example 4: Boundary unclear, clarify scope**
```
User: "Fix the error handling"
❌ Don't fix error handling everywhere
✅ Ask: "I can improve error handling. Should I focus on:
       - A specific component (commands, webhooks, database)?
       - The entire application?
       - A particular error you're experiencing?"
```

### Summary

**Golden Rule: When uncertain about scope, always ask. Never assume.**

- Implement only what's explicitly requested
- Ask questions when requirements are ambiguous
- Avoid adding unrequested features
- Stick to the minimum viable implementation
- Get user confirmation before expanding scope

**Remember: It's better to ask a clarifying question than to implement the wrong thing.**

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

## Docker Configuration

**When implementing features that require configuration files or environment variables, Docker configuration MUST be updated.**

### When to Update Docker Configuration

Update Docker-related files when your feature:

- **Requires configuration files** (e.g., JSON, YAML, INI files)
- **Adds new environment variables** that need to be passed to the container
- **Needs persistent storage** beyond the existing data directory
- **Requires mounted volumes** for config or other files

### Docker Configuration Checklist

When adding features with configuration needs:

#### 1. Create Config Directory Structure

```bash
# Create config directory if it doesn't exist
mkdir -p config

# Create example config file
# config/feature-config.json.example
{
  "setting1": "example_value",
  "setting2": true
}

# Create default config (if safe defaults exist)
# config/feature-config.json
{
  "setting1": "default_value",
  "setting2": false
}
```

#### 2. Update .gitignore

**Always gitignore config files that contain sensitive data:**

```gitignore
# Permission config (contains user IDs)
config/ha-permissions.json

# Sensitive config files
config/secrets.json
config/*.key
```

**Keep example files in git:**
- ✅ `config/feature-config.json.example` - Committed to git
- ❌ `config/feature-config.json` - Gitignored (user-specific)

#### 3. Update docker-compose.yml

**Add environment variables:**

```yaml
services:
  discord-bot:
    environment:
      # Your new environment variables
      - FEATURE_CONFIG_PATH=${FEATURE_CONFIG_PATH:-/app/config/feature-config.json}
      - FEATURE_ENABLED=${FEATURE_ENABLED:-false}
```

**Add volume mounts:**

```yaml
services:
  discord-bot:
    volumes:
      - ./data:/app/data           # Existing
      - ./config:/app/config       # Add this if not present
      - ./logs:/app/logs           # Example: if feature needs logs directory
```

#### 4. Update .env.example

**Document new environment variables:**

```bash
# Feature Name Configuration (optional)
FEATURE_CONFIG_PATH=./config/feature-config.json  # Path to feature config
FEATURE_ENABLED=false                              # Enable/disable feature (default: false)
FEATURE_TIMEOUT=5000                               # Feature timeout in ms (default: 5000)
```

**Include helpful comments:**
- What the variable does
- Default value
- Whether it's required or optional
- Valid values or format

#### 5. Update setup.sh

**Add directory creation and config initialization:**

```bash
# Create config directory if it doesn't exist
if [ ! -d "config" ]; then
    echo "Creating config directory..."
    mkdir -p config
    echo "✓ Config directory created"
else
    echo "✓ Config directory already exists"
fi

# Copy example config if it doesn't exist
if [ ! -f "config/feature-config.json" ]; then
    if [ -f "config/feature-config.json.example" ]; then
        echo "Copying feature config example file..."
        cp config/feature-config.json.example config/feature-config.json
        echo "✓ Created config/feature-config.json (edit this file to configure feature)"
    fi
else
    echo "✓ config/feature-config.json already exists"
fi
```

#### 6. Update README.md Docker Instructions

**Add setup steps in the Docker deployment section:**

```markdown
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

2. **(Optional) Configure Feature Name**:
   If using Feature Name, create the config file:
   ```bash
   cp config/feature-config.json.example config/feature-config.json
   # Edit config/feature-config.json with your settings
   ```

3. **Start with Docker Compose**:
   ```bash
   docker compose up --build -d
   ```
```

### Example: HA Permissions Feature

**Complete example of Docker configuration for the HA permissions feature:**

1. **Created files:**
   - `config/ha-permissions.json.example` - Template
   - `config/ha-permissions.json` - User config (gitignored)

2. **Updated docker-compose.yml:**
   ```yaml
   environment:
     - HA_PERMISSIONS_CONFIG=${HA_PERMISSIONS_CONFIG:-/app/config/ha-permissions.json}
   volumes:
     - ./config:/app/config
   ```

3. **Updated .env.example:**
   ```bash
   HA_PERMISSIONS_CONFIG=./config/ha-permissions.json
   ```

4. **Updated setup.sh:**
   ```bash
   mkdir -p config
   cp config/ha-permissions.json.example config/ha-permissions.json
   ```

5. **Updated README.md:**
   - Added optional setup step for HA permissions
   - Documented how to configure permissions before starting container

### Docker Configuration Best Practices

#### Environment Variables

**Default values:**
- ✅ Always provide sensible defaults in docker-compose.yml
- ✅ Use `${VAR:-default}` syntax for optional variables
- ❌ Don't require environment variables that have safe defaults

**Path variables:**
- ✅ Use absolute paths inside container (`/app/config/file.json`)
- ✅ Use relative paths in .env.example (`./config/file.json`)
- ✅ Document both container and host paths

#### Volume Mounts

**Organization:**
- ✅ Mount config directories separately from data directories
- ✅ Keep persistent data in `./data` mount
- ✅ Keep configuration in `./config` mount
- ❌ Don't mix different types of files in the same mount

**Permissions:**
- ✅ Let container handle permissions via entrypoint script
- ✅ Document any permission requirements
- ❌ Don't rely on host system permissions

#### Config Files

**Security:**
- ✅ Always gitignore files containing sensitive data
- ✅ Provide example files with dummy/safe values
- ✅ Document what data is sensitive
- ❌ Never commit real credentials or user data

**Defaults:**
- ✅ Fail-secure: deny by default if config is missing
- ✅ Validate config file format on startup
- ✅ Log clear error messages if config is invalid
- ❌ Don't silently ignore invalid configs

### Testing Docker Configuration

**Before committing, verify:**

```bash
# 1. Run setup script
./setup.sh

# 2. Verify directories created
ls -la data/ config/

# 3. Verify config files created
ls -la config/

# 4. Test Docker build
docker compose build

# 5. Test Docker startup
docker compose up -d

# 6. Check logs for config loading
docker compose logs

# 7. Verify feature works in container
# (Test the actual feature)

# 8. Clean up test
docker compose down
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Config file not found | Volume not mounted | Add volume mount in docker-compose.yml |
| Permission denied | Container can't write to mounted volume | Check volume mount and entrypoint script |
| Environment variable not set | Not defined in docker-compose.yml | Add to environment section |
| Config not loaded | Wrong path in container | Use absolute path inside container |

---

## Summary

**Remember: Code without tests, clean builds, Docker configuration, AND documentation is incomplete code.**

Every feature, bug fix, and modification must include:
1. **Comprehensive tests** - Unit, integration, error handling, and edge cases
2. **Updated test coverage** - Modify existing tests and add new ones
3. **Clean TypeScript compilation** - No errors, no unused imports, verified builds in all directories
4. **Valid package-lock.json files** - Present for all package.json files
5. **Docker configuration** - Updated docker-compose.yml, .env.example, setup.sh if feature requires config files or env vars
6. **Clear documentation** - Usage instructions, examples, and API docs

**The feature is not done until it has tests, compiles cleanly, has Docker configuration (if needed), and has documentation.**

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
