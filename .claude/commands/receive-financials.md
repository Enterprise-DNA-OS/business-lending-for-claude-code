---
description: Record financial information received, or ask a client for some.
---

```sh
npm run lending -- receive "Ashby Engineering" --kind=annual_accounts --by="Tom Fraser"
npm run lending -- request "Ashby Engineering" --kind=management_accounts --due=+14d --period-end=2026-09-30 --by="Tom Fraser"
```

Kinds: annual_accounts, management_accounts, tax_return, aged_debtors, valuation, insurance_certificate, budget. If annual accounts arrive, ask whether a covenant test can now be recorded.

Writes need `--by="<operator name>"`; it goes in the audit log. Say back what you are about to record in one line before running it, and show the result after. Never delete a record: close, withdraw or mark it instead.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
