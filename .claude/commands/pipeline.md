---
description: Open deals by stage with days since each last moved.
---

```sh
npm run lending -- pipeline
npm run lending -- pipeline --all     # include settled and lost
```

Flag any deal idle more than 21 days and any expected date already past. Move a deal with `npm run lending -- move OPP-02 --stage=application --by="..."` (a lost deal needs `--reason`).

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
