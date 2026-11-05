---
description: Financial information owed to us and not yet received: annual accounts, management accounts, insurance certificates, aged debtors, valuations.
---

```sh
npm run lending -- financials
```

Late items first, with days late. Offer `/draft-chase` for anything more than 14 days late. Record arrivals with `npm run lending -- receive <client> --kind=annual_accounts --by="..."` and new asks with `request`.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
