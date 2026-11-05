-- Demo book for a small business lender. Synthetic names, NZ flavoured.
-- Dates are relative to today, so there is always something overdue, due or quiet.
-- Idempotent: runs once, then does nothing if the demo banker already exists.
do $$
begin
  if exists (select 1 from bankers where code = 'RM-01') then
    return;
  end if;

  insert into bankers (code, name, email, team) values
    ('RM-01', 'Hana Walker', 'hana.walker@example.invalid', 'Rural and property'),
    ('RM-02', 'Tom Fraser', 'tom.fraser@example.invalid', 'Commercial'),
    ('CR-01', 'Priya Nair', 'priya.nair@example.invalid', 'Credit');

  insert into client_groups (code, name, notes) values
    ('GRP-01', 'Kereru group', 'Dairy operation and the family land trust. Cross-guaranteed.'),
    ('GRP-02', 'Ashby group', 'Engineering business and the company that owns its building.');

  insert into clients (code, name, group_id, banker_id, entity_type, industry, small_business, risk_grade, watchlist,
                       kyc_risk, kyc_reviewed_on, balance_month, status, client_since, notes) values
    ('CL-01', 'Kereru Dairy Ltd', (select id from client_groups where code = 'GRP-01'), (select id from bankers where code = 'RM-01'),
      'company', 'Dairy farming', true, 4, false, 'medium', current_date - 800, 5, 'active', current_date - 3000, '620 cows, two farms. Seasonal overdraft peaks in September.'),
    ('CL-02', 'Kereru Land Trust', (select id from client_groups where code = 'GRP-01'), (select id from bankers where code = 'RM-01'),
      'trust', 'Dairy farming', true, 4, false, 'low', current_date - 400, 5, 'active', current_date - 3000, 'Owns the home farm, leased to Kereru Dairy.'),
    ('CL-03', 'Ashby Engineering Ltd', (select id from client_groups where code = 'GRP-02'), (select id from bankers where code = 'RM-02'),
      'company', 'Manufacturing', true, 6, true, 'medium', current_date - 300, 3, 'active', current_date - 2200, 'Plant fire last year. Margins recovering slowly.'),
    ('CL-04', 'Ashby Property Ltd', (select id from client_groups where code = 'GRP-02'), (select id from bankers where code = 'RM-02'),
      'company', 'Commercial property', false, 5, false, 'low', current_date - 500, 3, 'active', current_date - 2200, 'Industrial building leased to Ashby Engineering and two other tenants.'),
    ('CL-05', 'Harbourside Freight Ltd', null, (select id from bankers where code = 'RM-02'),
      'company', 'Transport', true, 3, false, 'low', current_date - 600, 3, 'active', current_date - 1500, 'Twelve trucks, port cartage.'),
    ('CL-06', 'Totara Build Partners', null, (select id from bankers where code = 'RM-01'),
      'partnership', 'Construction', true, 6, false, 'medium', current_date - 200, 3, 'active', current_date - 400, 'Eight-townhouse development, stage one.'),
    ('CL-07', 'Moana Seafoods Ltd', null, (select id from bankers where code = 'RM-02'),
      'company', 'Seafood processing', true, 5, false, 'high', current_date - 400, 9, 'active', current_date - 900, 'Exports to three markets. Higher risk rating for the overseas payment flows.'),
    ('CL-08', 'Riverbend Childcare Centres Ltd', null, (select id from bankers where code = 'RM-02'),
      'company', 'Early childhood education', true, 3, false, 'low', current_date - 150, 3, 'active', current_date - 1200, 'Three centres. Looking at a fourth.'),
    ('CL-09', 'Pukeko Vineyards Ltd', null, (select id from bankers where code = 'RM-01'),
      'company', 'Viticulture', true, 5, true, 'medium', current_date - 250, 6, 'active', current_date - 1800, 'Two short vintages in a row. Seasonal line not being renewed.'),
    ('CL-10', 'Northline Electrical Wholesale Ltd', null, (select id from bankers where code = 'RM-02'),
      'company', 'Wholesale', true, null, false, 'medium', null, 3, 'prospect', null, 'Referred by their accountant. Wants debtor finance.');

  insert into contacts (client_id, name, role, email, phone, guarantor, primary_contact) values
    ((select id from clients where code = 'CL-01'), 'Mere Kereru', 'Director', 'mere@example.invalid', '021 555 0101', true, true),
    ((select id from clients where code = 'CL-02'), 'Mere Kereru', 'Trustee', 'mere@example.invalid', '021 555 0101', true, true),
    ((select id from clients where code = 'CL-03'), 'Grant Ashby', 'Managing director', 'grant@example.invalid', '021 555 0303', true, true),
    ((select id from clients where code = 'CL-03'), 'Lane & Co Chartered Accountants', 'Accountant', 'office@example.invalid', '09 555 0300', false, false),
    ((select id from clients where code = 'CL-04'), 'Grant Ashby', 'Director', 'grant@example.invalid', '021 555 0303', true, true),
    ((select id from clients where code = 'CL-05'), 'Rawiri Tane', 'Owner', 'rawiri@example.invalid', '027 555 0505', true, true),
    ((select id from clients where code = 'CL-06'), 'Sophie Lam', 'Partner', 'sophie@example.invalid', '022 555 0606', true, true),
    ((select id from clients where code = 'CL-07'), 'Ana Fifita', 'Finance manager', 'ana@example.invalid', '021 555 0707', false, true),
    ((select id from clients where code = 'CL-08'), 'Jess Morgan', 'Director', 'jess@example.invalid', '021 555 0808', true, true),
    ((select id from clients where code = 'CL-09'), 'David Pukeko', 'Director', 'david@example.invalid', '027 555 0909', true, true),
    ((select id from clients where code = 'CL-10'), 'Liam Chen', 'Chief executive', 'liam@example.invalid', '021 555 1010', false, true);

  insert into facilities (code, client_id, kind, purpose, limit_cents, drawn_cents, start_on, maturity_on, repayment,
                          specialised, security, extension_decision, margin_bps) values
    ('FAC-101', (select id from clients where code = 'CL-01'), 'term_loan', 'Second farm purchase', 240000000, 210000000,
      current_date - 1100, current_date + 1100, 'amortising', false, 'First mortgage over both farms', 'undecided', 245),
    ('FAC-102', (select id from clients where code = 'CL-01'), 'seasonal', 'Seasonal working capital', 35000000, 12000000,
      current_date - 260, current_date + 105, 'revolving', false, 'General security agreement', 'undecided', 310),
    ('FAC-201', (select id from clients where code = 'CL-02'), 'property_investment', 'Home farm, leased to Kereru Dairy', 180000000, 180000000,
      current_date - 1745, current_date + 80, 'interest_only', false, 'First mortgage over the home farm', 'undecided', 230),
    ('FAC-301', (select id from clients where code = 'CL-03'), 'term_loan', 'CNC machining centre', 90000000, 64000000,
      current_date - 900, current_date + 900, 'amortising', false, 'General security agreement, director guarantee', 'undecided', 350),
    ('FAC-302', (select id from clients where code = 'CL-03'), 'overdraft', 'Working capital', 25000000, 24500000,
      current_date - 500, current_date + 200, 'revolving', false, 'General security agreement', 'undecided', 420),
    ('FAC-401', (select id from clients where code = 'CL-04'), 'property_investment', 'Industrial building', 320000000, 310000000,
      current_date - 1400, current_date + 400, 'interest_only', false, 'First mortgage, assignment of rents', 'undecided', 215),
    ('FAC-501', (select id from clients where code = 'CL-05'), 'equipment_finance', 'Six prime movers', 120000000, 70000000,
      current_date - 700, current_date + 730, 'amortising', false, 'Security over the vehicles', 'undecided', 290),
    ('FAC-601', (select id from clients where code = 'CL-06'), 'property_development', 'Eight townhouses, stage one', 450000000, 290000000,
      current_date - 300, current_date + 150, 'balloon', true, 'First mortgage over the site, partner guarantees', 'undecided', 450),
    ('FAC-701', (select id from clients where code = 'CL-07'), 'trade_finance', 'Export receivables', 60000000, 41000000,
      current_date - 305, current_date + 60, 'revolving', false, 'General security agreement', 'extend', 330),
    ('FAC-801', (select id from clients where code = 'CL-08'), 'term_loan', 'Third centre fit-out', 150000000, 110000000,
      current_date - 600, current_date + 1500, 'amortising', false, 'General security agreement, director guarantee', 'undecided', 260),
    ('FAC-901', (select id from clients where code = 'CL-09'), 'seasonal', 'Vintage working capital', 50000000, 38000000,
      current_date - 325, current_date + 40, 'revolving', false, 'General security agreement', 'not_extend', 380);

  insert into covenants (code, facility_id, kind, metric, comparator, threshold, every_months, next_test_on, notes) values
    ('COV-301', (select id from facilities where code = 'FAC-301'), 'financial', 'Interest cover', '>=', 2.0, 12, current_date - 20, 'EBIT over interest, annual accounts basis'),
    ('COV-302', (select id from facilities where code = 'FAC-301'), 'reporting', 'Annual accounts', 'delivered', null, 12, current_date - 15, 'Within 120 days of balance date'),
    ('COV-401', (select id from facilities where code = 'FAC-401'), 'financial', 'Loan to value %', '<=', 65, 12, current_date + 100, 'Registered valuation every second year'),
    ('COV-501', (select id from facilities where code = 'FAC-501'), 'undertaking', 'Insurance noting our interest', 'delivered', null, 12, current_date + 30, null),
    ('COV-601', (select id from facilities where code = 'FAC-601'), 'financial', 'Loan to value %', '<=', 70, 3, current_date + 10, 'On as-if-complete valuation'),
    ('COV-602', (select id from facilities where code = 'FAC-601'), 'financial', 'Presales cover %', '>=', 100, 3, current_date - 5, 'Presales over debt'),
    ('COV-603', (select id from facilities where code = 'FAC-601'), 'reporting', 'Quantity surveyor report', 'delivered', null, 1, current_date - 3, null),
    ('COV-801', (select id from facilities where code = 'FAC-801'), 'reporting', 'Annual accounts', 'delivered', null, 12, current_date + 60, 'Within 120 days of balance date');

  insert into covenant_tests (covenant_id, tested_on, period_end, value, result, note, tested_by) values
    ((select id from covenants where code = 'COV-301'), current_date - 385, current_date - 580, 1.85, 'waived', 'Waived for one year after the plant fire. Approved by credit.', 'Priya Nair'),
    ((select id from covenants where code = 'COV-302'), current_date - 380, current_date - 580, null, 'pass', 'Received on day 112', 'Tom Fraser'),
    ((select id from covenants where code = 'COV-401'), current_date - 265, current_date - 280, 61, 'pass', null, 'Tom Fraser'),
    ((select id from covenants where code = 'COV-601'), current_date - 85, current_date - 90, 66, 'pass', null, 'Hana Walker'),
    ((select id from covenants where code = 'COV-602'), current_date - 85, current_date - 90, 92, 'breach', 'Two buyers fell over. Developer marketing the units again.', 'Hana Walker'),
    ((select id from covenants where code = 'COV-603'), current_date - 33, current_date - 35, null, 'pass', null, 'Hana Walker'),
    ((select id from covenants where code = 'COV-801'), current_date - 300, current_date - 400, null, 'pass', null, 'Tom Fraser');

  insert into financials (client_id, kind, period_end, due_on, received_on, note) values
    ((select id from clients where code = 'CL-01'), 'annual_accounts', current_date - 160, current_date - 40, current_date - 45, null),
    ((select id from clients where code = 'CL-03'), 'annual_accounts', current_date - 218, current_date - 98, null, 'Accountant says the stock count is holding them up'),
    ((select id from clients where code = 'CL-05'), 'insurance_certificate', null, current_date - 40, null, 'Fleet policy renewed, certificate not sent'),
    ((select id from clients where code = 'CL-06'), 'management_accounts', current_date - 40, current_date - 10, null, 'Monthly cost to complete'),
    ((select id from clients where code = 'CL-07'), 'aged_debtors', current_date - 5, current_date + 5, null, 'Needed for the trade line renewal'),
    ((select id from clients where code = 'CL-08'), 'annual_accounts', current_date - 218, current_date - 98, current_date - 110, null),
    ((select id from clients where code = 'CL-09'), 'budget', null, current_date + 20, null, 'Next vintage budget and cash flow');

  insert into credit_reviews (client_id, due_on, completed_on, outcome, grade_before, grade_after, approved_by, summary) values
    ((select id from clients where code = 'CL-01'), current_date + 20, null, null, 4, null, null, null),
    ((select id from clients where code = 'CL-02'), current_date + 20, null, null, 4, null, null, null),
    ((select id from clients where code = 'CL-03'), current_date - 25, null, null, 6, null, null, null),
    ((select id from clients where code = 'CL-04'), current_date - 300, current_date - 298, 'renew', 5, 5, 'Priya Nair', 'Tenancy steady. Rent reviews on time.'),
    ((select id from clients where code = 'CL-04'), current_date + 65, null, null, 5, null, null, null),
    ((select id from clients where code = 'CL-05'), current_date - 200, current_date - 205, 'renew', 3, 3, 'Priya Nair', 'Contract with the port renewed for three years.'),
    ((select id from clients where code = 'CL-06'), current_date + 45, null, null, 6, null, null, null),
    ((select id from clients where code = 'CL-07'), current_date - 420, current_date - 425, 'renew', 5, 5, 'Priya Nair', 'Export volumes up. Watch the currency exposure.'),
    ((select id from clients where code = 'CL-08'), current_date - 100, current_date - 102, 'renew', 4, 3, 'Priya Nair', 'Occupancy above 90 percent at all three centres.'),
    ((select id from clients where code = 'CL-09'), current_date - 330, current_date - 331, 'watch', 4, 5, 'Priya Nair', 'Second short vintage. Seasonal line to reduce.'),
    ((select id from clients where code = 'CL-09'), current_date + 35, null, null, 5, null, null, null);

  insert into interactions (client_id, banker_id, kind, happened_on, summary, next_step, next_step_on, next_step_done) values
    ((select id from clients where code = 'CL-01'), (select id from bankers where code = 'RM-01'), 'visit', current_date - 8,
      'Farm visit with Mere. Payout forecast holding. Wants the seasonal limit up for calving.', 'Send the limit increase application', current_date + 5, false),
    ((select id from clients where code = 'CL-02'), (select id from bankers where code = 'RM-01'), 'visit', current_date - 8,
      'Covered the trust at the same visit. Trustees happy to roll the interest-only loan.', null, null, false),
    ((select id from clients where code = 'CL-03'), (select id from bankers where code = 'RM-02'), 'call', current_date - 12,
      'Grant says orders are back to pre-fire levels. Accounts still with Lane & Co.', 'Chase annual accounts from Lane & Co', current_date - 5, false),
    ((select id from clients where code = 'CL-04'), (select id from bankers where code = 'RM-02'), 'email', current_date - 60,
      'Rent review on unit 2 settled at market.', null, null, false),
    ((select id from clients where code = 'CL-05'), (select id from bankers where code = 'RM-02'), 'meeting', current_date - 140,
      'Annual catch-up. Considering two more trucks next year.', null, null, false),
    ((select id from clients where code = 'CL-06'), (select id from bankers where code = 'RM-01'), 'site_visit', current_date - 6,
      'Frames up on units 1 to 4. Presales at six of eight after two buyers withdrew.', 'Get the updated presales schedule', current_date + 7, false),
    ((select id from clients where code = 'CL-07'), (select id from bankers where code = 'RM-02'), 'call', current_date - 35,
      'Ana asked for the trade line to roll for another year at the same limit.', 'Request aged debtors for the renewal', current_date - 20, true),
    ((select id from clients where code = 'CL-08'), (select id from bankers where code = 'RM-02'), 'meeting', current_date - 45,
      'Jess has a fourth centre under offer. Wants indicative terms.', 'Indicative terms for centre four', current_date + 10, false),
    ((select id from clients where code = 'CL-09'), (select id from bankers where code = 'RM-01'), 'meeting', current_date - 20,
      'Talked through the non-renewal of the seasonal line and options with a specialist lender.', null, null, false),
    ((select id from clients where code = 'CL-10'), (select id from bankers where code = 'RM-02'), 'meeting', current_date - 14,
      'First meeting. Debtor book around 2.1 million, 45-day terms.', 'Send debtor finance term sheet', current_date + 3, false);

  insert into opportunities (code, client_id, banker_id, kind, product, amount_cents, stage, expected_on, source, lost_reason, created_at, updated_at) values
    ('OPP-01', (select id from clients where code = 'CL-07'), (select id from bankers where code = 'RM-02'), 'term_extension', 'Trade finance renewal', 60000000, 'credit', current_date + 20, 'Existing client', null, now() - interval '30 days', now() - interval '6 days'),
    ('OPP-02', (select id from clients where code = 'CL-10'), (select id from bankers where code = 'RM-02'), 'new_facility', 'Debtor finance', 75000000, 'discovery', current_date + 45, 'Referral from Lane & Co', null, now() - interval '14 days', now() - interval '14 days'),
    ('OPP-03', (select id from clients where code = 'CL-01'), (select id from bankers where code = 'RM-01'), 'limit_increase', 'Seasonal limit increase', 25000000, 'application', current_date + 30, 'Existing client', null, now() - interval '8 days', now() - interval '8 days'),
    ('OPP-04', (select id from clients where code = 'CL-08'), (select id from bankers where code = 'RM-02'), 'new_facility', 'Fourth centre acquisition', 220000000, 'lead', current_date + 90, 'Existing client', null, now() - interval '45 days', now() - interval '45 days'),
    ('OPP-05', (select id from clients where code = 'CL-04'), (select id from bankers where code = 'RM-02'), 'refinance', 'Building refinance', 320000000, 'lost', null, 'Existing client', 'Another lender offered a lower margin', now() - interval '200 days', now() - interval '150 days');

  insert into notices (code, client_id, facility_id, kind, issued_on, effective_on, grounds, status, issued_by) values
    ('NTC-01', (select id from clients where code = 'CL-09'), (select id from facilities where code = 'FAC-901'), 'non_extension',
      current_date - 55, current_date + 40, 'Seasonal facility will not be extended at maturity. Options discussed with the client.', 'issued', 'Hana Walker'),
    ('NTC-02', (select id from clients where code = 'CL-03'), (select id from facilities where code = 'FAC-301'), 'default_remedy',
      current_date, current_date + 20, 'Annual accounts not provided as required by the facility agreement.', 'draft', 'Tom Fraser');

  insert into audit (actor, action, entity, ref, detail) values
    ('seed', 'seed', 'demo', 'RM-01', '{"note": "synthetic demonstration book"}');
end
$$;
