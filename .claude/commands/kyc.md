---
description: KYC refreshes due or overdue by risk rating (12, 24 or 36 months by default, set in the policy table).
---

```sh
npm run lending -- kyc --days=30
npm run lending -- kyc-done "Kereru Dairy" --risk=low --by="Hana Walker"
```

List overdue first. When a refresh is done, record it with `kyc-done`, re-rating the risk if it changed. This system records when due diligence was refreshed; the evidence itself stays in your KYC file.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
