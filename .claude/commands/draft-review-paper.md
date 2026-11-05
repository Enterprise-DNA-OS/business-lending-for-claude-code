---
description: The annual credit review paper for one client: the rendered paper plus a written commentary, in drafts/.
---

1. Run `npm run lending -- show "<client>" --json`, `npm run lending -- groups --json` and `npm run lending -- breaches --json`.
2. Run `npm run docs -- credit-review-paper` (or with the review id prefix) for the branded paper.
3. Write `drafts/<YYYY-MM-DD>-<client code>-review-commentary.md`: exposure and connected exposure, conduct since the last review (covenant results, late financials, utilisation), what changed in the business (from the call notes), the grade you would propose and why, and the conditions you would set. Mark the proposed grade as a proposal.

Nothing is approved here. The approver records the outcome with `/complete-review`.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
