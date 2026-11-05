---
description: The lending book by banker: clients, limits, drawn, average risk grade, watchlist count.
---

```sh
npm run lending -- book
npm run lending -- concentration
```

Show both tables. Then call out the largest banker book, any industry above 25 percent of limits, and the watchlist exposure in dollars.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
