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
• Add test for new functionality and edit test if a functionality is updated. Run tests to make sure there is no regression.
• After each task, if neccessary, update the relevant documents in .agent\rules (except .agent\rules\preventing-unwanted-changes.md) to make sure the context of project is alway up to date for the next new task. These file only store nessearry context for AI agent to have a good context of the codebase.