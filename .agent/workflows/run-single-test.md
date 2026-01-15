---
description: Run a single test file quickly
---

# Run Single Test

Use to quickly run and debug a specific test file.

## Quick Command

// turbo
```bash
npm test -- ComponentName.test.tsx --run
```

## With Watch Mode (for iterating)

```bash
npm test -- ComponentName.test.tsx
```

## With Verbose Output

// turbo
```bash
npm test -- ComponentName.test.tsx --run --reporter=verbose 2>&1 | tail -100
```

## Run Specific Test by Name

```bash
npm test -- -t "test name pattern" --run
```

## If Tests Hang

```bash
# Kill and retry
pkill -f "vitest"
npm test -- ComponentName.test.tsx --run
```
