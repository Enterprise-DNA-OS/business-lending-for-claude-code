---
description: Facilities maturing soon, with the date a non-extension notice must go out under the Banking Code (para 93).
---

```sh
npm run lending -- maturities --days=180
```

For interest-only, balloon and revolving small business facilities, the notice date is three months before maturity. List any with `decision` undecided and a notice date inside 30 days first, and ask the banker for the decision. Record it with `npm run lending -- amend <facility> --decision=extend|not_extend --reason="..." --by="..."`.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
