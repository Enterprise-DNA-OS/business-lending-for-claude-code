---
description: The ten questions the dashboard never answered, run against the book.
---

Run each and present one line of answer per question, then the table:

1. Which client groups carry the most exposure, counting every entity? `groups`
2. Which facilities pass their Banking Code notice date in the next 30 days with no decision? `compliance --detail`
3. Which covenants are due, and which failed last time? `covenants`
4. Whose annual accounts are late, and by how many days? `financials`
5. Which financial covenants sit on standard small business loans? `compliance --detail`
6. Which clients have not heard from us in 90 days? `quiet`
7. Whose KYC refresh is overdue for their risk rating? `kyc`
8. Which facilities are drawn above 90 percent? `headroom`
9. Whose risk grade got worse at the last review? `grade-drift`
10. How much of the book sits in each industry, and how much is on the watchlist? `concentration`

All are `npm run lending -- <command>`.

Every command takes `--json`. Clients match on code, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a client from memory.
