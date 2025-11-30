---
trigger: always_on
description: Best practices for preventing unwanted code changes when working with AI
---

# Preventing Unwanted Changes Rule

For every task, the following rules must always be respected:

• Follow the existing architecture, naming conventions, and module boundaries already established in the project.
• Modify only the code directly required to complete the task. No refactors, redesigns, or “improvements” unless explicitly requested.
• Avoid regressions—do not break existing features, APIs, or UI flows.
• When adding or updating functionality, also add or update the related unit tests.
• Keep changes small, readable, and consistent with the current style.
• Do not pause for confirmation unless the task is truly impossible or unreasonably ambiguous.
• When clarification is needed, make a safe, minimal assumption and proceed.
• Output only the new or changed code unless full context is absolutely necessary.
• Run tests to ensure no regressions, and update tests when functionality changes.
• After completing a task, update relevant documents in .agent/rules (excluding .agent/rules/user-instructed-guideline.md) when needed so the project context stays accurate for future tasks.