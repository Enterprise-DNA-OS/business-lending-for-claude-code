---
description: Log a call, visit, meeting or site visit, with the next step and its date.
---

```sh
npm run lending -- log "Harbourside" --kind=call --summary="Rang about the fleet insurance certificate" --next="Certificate by Friday" --next-on=+3d --by="Tom Fraser"
npm run lending -- done-step "Ashby Engineering" --step="Lane" --by="Tom Fraser"
```

Kinds: call, visit, meeting, email, site_visit. Turn the operator's own words into a one-sentence summary; keep any figures they gave.

Writes need `--by="<operator name>"`; it goes in the audit log. Say back what you are about to record in one line before running it, and show the result after. Never delete a record: close, withdraw or mark it instead.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
