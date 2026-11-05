-- Business Lending for Claude Code: the relationship desk of a business lending team.
-- Bankers, client groups, clients, facilities, covenants and their tests, financials owed,
-- annual credit reviews, KYC refresh, the deal pipeline, call notes and formal notices.
-- Plain Postgres. Runs the same on PGlite. Money is stored in cents.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- Credit policy the views read. Change a value here, every view follows.
create table policy (
  key text primary key,
  value integer not null,
  note text not null
);

create table bankers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  email text,
  team text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table client_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  group_id uuid references client_groups(id),
  banker_id uuid references bankers(id),
  entity_type text not null default 'company'
    check (entity_type in ('company', 'trust', 'partnership', 'sole_trader', 'cooperative', 'other')),
  industry text,
  small_business boolean not null default true,
  risk_grade integer check (risk_grade between 1 and 10),
  watchlist boolean not null default false,
  kyc_risk text not null default 'medium' check (kyc_risk in ('low', 'medium', 'high')),
  kyc_reviewed_on date,
  balance_month integer not null default 3 check (balance_month between 1 and 12),
  status text not null default 'active' check (status in ('prospect', 'active', 'exited')),
  client_since date,
  source_ref text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  guarantor boolean not null default false,
  primary_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table facilities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid not null references clients(id),
  kind text not null check (kind in ('overdraft', 'term_loan', 'revolving', 'equipment_finance',
    'property_investment', 'property_development', 'construction', 'trade_finance', 'seasonal', 'bank_guarantee')),
  purpose text,
  limit_cents bigint not null check (limit_cents >= 0),
  drawn_cents bigint not null default 0 check (drawn_cents >= 0),
  currency text not null default 'NZD',
  margin_bps integer,
  start_on date,
  maturity_on date,
  repayment text not null default 'amortising' check (repayment in ('amortising', 'interest_only', 'balloon', 'revolving')),
  specialised boolean not null default false,
  security text,
  extension_decision text not null default 'undecided' check (extension_decision in ('undecided', 'extend', 'not_extend')),
  status text not null default 'active' check (status in ('pending', 'active', 'closed', 'declined')),
  closed_on date,
  source_ref text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table covenants (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  facility_id uuid not null references facilities(id),
  kind text not null check (kind in ('financial', 'reporting', 'undertaking')),
  metric text not null,
  comparator text not null check (comparator in ('>=', '<=', 'delivered')),
  threshold numeric,
  every_months integer not null default 12 check (every_months between 1 and 36),
  next_test_on date not null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (comparator = 'delivered' or threshold is not null)
);

create table covenant_tests (
  id uuid primary key default gen_random_uuid(),
  covenant_id uuid not null references covenants(id),
  tested_on date not null,
  period_end date,
  value numeric,
  result text not null check (result in ('pass', 'breach', 'waived')),
  note text,
  tested_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table financials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  kind text not null check (kind in ('annual_accounts', 'management_accounts', 'tax_return',
    'aged_debtors', 'valuation', 'insurance_certificate', 'budget')),
  period_end date,
  due_on date not null,
  received_on date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table credit_reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  due_on date not null,
  completed_on date,
  outcome text check (outcome in ('renew', 'amend', 'reduce', 'exit', 'watch')),
  grade_before integer check (grade_before between 1 and 10),
  grade_after integer check (grade_after between 1 and 10),
  approved_by text,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_on is null or (outcome is not null and grade_after is not null and approved_by is not null))
);

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid not null references clients(id),
  banker_id uuid references bankers(id),
  kind text not null check (kind in ('new_facility', 'limit_increase', 'refinance', 'term_extension', 'referral')),
  product text,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  stage text not null default 'lead' check (stage in ('lead', 'discovery', 'application', 'credit', 'approved', 'settled', 'lost')),
  expected_on date,
  source text,
  lost_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  banker_id uuid references bankers(id),
  kind text not null check (kind in ('call', 'visit', 'meeting', 'email', 'site_visit')),
  happened_on date not null,
  summary text not null,
  next_step text,
  next_step_on date,
  next_step_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notices (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid not null references clients(id),
  facility_id uuid references facilities(id),
  kind text not null check (kind in ('non_extension', 'default_remedy', 'payment_default', 'unfavourable_change')),
  issued_on date not null,
  effective_on date not null,
  grounds text,
  status text not null default 'draft' check (status in ('draft', 'issued', 'remedied', 'withdrawn')),
  issued_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  entity text not null,
  ref text,
  detail jsonb
);

create index on clients (banker_id);
create index on clients (group_id);
create index on facilities (client_id);
create index on covenants (facility_id);
create index on covenant_tests (covenant_id, tested_on);
create index on financials (client_id);
create index on credit_reviews (client_id);
create index on interactions (client_id, happened_on);
create index on notices (client_id);
create index on audit (entity, ref);

create trigger touch_bankers before update on bankers for each row execute function touch_updated_at();
create trigger touch_client_groups before update on client_groups for each row execute function touch_updated_at();
create trigger touch_clients before update on clients for each row execute function touch_updated_at();
create trigger touch_contacts before update on contacts for each row execute function touch_updated_at();
create trigger touch_facilities before update on facilities for each row execute function touch_updated_at();
create trigger touch_covenants before update on covenants for each row execute function touch_updated_at();
create trigger touch_covenant_tests before update on covenant_tests for each row execute function touch_updated_at();
create trigger touch_financials before update on financials for each row execute function touch_updated_at();
create trigger touch_credit_reviews before update on credit_reviews for each row execute function touch_updated_at();
create trigger touch_opportunities before update on opportunities for each row execute function touch_updated_at();
create trigger touch_interactions before update on interactions for each row execute function touch_updated_at();
create trigger touch_notices before update on notices for each row execute function touch_updated_at();

insert into policy (key, value, note) values
  ('kyc_months_high', 12, 'Months between KYC refreshes for a high-risk client'),
  ('kyc_months_medium', 24, 'Months between KYC refreshes for a medium-risk client'),
  ('kyc_months_low', 36, 'Months between KYC refreshes for a low-risk client'),
  ('review_months', 12, 'Months between annual credit reviews'),
  ('financials_days', 120, 'Days after balance date that annual accounts are due'),
  ('quiet_days', 90, 'Days without contact before an active client counts as quiet'),
  ('notice_months_non_extension', 3, 'Banking Code of Practice para 93: notice of a decision not to extend'),
  ('notice_days_default', 30, 'Banking Code of Practice paras 82 and 88: time to remedy a default'),
  ('notice_days_change', 30, 'Banking Code of Practice para 36: notice of an unfavourable change');

-- Exposure per client: what we have lent and what is drawn, active facilities only.
create view v_client_exposure as
select c.id as client_id, c.code, c.name, g.code as group_code, b.name as banker,
       c.risk_grade, c.watchlist,
       count(f.id)::int as facilities,
       coalesce(sum(f.limit_cents), 0)::bigint as limit_cents,
       coalesce(sum(f.drawn_cents), 0)::bigint as drawn_cents
from clients c
left join client_groups g on g.id = c.group_id
left join bankers b on b.id = c.banker_id
left join facilities f on f.client_id = c.id and f.status = 'active'
where c.status = 'active'
group by c.id, c.code, c.name, g.code, b.name, c.risk_grade, c.watchlist;

-- Connected exposure: a client group is one risk, however many entities it trades through.
create view v_group_exposure as
select coalesce(g.code, e.code) as group_code,
       coalesce(g.name, e.name) as group_name,
       count(*)::int as clients,
       sum(e.facilities)::int as facilities,
       sum(e.limit_cents)::bigint as limit_cents,
       sum(e.drawn_cents)::bigint as drawn_cents,
       max(e.risk_grade) as worst_grade,
       bool_or(e.watchlist) as on_watchlist
from v_client_exposure e
left join clients c on c.id = e.client_id
left join client_groups g on g.id = c.group_id
group by coalesce(g.code, e.code), coalesce(g.name, e.name);

-- Annual credit reviews that are open, with days to go (negative is overdue).
create view v_reviews_due as
select r.id, c.code, c.name, b.name as banker, r.due_on,
       (r.due_on - current_date) as days_to_due,
       c.risk_grade, c.watchlist
from credit_reviews r
join clients c on c.id = r.client_id
left join bankers b on b.id = c.banker_id
where r.completed_on is null and c.status = 'active';

-- Active clients with no open review and no completed review inside the review cycle.
create view v_reviews_missing as
select c.code, c.name, b.name as banker,
       (select max(r.completed_on) from credit_reviews r where r.client_id = c.id) as last_review_on
from clients c
left join bankers b on b.id = c.banker_id
where c.status = 'active'
  and not exists (select 1 from credit_reviews r where r.client_id = c.id and r.completed_on is null)
  and coalesce((select max(r.completed_on) from credit_reviews r where r.client_id = c.id), date '1900-01-01')
      < current_date - ((select value from policy where key = 'review_months') * interval '1 month');

-- Maturities, with the last day a non-extension notice can go out under the Code.
create view v_maturities as
select f.id, f.code, c.code as client_code, c.name as client, f.kind, f.repayment,
       f.limit_cents, f.drawn_cents, f.currency, f.maturity_on,
       (f.maturity_on - current_date) as days_to_maturity,
       (f.maturity_on - ((select value from policy where key = 'notice_months_non_extension') * interval '1 month'))::date as notice_by,
       f.extension_decision, c.small_business,
       exists (select 1 from notices n where n.facility_id = f.id and n.kind = 'non_extension' and n.status in ('issued', 'remedied')) as notice_issued
from facilities f
join clients c on c.id = f.client_id
where f.status = 'active' and f.maturity_on is not null;

-- Covenant tests coming up or overdue, with the last result.
create view v_covenants_due as
select v.id, v.code, f.code as facility_code, c.code as client_code, c.name as client,
       v.kind, v.metric, v.comparator, v.threshold, v.next_test_on,
       (v.next_test_on - current_date) as days_to_test,
       (select t.result from covenant_tests t where t.covenant_id = v.id order by t.tested_on desc, t.created_at desc limit 1) as last_result,
       (select t.value from covenant_tests t where t.covenant_id = v.id order by t.tested_on desc, t.created_at desc limit 1) as last_value
from covenants v
join facilities f on f.id = v.facility_id
join clients c on c.id = f.client_id
where v.active and f.status = 'active';

-- Financial information owed to us and not yet received.
create view v_financials_outstanding as
select x.id, c.code as client_code, c.name as client, b.name as banker, x.kind, x.period_end, x.due_on,
       (current_date - x.due_on) as days_overdue
from financials x
join clients c on c.id = x.client_id
left join bankers b on b.id = c.banker_id
where x.received_on is null and c.status = 'active';

-- KYC refresh dates by risk rating.
create view v_kyc_due as
select c.id, c.code, c.name, b.name as banker, c.kyc_risk, c.kyc_reviewed_on,
       (coalesce(c.kyc_reviewed_on, date '1900-01-01')
         + ((select value from policy where key = 'kyc_months_' || c.kyc_risk) * interval '1 month'))::date as kyc_due_on
from clients c
left join bankers b on b.id = c.banker_id
where c.status = 'active';

-- When each active client last heard from us.
create view v_last_contact as
select c.id, c.code, c.name, b.name as banker,
       max(i.happened_on) as last_contact_on,
       (current_date - max(i.happened_on)) as days_since
from clients c
left join bankers b on b.id = c.banker_id
left join interactions i on i.client_id = c.id
where c.status = 'active'
group by c.id, c.code, c.name, b.name;

-- One list of what needs a banker this week.
create view v_attention as
select 'review overdue' as issue, code as client_code, name as client, banker,
       due_on as on_date, 'credit review ' || abs(days_to_due) || ' days overdue' as detail, 1 as severity
from v_reviews_due where days_to_due < 0
union all
select 'review due', code, name, banker, due_on, 'credit review due in ' || days_to_due || ' days', 3
from v_reviews_due where days_to_due between 0 and 30
union all
select 'review not scheduled', code, name, banker, last_review_on, 'no open credit review, last completed ' || coalesce(last_review_on::text, 'never'), 2
from v_reviews_missing
union all
select 'notice deadline', m.client_code, m.client, b.name, m.notice_by,
       m.code || ' matures ' || m.maturity_on || ', no decision recorded', 1
from v_maturities m
join clients c on c.code = m.client_code
left join bankers b on b.id = c.banker_id
where m.extension_decision = 'undecided' and m.repayment <> 'amortising' and m.small_business
  and not m.notice_issued and m.notice_by <= current_date + 30
union all
select 'covenant test', d.client_code, d.client, b.name, d.next_test_on,
       d.metric || ' ' || d.comparator || coalesce(' ' || d.threshold::text, '') || ' on ' || d.facility_code, 2
from v_covenants_due d
join clients c on c.code = d.client_code
left join bankers b on b.id = c.banker_id
where d.next_test_on <= current_date
union all
select 'covenant breach', d.client_code, d.client, b.name, d.next_test_on,
       d.metric || ' breached at ' || coalesce(d.last_value::text, 'last test') || ' on ' || d.facility_code, 1
from v_covenants_due d
join clients c on c.code = d.client_code
left join bankers b on b.id = c.banker_id
where d.last_result = 'breach'
union all
select 'financials late', client_code, client, banker, due_on,
       replace(kind, '_', ' ') || ' ' || days_overdue || ' days late', 2
from v_financials_outstanding where days_overdue > 0
union all
select 'kyc refresh', code, name, banker, kyc_due_on, kyc_risk || ' risk, last done ' || coalesce(kyc_reviewed_on::text, 'never'), 2
from v_kyc_due where kyc_due_on <= current_date
union all
select 'quiet client', code, name, banker, last_contact_on,
       coalesce(days_since::text || ' days since contact', 'no contact recorded'), 3
from v_last_contact
where coalesce(days_since, 100000) > (select value from policy where key = 'quiet_days')
union all
select 'follow-up overdue', c.code, c.name, b.name, i.next_step_on, i.next_step, 2
from interactions i
join clients c on c.id = i.client_id
left join bankers b on b.id = c.banker_id
where not i.next_step_done and i.next_step_on < current_date and c.status = 'active';
