---
description: Add a client, a facility or a covenant.
---

```sh
npm run lending -- add-client --code=CL-11 --name="Kaka Brewing Co Ltd" --banker=RM-02 --industry=Brewing --grade=5 --kyc-risk=medium --by="Tom Fraser"
npm run lending -- add-facility --client="Kaka" --code=FAC-1101 --kind=term_loan --limit=1.2m --maturity=2030-06-30 --repayment=amortising --security="General security agreement" --by="Tom Fraser"
npm run lending -- add-covenant --facility=FAC-1101 --code=COV-1101 --kind=financial --metric="Interest cover" --comparator=">=" --threshold=2 --every=12 --next=2027-07-31 --by="Tom Fraser"
```

Add `--not-small-business` for a client outside the Banking Code small business definition. Construction and property development facilities are marked specialised automatically. Before adding a financial covenant to a standard small business loan, warn that the Code (para 91) allows them only on specialised loans.

Writes need `--by="<operator name>"`; it goes in the audit log. Say back what you are about to record in one line before running it, and show the result after. Never delete a record: close, withdraw or mark it instead.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
