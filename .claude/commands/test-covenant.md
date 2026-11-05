---
description: Record a covenant test result. The CLI judges pass or breach from the threshold and rolls the next test date.
---

```sh
npm run lending -- test COV-602 --value=104 --period-end=2026-09-30 --by="Hana Walker"
npm run lending -- test COV-302 --delivered --by="Tom Fraser"
npm run lending -- test COV-603 --missed --by="Tom Fraser"
npm run lending -- test COV-301 --value=1.7 --waive --note="Approved by credit, one year" --by="Priya Nair"
```

Ask for the figure and the period end if the operator has not given them. Only a breach can be waived, and a waiver needs a note saying who approved it.

Writes need `--by="<operator name>"`; it goes in the audit log. Say back what you are about to record in one line before running it, and show the result after. Never delete a record: close, withdraw or mark it instead.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
