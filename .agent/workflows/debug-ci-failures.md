---
description: Debug when tests pass locally but fail in CI
---

# Debug CI vs Local Differences

Use when CI fails but local tests pass.

## Common Causes

1. **Environment differences** - CI has clean state
2. **Timing issues** - CI is slower, timeouts may differ
3. **Missing mocks** - Works locally due to cached state
4. **File path differences** - Case sensitivity on Linux CI

## Debug Steps

// turbo
1. **Run tests in CI mode locally**
   ```bash
   npm test -- --run --reporter=verbose 2>&1 | tail -50
   ```

// turbo
2. **Check for flaky tests**
   ```bash
   # Run 3 times to catch flaky tests
   npm test -- --run && npm test -- --run && npm test -- --run
   ```

// turbo
3. **Clean and rebuild**
   ```bash
   rm -rf node_modules/.vite dist
   npm run build
   ```

4. **Check CI logs**
   - Look for the exact error message
   - Compare environment variables
   - Check if file paths match

## Common Fixes

### Test timeout
```typescript
// Increase timeout for slow CI
test('slow test', async () => {
  // ...
}, { timeout: 10000 });
```

### Missing mock
```typescript
// Ensure mock is set up before each test
beforeEach(() => {
  vi.mock('...', () => ({...}));
});
```

### Case sensitivity
```typescript
// Wrong (works on Mac, fails on Linux)
import { Component } from './component';

// Right
import { Component } from './Component';
```
