---
name: verify
description: Build/launch/drive recipe for verifying FlyerBoard web changes at runtime (dev servers + Chrome DevTools MCP)
---

# Verifying FlyerBoard web changes at runtime

## Launch (from the worktree/repo root you're verifying)

1. `.env.local` must exist in the worktree — `cp <main-repo>/.env.local .` if missing (Vite throws without it).
2. Clear ports: `lsof -ti :5173 -sTCP:LISTEN | xargs kill; lsof -ti :3210 -sTCP:LISTEN | xargs kill` — the `-sTCP:LISTEN` filter matters: without it the kill hits Chrome tabs holding connections to the port, not just the server.
3. Start BOTH servers as separate background Bash tasks (not `npm run dev` — its combined output is noisy and it dies if either port races):
   - `npm run dev:backend` — local Convex backend on :3210 (`VITE_CONVEX_URL=http://127.0.0.1:3210`, anonymous local deployment with seeded dev data: ads, an active bundle, feature flags ON).
   - `npm run dev:frontend` — Vite on :5173.
4. Ready when `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/` → 200 and something listens on :3210.

## Drive (Chrome DevTools MCP)

- `new_page` → `navigate_page` to `http://localhost:5173/`. The feed needs ~3–4s to hydrate (Convex websocket).
- Seeded dev data check: `npx convex run bundles:getActiveBundleFeedCards '{}'` (CLI hits the local anonymous deployment).
- Category feed: `/?category=electronics` (slug-based).

## Gotchas

- **Loading-race verification**: CLS from a performance trace does NOT discriminate locally — the local backend answers in ms, so shifts score ~0.01 either way. Instead inject a rAF poller via `navigate_page`'s `initScript` that samples the grid every frame and logs state transitions:
  - skeletons: `grid.querySelectorAll('.animate-pulse, .shimmer').length`
  - cards: `grid.querySelectorAll('.listings-grid > *').length`
  - grid root: `[data-testid="ads-grid"]`
  A late pop-in shows as cards N → N+1 across frames after skeletons clear.
- `initScript` runs at document_start: `document.documentElement` may be null — a MutationObserver on it throws silently. Use a `requestAnimationFrame` loop instead.
- For A/B against the pre-fix state: `git stash push <file>` → Vite hot-reloads → drive → `git stash pop`.
