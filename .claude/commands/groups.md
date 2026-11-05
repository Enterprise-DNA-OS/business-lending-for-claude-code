---
description: Connected exposure: every client group with all its entities added together, largest first.
---

```sh
npm run lending -- groups
```

A client group is one risk, however many companies and trusts it trades through. Point out any group whose total exceeds the largest single client, and any group with an entity on the watchlist.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
