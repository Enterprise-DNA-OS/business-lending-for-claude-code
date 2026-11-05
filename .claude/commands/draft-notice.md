---
description: Write the letter for a recorded notice into drafts/, from the notice record and the client file.
---

1. Run `npm run lending -- show "<client>" --json` and read the notice row, the facility and the primary contact.
2. Run `npm run docs -- notice <notice-id-prefix>` for the formal notice page in the lender's brand.
3. Write `drafts/<YYYY-MM-DD>-<notice code>-letter.md`: addressed to the primary contact, the facility, what is happening and on which date, the grounds (for a default), how many days they have, and who to call. Plain words. No threats, no legal conclusions.
4. Quote the Code paragraph only in the internal note at the top of the draft, not in the letter.

Nothing sends. A person reads, signs and sends it.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
