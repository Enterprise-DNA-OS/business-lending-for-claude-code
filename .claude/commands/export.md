---
description: Write every table to CSV files you can open anywhere.
---

```sh
npm run lending -- export
npm run lending -- export --out=exports/year-end
```

Say where the files went and how many rows each has. Exports hold client data: they stay out of git (`exports/` is ignored).

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
