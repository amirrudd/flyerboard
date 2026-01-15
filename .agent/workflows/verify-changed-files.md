---
description: Verify all changed files before completing a task
---

# Verify Changed Files Workflow

Quick verification before marking a task complete.

## Steps

// turbo
1. **Check for TypeScript errors**
   ```bash
   npm run build 2>&1 | head -30
   ```

// turbo
2. **Run tests**
   ```bash
   npm test -- --run
   ```

3. **Code Review Only**
   - Verify logic for UI states and responsive classes.
   - AI will NOT open the browser for visual checks unless requested by the user.

## Essential Checks

- [ ] No TypeScript errors
- [ ] Tests pass
- [ ] Solutions follow architecture guidelines and docs
- [ ] Unit tests added for critical logic
- [ ] No redundant comments or dead code (except TODOs)
- [ ] Feature logic verified in code
- [ ] Responsive logic verified (Tailwind/CSS)

## When to Update Documentation

| Change Type | Update Location |
|------------|-----------------|
| New patterns learned | `.agent/gatheredContext/` |
| Architecture decisions | `docs/architecture/` |
| Bug fixes with gotchas | `.agent/gatheredContext/` |