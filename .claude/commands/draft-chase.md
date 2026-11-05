---
description: A short, polite email asking a client (or their accountant) for overdue financial information, in drafts/.
---

1. Run `npm run lending -- financials --json` and `npm run lending -- show "<client>" --json`.
2. Write `drafts/<YYYY-MM-DD>-<client code>-chase.md` to the primary contact (copy the accountant if one is on file): what is owed, for which period, when it was due, and why we need it (the annual review or a covenant test). One paragraph. No threat of default unless the operator asks for it, and then use `/notice` instead.

Nothing sends.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
