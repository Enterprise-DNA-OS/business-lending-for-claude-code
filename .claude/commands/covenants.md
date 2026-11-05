---
description: Covenant tests due or overdue, with the last result, plus every breach and waiver on record.
---

```sh
npm run lending -- covenants --days=30
npm run lending -- breaches
```

For a financial covenant, say what figure is needed and where it comes from (the annual or management accounts). For a reporting covenant, say what document is owed. A breach needs a decision from credit: waive with a note, or a default notice through `/notice`.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
