---
description: Record a formal notice to a client as a draft, check it against the Banking Code, then mark it issued.
---

```sh
npm run lending -- notice "Kereru Land" --kind=non_extension --code=NTC-03 --facility=FAC-201 --effective=2027-01-24 --grounds="..." --by="Hana Walker"
npm run lending -- issue-notice NTC-03 --by="Hana Walker"
```

Kinds: non_extension (para 93, three months), default_remedy (para 88, grounds and 30 days), payment_default (para 82, 30 days), unfavourable_change (para 36, 30 days). `issue-notice` refuses a notice that gives too few days or states no grounds. An override needs `--override --reason="..."`, and should be rare: tell the operator what the Code says first. Recording a notice does not send it; `/draft-notice` writes the letter.

Writes need `--by="<operator name>"`; it goes in the audit log. Say back what you are about to record in one line before running it, and show the result after. Never delete a record: close, withdraw or mark it instead.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
