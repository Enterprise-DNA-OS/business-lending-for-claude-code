---
description: Add a deal to the pipeline: a new facility, a limit increase, a refinance, an extension or a referral.
---

```sh
npm run lending -- opportunity "Riverbend" --code=OPP-07 --kind=new_facility --product="Fourth centre acquisition" --amount=2.2m --stage=lead --expected=2027-02-01 --source="Existing client" --by="Tom Fraser"
```

Kinds: new_facility, limit_increase, refinance, term_extension, referral. Amounts take 250000, 250k or 1.2m.

Writes need `--by="<operator name>"`; it goes in the audit log. Say back what you are about to record in one line before running it, and show the result after. Never delete a record: close, withdraw or mark it instead.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
