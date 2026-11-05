---
description: The Monday review for the lending desk, written from attention, maturities and pipeline into drafts/.
---

1. Run `npm run lending -- attention --json`, `npm run lending -- maturities --days=120 --json`, `npm run lending -- pipeline --json` and `npm run lending -- compliance --json`.
2. Write `drafts/<YYYY-MM-DD>-weekly-review.md` with four sections: **Must happen this week** (breaches, overdue reviews, notice dates inside 14 days), **Coming up** (reviews, covenant tests and maturities in the next 30 days), **Pipeline** (each open deal, stage, days idle, the next step), **Conduct checks** (the compliance table in one line per rule).
3. Each line names the client, the banker and the date. Numbers in tables. No adjectives.
4. Run `npm run view -- week` and say where the HTML is.

Nothing sends. The review is for the desk to read.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
