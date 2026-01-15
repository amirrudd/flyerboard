---
description: Quick git commands for common operations
---

# Git Quick Commands

Shortcuts for common git operations.

## Check Status

// turbo
```bash
git status -s
```

## View Changes

// turbo
```bash
git diff --stat
```

## Stash and Restore

// turbo
```bash
# Stash current changes
git stash push -m "WIP"
```

// turbo
```bash
# Restore stashed changes
git stash pop
```

## Undo Last Commit (keep changes)

```bash
git reset --soft HEAD~1
```

## Discard All Local Changes (careful!)

```bash
git checkout -- .
```

## Rebase on Main

```bash
git fetch origin
git rebase origin/main
```

## Fix Rebase Conflicts

1. Fix conflicts in files
2. `git add .`
3. `git rebase --continue`

Or abort: `git rebase --abort`
