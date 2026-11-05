---
description: Change a facility: limit, drawn balance, maturity, extension decision or status, with the reason on record.
---

```sh
npm run lending -- amend FAC-102 --decision=extend --reason="Renewed at credit, 12 months" --by="Hana Walker"
npm run lending -- amend FAC-302 --limit=300k --reason="Temporary increase for the export order" --by="Tom Fraser"
npm run lending -- amend FAC-901 --status=closed --reason="Repaid in full" --by="Hana Walker"
```

The audit log keeps the before and after. A limit decrease or a tighter term on a small business loan is an unfavourable change: ask whether a notice is needed (`/notice`).

Writes need `--by="<operator name>"`; it goes in the audit log. Say back what you are about to record in one line before running it, and show the result after. Never delete a record: close, withdraw or mark it instead.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
