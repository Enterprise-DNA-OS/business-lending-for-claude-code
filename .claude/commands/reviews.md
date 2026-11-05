---
description: Annual credit reviews due or overdue, and active clients with no review scheduled.
---

```sh
npm run lending -- reviews --days=60
```

Overdue first. For clients with none scheduled, offer to run `schedule-review`. For a review due in the next fortnight, offer `/draft-review-paper`.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
