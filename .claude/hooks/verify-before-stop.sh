#!/bin/bash
# Stop hook: block the agent from "claiming done" while TypeScript is broken.
# Mirrors the type-check half of `npm run lint` (the fast half — no vite build / convex --once;
# those run in CI). Requires `jq`.
#
# Contract (code.claude.com/docs/en/hooks.md):
#   - exit 0  -> allow the agent to stop
#   - exit 2  -> block the stop; stderr is fed back to the model as feedback
#   - MUST honour `stop_hook_active` to avoid an infinite re-block loop.

INPUT=$(cat)

# Infinite-loop guard: if we already blocked once this turn, let it stop.
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi

CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
if [ -n "$CWD" ]; then
  cd "$CWD" || exit 0
fi

# Type-check backend (convex) + frontend (src/ via build mode).
# NOTE: `tsc -p .` is a no-op here — root tsconfig is references-only, so it
# checks nothing in src/. `tsc -b` (build mode) follows the project references
# and actually type-checks the frontend.
if npx tsc -p convex -noEmit --pretty false && npx tsc -b --pretty false; then
  exit 0
fi

echo "Type check failed (tsc). Fix the errors above before finishing the turn." >&2
exit 2
