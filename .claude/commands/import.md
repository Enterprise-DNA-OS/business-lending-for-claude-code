---
description: Bring clients and facilities across from Salesforce Financial Services Cloud exports. Dry run first.
---

Follow `docs/replace-salesforce-financial-services-cloud.md`.

```sh
npm run lending -- import salesforce --accounts=imports/Account.csv --facilities=imports/FinancialAccount.csv --dry-run --by="Tom Fraser"
npm run lending -- import salesforce --accounts=imports/Account.csv --facilities=imports/FinancialAccount.csv --by="Tom Fraser"
```

Always run the dry run first and show the counts and every skipped row. The import is repeatable: rows already brought across (matched on the Salesforce Id) are left alone. After a real import, run `clients`, `groups` and `maturities` and ask the operator to set risk grades, groups, KYC dates and covenants, which Salesforce rarely holds in the same shape.

Writes need `--by="<operator name>"`; it goes in the audit log. Say back what you are about to record in one line before running it, and show the result after. Never delete a record: close, withdraw or mark it instead.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
