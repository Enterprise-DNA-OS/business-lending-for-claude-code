# Compliance rules this desk checks

`npm run lending -- compliance` checks the records against the rules below. Each rule says where it comes from, what a breach looks like in the data, and which check finds it. The notice periods and review cycles live in the `policy` table, so a lender with a different code or policy changes a number, not the code.

This is not legal advice. The Banking Code of Practice binds the banks that subscribe to it; many non-bank and specialist lenders use it as their own standard. Confirm which rules apply to you, then keep this page and the checks in step. If a rule here is out of date, say so and stop: `/compliance` will not guess at law.

## Banking Code of Practice (Australian Banking Association, 28 February 2025)

Source: https://www.ausbanking.org.au/banking-code/ (the PDF dated 28 February 2025). Applies to small business customers as the Code defines them; set `small_business = false` on a client outside the definition.

| # | Rule | What the Code says | Breach in the data | Check |
|---|---|---|---|---|
| 1 | Notice of a decision not to extend | Para 93: if you are not in default and the principal is not fully repaid by regular repayments, "we will give you notice of our decision not to extend your Loan, at least 3 months before you need to repay your Loan in full." | An active interest-only, balloon or revolving facility for a small business client, decision not `extend`, with no non-extension notice issued on or before maturity less 3 months. Due when that date is inside 30 days. | `v_maturities`, rule 1 in `complianceChecks` |
| 2 | Default notice and time to remedy | Para 88: for a non-monetary default the bank gives "a notice specifying the grounds on which we consider there is a Default" and "no less than 30 Days' notice of the Default ... to remedy your Default". Para 89 allows less for insolvency or a material and immediate risk. | A draft or issued `default_remedy` notice with no grounds, or fewer than 30 days between `issued_on` and `effective_on`. `issue-notice` refuses one unless overridden with a reason. | rule 2 |
| 3 | Payment default notice | Para 82: "no less than 30 Days' notice of the payment failure before we make a demand for full repayment or take Enforcement Proceedings". | A `payment_default` notice giving fewer than 30 days. | rule 3 |
| 4 | Unfavourable changes | Para 36: apart from interest rate and repayment changes, "if we believe a change is unfavourable to you, then we will give you prior notice of at least 30 Days". | An `unfavourable_change` notice giving fewer than 30 days. | rule 4 |
| 5 | Financial covenants on small business loans | Para 91 allows financial indicator covenants on specialised small business loans (property development, construction finance, margin lending, SMSF loans, bailment, invoice discounting, foreign currency and tailored cash flow lending). Para 92: no default based on unspecified material adverse change. | An active `financial` covenant on a small business facility that is not marked `specialised` and is not property development or construction. | rule 5 |
| 6 | Financial information | Para 87(i) lists not providing financial information the agreement requires as a default the bank may act on, after the para 88 notice. | Financial information past its due date and not received. The check reports it; acting on it goes through rule 2. | `v_financials_outstanding`, rule 8 |

## Customer due diligence

| # | Rule | Source | Breach in the data | Check |
|---|---|---|---|---|
| 7 | Ongoing customer due diligence | New Zealand: Anti-Money Laundering and Countering Financing of Terrorism Act 2009, s 31 (ongoing customer due diligence and account monitoring), legislation.govt.nz. Australia: Anti-Money Laundering and Counter-Terrorism Financing Act 2006, ongoing customer due diligence (s 30 in the compilation of 1 October 2026), legislation.gov.au. | `kyc_reviewed_on` plus the refresh interval for the client's risk rating is in the past. The intervals (12, 24, 36 months) are your programme's choice, not set in either Act: change them in `policy`. | `v_kyc_due`, rule 6 |

## Credit policy

| # | Rule | Source | Breach in the data | Check |
|---|---|---|---|---|
| 8 | Every exposure reviewed on the cycle | Your credit policy. For authorised deposit-taking institutions, APRA Prudential Standard APS 220 Credit Risk Management (in force 1 January 2023) expects exposures to be monitored and reviewed regularly. | An open review past its due date, or an active client with no open review and no completed review inside `review_months`. | `v_reviews_due`, `v_reviews_missing`, rule 7 |

## Changing a rule

Ask `/customise` in plain words ("our non-extension notice is 90 days", "high-risk KYC every 6 months"). It changes the `policy` row, or the check in `scripts/lending.mjs` and this page together, then runs `npm test`.
