---
description: Kill hung or long-running processes like stuck tests
---

# Kill Hung Processes

Use when tests or dev servers are stuck/hung.

## Quick Commands

// turbo
### Kill specific npm test process
```bash
pkill -f "vitest"
```

// turbo
### Kill all node processes (nuclear option)
```bash
pkill -f "node"
```

// turbo
### Find what's running on a port
```bash
lsof -i :5173 | head -5
```

// turbo
### Kill process on specific port
```bash
lsof -ti :5173 | xargs kill -9
```

## Common Stuck Scenarios

### Tests running forever (> 5 minutes)
```bash
# Kill vitest
pkill -f "vitest"

# Then re-run
npm test -- --run
```

### Dev server won't start (port in use)
```bash
# Find what's using the port
lsof -i :5173

# Kill it
lsof -ti :5173 | xargs kill -9

# Restart
npm run dev
```

### Convex dev hanging
```bash
# Kill convex
pkill -f "convex"

# Restart
npx convex dev
```
