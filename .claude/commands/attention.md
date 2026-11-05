---
description: Everything that needs a banker this week, worst first: overdue reviews, Banking Code notice deadlines, covenant breaches and tests, late financials, KYC refreshes, quiet clients, overdue follow-ups.
---

```sh
npm run lending -- attention            # whole desk
npm run lending -- attention --banker=hana
```

Present it as one table grouped by banker. Lead with severity 1 items (overdue reviews, notice deadlines, covenant breaches). For each, add one line on the next action and the command that records it (`test`, `receive`, `complete-review`, `log`, `notice`). Finish with a count per issue type.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
