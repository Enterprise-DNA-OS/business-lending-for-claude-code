# Moving off Salesforce Financial Services Cloud

Most of the move is two files. Clients come from your Account export, facilities from your Financial Account export. Everything else (risk grades, client groups, covenants, KYC dates, review dates) is usually held in custom fields or not at all, and is quicker to set once by asking Claude Code than to map.

## 1. Export from Salesforce

Use **Setup > Data Export** (weekly or monthly export, with the objects ticked) or Data Loader. You need:

- **Account**: at least `Id`, `Name`, `Industry`, `Description`. Add the owner's name as a column called `Owner Name` (Data Loader: export `Owner.Name`; a report export calls it `Account Owner`). Optional: `FinServ__ClientSince__c`.
- **Financial Account** (`FinServ__FinancialAccount__c` in the managed package, `FinancialAccount` in the newer standard objects): `Id`, `Name`, `FinServ__PrimaryOwner__c`, `FinServ__FinancialAccountType__c`, `FinServ__FinancialAccountNumber__c`, `FinServ__LoanAmount__c`, `FinServ__Balance__c`, `FinServ__OpenDate__c`, `FinServ__LoanEndDate__c`, `FinServ__Status__c`, `FinServ__InterestRate__c`. The importer also accepts the same names without the `FinServ__` prefix and `__c` suffix.

Field names vary between orgs. Open the CSV headers first. If yours differ, ask Claude Code to add the alias to the `pick(...)` lists in `scripts/lending.mjs` and rerun the test.

Put the files in `imports/` (ignored by git).

## 2. Dry run, then import

```sh
npm run lending -- import salesforce --accounts=imports/Account.csv --facilities=imports/FinancialAccount.csv --dry-run --by="Your Name"
npm run lending -- import salesforce --accounts=imports/Account.csv --facilities=imports/FinancialAccount.csv --by="Your Name"
```

The dry run saves nothing and lists every row it would skip. The real import can be run again safely: rows already here (matched on the Salesforce `Id`) are left alone.

## What maps

| Salesforce | Here |
|---|---|
| Account `Id` | `clients.source_ref` (the client code becomes `SF-` and the last six characters) |
| Account `Name`, `Industry`, `Description` | `clients.name`, `industry`, `notes` |
| Account owner name | `bankers` (created if new, code `SF-RM-01` and up) |
| Financial Account `Id` | `facilities.source_ref` |
| Account number (or `Name`) | `facilities.code` |
| Type | `facilities.kind`: overdraft, line of credit (revolving), equipment or lease, construction, development, mortgage or property (property investment), trade or invoice (trade finance), guarantee, seasonal; anything else is a term loan |
| Loan amount, balance | `limit_cents`, `drawn_cents` (balance stands in for the limit when no loan amount is set) |
| Open date, loan end date | `start_on`, `maturity_on` |
| Status Closed or Inactive | `status = closed` |
| Interest rate, original type | kept in `facilities.notes` |

## What does not carry over

- **Households, relationship groups and roles.** Set client groups with `/customise` or by asking ("put Kereru Dairy and Kereru Land Trust in one group").
- **Risk grades, covenants, review dates, KYC dates.** Usually custom fields or spreadsheets. Bring them in from a spreadsheet by asking Claude Code to write a one-off import, or enter them with `add-covenant`, `schedule-review` and `kyc-done`.
- **Activities, tasks and emails.** Export Task and Event if you want the history; ask Claude Code to load them into `interactions`.
- **Files and documents.** They stay in your document store. Record what is owed with `request`.
- **Small business status.** Every imported client starts as small business, so the Banking Code checks run. Clear it for clients outside the definition.

After the import, run `/attention` and `/compliance`. The first week usually turns up reviews nobody scheduled and maturities with no decision.
