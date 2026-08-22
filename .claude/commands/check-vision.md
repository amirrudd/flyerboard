---
description: Check a plan, diff, or feature against FlyerBoard's product rules
---

Invoke the `product-guardian` agent to check for contradictions against
`.agent/PRODUCT-RULES.md`.

Target: $ARGUMENTS

If no target was given, check the current branch's diff against `main`
(`git diff main...HEAD`), plus any plan file modified on this branch.

Pass the agent the full text of what it should review, and tell it to verify every
claim against the actual code rather than trusting the description.

Relay its findings verbatim. Do not soften them, do not add praise it deliberately
omitted, and do not resolve any contradiction it reports — those are Amir's decisions.
