---
description: Fix port conflicts when dev server or backend won't start
---

# Fix Port Conflicts

Use when "port already in use" errors occur.

## Common Ports

| Port | Service |
|------|---------|
| 5173 | Vite dev server |
| 5174 | Vite (fallback) |
| 3210 | Convex dev |
| 3000 | Alternative dev server |

## Quick Fix Steps

// turbo
1. **Find what's using the port**
   ```bash
   lsof -i :5173 -i :3210 | grep LISTEN
   ```

// turbo
2. **Kill the process**
   ```bash
   lsof -ti :5173 | xargs kill -9 2>/dev/null; lsof -ti :3210 | xargs kill -9 2>/dev/null
   ```

3. **Restart services**
   ```bash
   # Terminal 1
   npx convex dev
   
   # Terminal 2
   npm run dev
   ```

## If Still Failing

```bash
# Nuclear option - kill all node
pkill -f "node"

# Wait a moment
sleep 2

# Restart
npm run dev
```
