---
description: One client on one page: facilities, covenants, financials owed, reviews, pipeline, notices, recent contact and contacts.
---

```sh
npm run lending -- show "<client name or code>"
npm run lending -- history "<client>"   # audit log and call notes, newest first
```

Summarise in three lines first: exposure (limits and drawn), the one thing that is late or due, and when they last heard from us. Then show the full output.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
