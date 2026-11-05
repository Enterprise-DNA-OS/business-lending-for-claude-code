<h1 align="center">Business Lending for Claude Code</h1>

<p align="center">
  <strong>The open-source business lending relationship desk that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Salesforce Financial Services Cloud data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=salesforce-financial-services-cloud">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/salesforce-financial-services-cloud?utm_source=github&utm_medium=readme&utm_campaign=salesforce-financial-services-cloud">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-salesforce-financial-services-cloud">Instead of Salesforce Financial Services Cloud</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Business Lending for Claude Code does the job you pay Salesforce Financial Services Cloud for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Salesforce Financial Services Cloud dashboard cannot.

Salesforce lists Financial Services Cloud Sales at US$325 a user a month on its Core edition and US$500 on Advanced, billed annually ([pricing page](https://www.salesforce.com/ap/financial-services/sales-pricing/), checked 5 November 2026). That is US$3,900 a banker a year before any implementation partner, sandbox or add-on, and every credit analyst and manager who needs to look needs a seat.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=salesforce-financial-services-cloud).

It is the relationship desk of a business lending team: client groups and connected exposure, facilities and limits, covenants and their tests, the financial information clients owe, annual credit reviews and risk grades, KYC refresh dates, the deal pipeline, call notes and formal notices. It is built for non-bank lenders, credit unions, equipment, rural and property finance houses with five to fifty people, and it checks the book against the Banking Code of Practice notice periods out of the box. It is not a loan servicing system: balances come from your loan system or an import.

### Ten questions the dashboard never answered

Each is one command on the demo book today.

1. Which client groups carry the most exposure, counting every company and trust they trade through? `groups`
2. Which interest-only and revolving facilities pass their Banking Code notice date in the next 30 days with no decision? `compliance --detail`
3. Which covenants are due for testing, and which failed or were waived last time? `covenants`, `breaches`
4. Whose annual accounts are late, and by how many days? `financials`
5. Which financial covenants sit on standard small business loans, where the Code does not allow them? `compliance --detail`
6. Which clients have not heard from their banker in 90 days? `quiet`
7. Whose KYC refresh is overdue for their risk rating? `kyc`
8. Which facilities are drawn above 90 percent of their limit? `headroom`
9. Whose risk grade got worse at their last review? `grade-drift`
10. How much of the book sits in each industry, and how much of it is on the watchlist? `concentration`

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/business-lending-for-claude-code.git
cd business-lending-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`. It lists everything on the demo book that needs a banker this week: an overdue credit review, a missed Banking Code notice date, a presales covenant breach, late annual accounts, two KYC refreshes and a client nobody has called in 140 days.

From the terminal the same thing is `npm run lending -- attention`. `npm run view` writes the week, the book and the compliance checks as HTML pages; `npm run docs` writes credit review papers, notices and covenant schedules in your brand (`brand.json`).

### Your first hour: ten things to ask for

1. "What needs attention this week?"
2. "Show me Ashby Engineering."
3. "Which groups are our biggest exposures?"
4. "Run the compliance check and explain each breach."
5. "Record the presales test for Totara at 104 percent."
6. "Write the review paper for Kereru Dairy."
7. "Draft a chase to Lane & Co for Ashby's accounts."
8. "Our high-risk KYC refresh is every 6 months, change it." (`/customise`)
9. "Add a field for the loan system account number." (`/customise`)
10. "Give me a Monday page with maturities by banker." (`/new-view`)

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/add-client` | Add a client, a facility or a covenant. |
| `/add-deal` | Add a deal to the pipeline: a new facility, a limit increase, a refinance, an extension or a referral. |
| `/amend-facility` | Change a facility: limit, drawn balance, maturity, extension decision or status, with the reason on record. |
| `/attention` | Everything that needs a banker this week, worst first: overdue reviews, Banking Code notice deadlines, covenant breaches and tests, late financials, KYC refreshes, quiet clients, overdue follow-ups. |
| `/book` | The lending book by banker: clients, limits, drawn, average risk grade, watchlist count. |
| `/client` | One client on one page: facilities, covenants, financials owed, reviews, pipeline, notices, recent contact and contacts. |
| `/complete-review` | Close the open credit review with an outcome, a new risk grade and who approved it. The next review is scheduled automatically. |
| `/compliance` | Check the records against the rules this industry lives under (the ones listed in docs/compliance.md) and report what is missing, late, or about to breach, with the rule cited. |
| `/covenants` | Covenant tests due or overdue, with the last result, plus every breach and waiver on record. |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/draft-call-prep` | A one-page brief before a client call or visit, in drafts/. |
| `/draft-chase` | A short, polite email asking a client (or their accountant) for overdue financial information, in drafts/. |
| `/draft-notice` | Write the letter for a recorded notice into drafts/, from the notice record and the client file. |
| `/draft-review-paper` | The annual credit review paper for one client: the rendered paper plus a written commentary, in drafts/. |
| `/export` | Write every table to CSV files you can open anywhere. |
| `/financials` | Financial information owed to us and not yet received: annual accounts, management accounts, insurance certificates, aged debtors, valuations. |
| `/groups` | Connected exposure: every client group with all its entities added together, largest first. |
| `/headroom` | Facilities drawn close to or above their limit. |
| `/help` | Every CLI command and what it does. |
| `/import` | Bring clients and facilities across from Salesforce Financial Services Cloud exports. Dry run first. |
| `/insights` | The ten questions the dashboard never answered, run against the book. |
| `/kyc` | KYC refreshes due or overdue by risk rating (12, 24 or 36 months by default, set in the policy table). |
| `/log` | Log a call, visit, meeting or site visit, with the next step and its date. |
| `/maturities` | Facilities maturing soon, with the date a non-extension notice must go out under the Banking Code (para 93). |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |
| `/notice` | Record a formal notice to a client as a draft, check it against the Banking Code, then mark it issued. |
| `/pipeline` | Open deals by stage with days since each last moved. |
| `/quiet` | Active clients nobody has spoken to inside the quiet window (90 days by default). |
| `/receive-financials` | Record financial information received, or ask a client for some. |
| `/reviews` | Annual credit reviews due or overdue, and active clients with no review scheduled. |
| `/test-covenant` | Record a covenant test result. The CLI judges pass or breach from the threshold and rolls the next test date. |
| `/weekly-review` | The Monday review for the lending desk, written from attention, maturities and pipeline into drafts/. |

Every command drives one CLI, `scripts/lending.mjs` (`npm run lending -- help` lists its 38 commands). Every write needs `--by` and lands in the audit log.

## Instead of Salesforce Financial Services Cloud

Export Account and Financial Account from Salesforce (Data Export or Data Loader), then:

```bash
npm run lending -- import salesforce --accounts=imports/Account.csv --facilities=imports/FinancialAccount.csv --dry-run --by="Your Name"
```

Drop `--dry-run` when the counts look right. The import is repeatable and matches on the Salesforce Id. What maps and what does not (households, custom risk fields, files) is in [docs/replace-salesforce-financial-services-cloud.md](docs/replace-salesforce-financial-services-cloud.md). The compliance rules and their sources are in [docs/compliance.md](docs/compliance.md).

## Architecture

```
business-lending-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  scripts/lending.mjs       the one CLI: reads, writes, compliance, import, export
  supabase/migrations/      plain SQL schema and the views the commands read
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Business Lending for Claude Code for your business, migrates your Salesforce Financial Services Cloud data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=salesforce-financial-services-cloud)
- Read more: [enterprisedna.co/omni/instead-of/salesforce-financial-services-cloud](https://enterprisedna.co/omni/instead-of/salesforce-financial-services-cloud?utm_source=github&utm_medium=readme&utm_campaign=salesforce-financial-services-cloud)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
