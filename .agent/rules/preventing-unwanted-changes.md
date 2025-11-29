---
trigger: always_on
description: Best practices for preventing unwanted code changes when working with AI
---

# Preventing Unwanted Changes Rule
For every task the follwoing should be alway respected:

• Follow existing architecture, naming patterns, and module boundaries already in the project.
• Only modify the parts of the code directly required for the task. No refactors, no redesigns, no “improvements” unless the task explicitly asks for them.
• Avoid regressions: don’t break existing features, APIs, or UI flows.
• When adding new functionality, also add/update unit tests where appropriate.
• Keep changes small, readable, and consistent with the current style.
• Never pause to ask for confirmation unless something is genuinely impossible or the task is ambiguous beyond reasonable interpretation.
• If something needs clarification, make a single assumption that’s safest and easiest to revise later, and continue.
• Output only the changed/new code unless full context is needed to understand the solution.