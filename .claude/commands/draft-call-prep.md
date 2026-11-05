---
description: A one-page brief before a client call or visit, in drafts/.
---

1. Run `npm run lending -- show "<client>" --json` and `npm run lending -- history "<client>" --json`.
2. Write `drafts/<YYYY-MM-DD>-<client code>-call-prep.md`: who they are and who we deal with, exposure and headroom, anything late or due (reviews, financials, covenant tests, maturities), the open deals, what we promised last time, and three questions to ask.

Keep it to one page. Nothing sends.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
