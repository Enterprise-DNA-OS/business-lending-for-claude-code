---
description: Close the open credit review with an outcome, a new risk grade and who approved it. The next review is scheduled automatically.
---

```sh
npm run lending -- complete-review "Ashby Engineering" --outcome=watch --grade=7 --approved-by="Priya Nair" --summary="Accounts in. Interest cover below 2." --by="Tom Fraser"
npm run lending -- schedule-review "Moana" --due=+30d --by="Tom Fraser"
```

Outcomes: renew, amend, reduce, exit, watch. Watch and exit put the client on the watchlist. Never record an approval the operator has not named.

Writes need `--by="<operator name>"`; it goes in the audit log. Say back what you are about to record in one line before running it, and show the result after. Never delete a record: close, withdraw or mark it instead.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
