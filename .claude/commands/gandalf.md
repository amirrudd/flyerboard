---
description: Ask Gandalf, FlyerBoard's product partner, about a feature, plan, diff, or product question
---

Invoke the `gandalf` agent.

Target: $ARGUMENTS

If no target was given, ask Gandalf to review the current branch's diff against `main`
(`git diff main...HEAD`) plus any plan file modified on this branch, as a product change.

Pass the agent the full text of what to review. Relay its answer as it is. Do not add
praise, do not lengthen it, and do not decide anything it left for Amir.
