#!/usr/bin/env node
// The one CLI for the lending desk. Human tables by default, --json for machines.
//
//   npm run lending -- attention
//   npm run lending -- show kereru
//   npm run lending -- test COV-602 --value=104 --by="Hana Walker"
//   npm run lending -- import salesforce --accounts=Account.csv --facilities=FinancialAccount.csv --by="Tom Fraser"
//
// Clients match on code, id prefix or part of the name, case-insensitive. An ambiguous
// match lists the candidates and exits 1. Every write needs --by and lands in the audit log.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { heading, isoDate, money, table, truncate } from './lib/format.mjs';

// ---------------------------------------------------------------- input helpers

export function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq < 0) flags[a.slice(2)] = true;
      else flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else pos.push(a);
  }
  return { pos, flags };
}

function date(v, what = 'date') {
  if (v === undefined || v === null || v === '' || v === true) return null;
  const s = String(v).trim();
  if (s === 'today') return isoDate(new Date());
  const m = s.match(/^([+-]\d+)d$/);
  if (m) return isoDate(new Date(Date.now() + Number(m[1]) * 86400000));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Invalid ${what} "${s}": use YYYY-MM-DD, today, or +30d`);
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new Error(`Invalid ${what} "${s}"`);
  return s;
}

// "1.2m", "250k", "250,000", "$80,000.50" -> cents
export function cents(v, what = 'amount') {
  if (v === undefined || v === null || v === '' || v === true) return null;
  const s = String(v).trim().replace(/[$,\s]/g, '').toLowerCase();
  const m = s.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!m) throw new Error(`Invalid ${what} "${v}": use 250000, 250k or 1.2m`);
  const mult = m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1;
  return Math.round(Number(m[1]) * mult * 100);
}

// Salesforce exports dates as 2024-03-31 or 2024-03-31T00:00:00.000Z.
const sfDate = (v, what) => date(/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : v || null, what);

function int(v, what, lo, hi) {
  if (v === undefined || v === null || v === '' || v === true) return null;
  if (!/^-?\d+$/.test(String(v))) throw new Error(`${what} must be an integer`);
  const n = Number(v);
  if ((lo !== undefined && n < lo) || (hi !== undefined && n > hi)) throw new Error(`${what} must be between ${lo} and ${hi}`);
  return n;
}

function num(v, what) {
  if (v === undefined || v === null || v === '' || v === true) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${what} must be a number`);
  return n;
}

function oneOf(v, allowed, what) {
  if (v === undefined || v === null || v === '' || v === true) return null;
  const s = String(v).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!allowed.includes(s)) throw new Error(`${what} must be one of: ${allowed.join(', ')}`);
  return s;
}

function need(flags, ...names) {
  for (const n of names) if (flags[n] === undefined || flags[n] === true || flags[n] === '') throw new Error(`Missing --${n}`);
}

const pct = (a, b) => (Number(b) ? Math.round((Number(a) / Number(b)) * 100) : 0);
const days = (n) => (n === null || n === undefined ? '' : n < 0 ? `${-n} overdue` : `${n}`);
const kindLabel = (s) => String(s || '').replace(/_/g, ' ');

// ---------------------------------------------------------------- lookups

async function resolve(db, entity, term) {
  if (!term || term === true) throw new Error(`Name the ${entity}`);
  const spec = {
    client: { table: 'clients', label: "code || '  ' || name", name: 'name' },
    facility: { table: 'facilities', label: "code || '  ' || coalesce(purpose, kind)", name: 'purpose' },
    covenant: { table: 'covenants', label: "code || '  ' || metric", name: 'metric' },
    banker: { table: 'bankers', label: "code || '  ' || name", name: 'name' },
    group: { table: 'client_groups', label: "code || '  ' || name", name: 'name' },
    opportunity: { table: 'opportunities', label: "code || '  ' || coalesce(product, kind)", name: 'product' },
    notice: { table: 'notices', label: "code || '  ' || kind", name: 'grounds' },
  }[entity];
  const t = String(term).trim();
  let rows = await db.query(`select id, ${spec.label} as label from ${spec.table} where lower(code) = lower($1)`, [t]);
  if (!rows.length && /^[0-9a-f-]{4,}$/i.test(t)) rows = await db.query(`select id, ${spec.label} as label from ${spec.table} where id::text like $1`, [`${t.toLowerCase()}%`]);
  if (!rows.length) rows = await db.query(`select id, ${spec.label} as label from ${spec.table} where ${spec.name} ilike $1 order by code`, [`%${t}%`]);
  if (!rows.length) throw new Error(`No ${entity} matches "${t}"`);
  if (rows.length > 1) {
    const err = new Error(`Ambiguous ${entity} "${t}": ${rows.map((r) => r.label).join('; ')}`);
    err.candidates = rows;
    throw err;
  }
  return rows[0].id;
}

async function audit(db, actor, action, entity, ref, detail = {}) {
  await db.query('insert into audit (actor, action, entity, ref, detail) values ($1, $2, $3, $4, $5)', [actor, action, entity, ref, JSON.stringify(detail)]);
}

function actor(flags) {
  if (!flags.by || flags.by === true) throw new Error('Writes need --by="Your Name" for the audit log');
  return String(flags.by);
}

async function policy(db) {
  const rows = await db.query('select key, value from policy');
  return Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
}

async function tx(db, fn) {
  await db.exec('BEGIN');
  try {
    const out = await fn();
    await db.exec('COMMIT');
    return out;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}

// ---------------------------------------------------------------- the compliance rules (docs/compliance.md)

export async function complianceChecks(db) {
  const p = await policy(db);
  const out = [];
  const add = (rule, source, items, dueItems = []) =>
    out.push({ rule, source, status: items.length ? 'breach' : dueItems.length ? 'due' : 'clean', breaches: items.length, due: dueItems.length, items: [...items, ...dueItems] });

  const mat = await db.query(`
    select m.code, m.client_code, m.client, m.maturity_on, m.notice_by, m.repayment, m.extension_decision,
           (select min(n.issued_on) from notices n where n.facility_id = m.id and n.kind = 'non_extension' and n.status in ('issued', 'remedied')) as notice_on
    from v_maturities m
    where m.small_business and m.repayment <> 'amortising' and m.extension_decision <> 'extend'
    order by m.notice_by`);
  const today = isoDate(new Date());
  const soon = isoDate(new Date(Date.now() + 30 * 86400000));
  const late = mat.filter((r) => (r.notice_on ? isoDate(r.notice_on) > isoDate(r.notice_by) : isoDate(r.notice_by) < today))
    .map((r) => ({ ref: r.code, client: r.client, detail: r.notice_on ? `notice went ${r.notice_on}, needed by ${r.notice_by}` : `matures ${r.maturity_on}, notice needed by ${r.notice_by}, none issued` }));
  const due = mat.filter((r) => !r.notice_on && isoDate(r.notice_by) >= today && isoDate(r.notice_by) <= soon)
    .map((r) => ({ ref: r.code, client: r.client, detail: `decide by ${r.notice_by} (matures ${r.maturity_on})` }));
  add(`Non-extension notice at least ${p.notice_months_non_extension} months before maturity`, 'Banking Code of Practice 2025, para 93', late, due);

  const short = async (kind, minDays, label, source) => {
    const rows = await db.query(`
      select n.code, c.name as client, n.issued_on, n.effective_on, n.status, coalesce(trim(n.grounds), '') as grounds,
             (n.effective_on - n.issued_on) as gap
      from notices n join clients c on c.id = n.client_id
      where n.kind = $1 and n.status in ('draft', 'issued') order by n.issued_on`, [kind]);
    const bad = rows.filter((r) => Number(r.gap) < minDays || (kind === 'default_remedy' && !r.grounds))
      .map((r) => ({ ref: r.code, client: r.client, detail: `${r.status}: ${r.gap} days given, ${minDays} needed${kind === 'default_remedy' && !r.grounds ? ', no grounds stated' : ''}` }));
    add(label, source, bad);
  };
  await short('default_remedy', p.notice_days_default, `Default notice states the grounds and gives ${p.notice_days_default} days to remedy`, 'Banking Code of Practice 2025, para 88');
  await short('payment_default', p.notice_days_default, `${p.notice_days_default} days notice of a payment default before demand`, 'Banking Code of Practice 2025, para 82');
  await short('unfavourable_change', p.notice_days_change, `${p.notice_days_change} days notice of an unfavourable change`, 'Banking Code of Practice 2025, para 36');

  const cov = await db.query(`
    select v.code, c.name as client, v.metric, f.code as facility, f.kind
    from covenants v join facilities f on f.id = v.facility_id join clients c on c.id = f.client_id
    where v.active and v.kind = 'financial' and f.status = 'active' and c.small_business
      and not f.specialised and f.kind not in ('property_development', 'construction')
    order by v.code`);
  add('Financial covenants only on specialised small business loans', 'Banking Code of Practice 2025, para 91',
    cov.map((r) => ({ ref: r.code, client: r.client, detail: `${r.metric} on ${r.facility} (${kindLabel(r.kind)}), not marked specialised` })));

  const kyc = await db.query(`select code, name, kyc_risk, kyc_reviewed_on, kyc_due_on from v_kyc_due order by kyc_due_on`);
  add('Ongoing customer due diligence refreshed on the risk cycle', 'AML/CFT Act 2009 (NZ) s 31; AML/CTF Act 2006 (Australia) ongoing CDD',
    kyc.filter((r) => isoDate(r.kyc_due_on) < today).map((r) => ({ ref: r.code, client: r.name, detail: `${r.kyc_risk} risk, last done ${r.kyc_reviewed_on ? isoDate(r.kyc_reviewed_on) : 'never'}` })),
    kyc.filter((r) => isoDate(r.kyc_due_on) >= today && isoDate(r.kyc_due_on) <= soon).map((r) => ({ ref: r.code, client: r.name, detail: `due ${isoDate(r.kyc_due_on)}` })));

  const rev = await db.query(`select code, name, due_on, days_to_due from v_reviews_due order by due_on`);
  const missing = await db.query(`select code, name, last_review_on from v_reviews_missing order by code`);
  add(`Every exposure reviewed at least every ${p.review_months} months`, 'Your credit policy (APS 220 sets this expectation for banks)',
    [...rev.filter((r) => r.days_to_due < 0).map((r) => ({ ref: r.code, client: r.name, detail: `review ${-r.days_to_due} days overdue` })),
     ...missing.map((r) => ({ ref: r.code, client: r.name, detail: `no review scheduled, last completed ${r.last_review_on ? isoDate(r.last_review_on) : 'never'}` }))],
    rev.filter((r) => r.days_to_due >= 0 && r.days_to_due <= 30).map((r) => ({ ref: r.code, client: r.name, detail: `due ${isoDate(r.due_on)}` })));

  const fin = await db.query(`select client_code, client, kind, due_on, days_overdue from v_financials_outstanding where days_overdue > 0 order by days_overdue desc`);
  add('Financial information received when the agreement says', 'Your facility agreements (Banking Code para 87(i) and para 88 before acting on it)',
    fin.map((r) => ({ ref: r.client_code, client: r.client, detail: `${kindLabel(r.kind)} ${r.days_overdue} days late` })));
  return out;
}

// ---------------------------------------------------------------- commands

const C = {};
const cmd = (name, summary, fn, opts = {}) => (C[name] = { name, summary, fn, ...opts });

cmd('help', 'List every command', async () => Object.values(C).map((c) => ({ command: c.name, does: c.summary })),
  { cols: [{ key: 'command', label: 'command' }, { key: 'does', label: 'what it does' }] });

cmd('clients', 'Active clients with exposure, grade and banker (--banker, --watch, --industry, --all)', async (db, pos, f) => {
  const where = [f.all ? 'true' : "c.status = 'active'"];
  const params = [];
  if (f.banker) { params.push(await resolve(db, 'banker', f.banker)); where.push(`c.banker_id = $${params.length}`); }
  if (f.industry) { params.push(`%${f.industry}%`); where.push(`c.industry ilike $${params.length}`); }
  if (f.watch) where.push('c.watchlist');
  return db.query(`
    select c.code, c.name, g.code as group_code, c.industry, b.name as banker, c.risk_grade as grade, c.watchlist, c.status,
           coalesce(sum(fa.limit_cents) filter (where fa.status = 'active'), 0)::bigint as limit_cents,
           coalesce(sum(fa.drawn_cents) filter (where fa.status = 'active'), 0)::bigint as drawn_cents
    from clients c left join client_groups g on g.id = c.group_id left join bankers b on b.id = c.banker_id
    left join facilities fa on fa.client_id = c.id
    where ${where.join(' and ')}
    group by c.id, c.code, c.name, g.code, c.industry, b.name, c.risk_grade, c.watchlist, c.status
    order by c.code`, params);
}, { flags: ['banker', 'watch', 'industry', 'all'], cols: [
  { key: 'code', label: 'code' }, { key: 'name', label: 'client' }, { key: 'group_code', label: 'group' }, { key: 'industry', label: 'industry' },
  { key: 'banker', label: 'banker' }, { key: 'grade', label: 'grade', align: 'right' }, { key: 'watchlist', label: 'watch', format: (v) => (v ? 'yes' : '') },
  { key: 'limit_cents', label: 'limits', align: 'right', format: (v) => money(v) }, { key: 'drawn_cents', label: 'drawn', align: 'right', format: (v) => money(v) }] });

cmd('show', 'One client: facilities, covenants, reviews, financials owed, contacts, last contact', async (db, pos) => {
  const id = await resolve(db, 'client', pos.join(' '));
  const [client] = await db.query(`
    select c.*, g.name as group_name, b.name as banker from clients c
    left join client_groups g on g.id = c.group_id left join bankers b on b.id = c.banker_id where c.id = $1`, [id]);
  return {
    client,
    contacts: await db.query('select name, role, email, phone, guarantor, primary_contact from contacts where client_id = $1 order by primary_contact desc, name', [id]),
    facilities: await db.query(`select code, kind, purpose, limit_cents, drawn_cents, currency, repayment, maturity_on, extension_decision, status, security
                                from facilities where client_id = $1 order by status, code`, [id]),
    covenants: await db.query(`select d.code, d.facility_code, d.kind, d.metric, d.comparator, d.threshold, d.next_test_on, d.last_result, d.last_value
                               from v_covenants_due d where d.client_code = $1 order by d.next_test_on`, [client.code]),
    reviews: await db.query('select due_on, completed_on, outcome, grade_before, grade_after, approved_by, summary from credit_reviews where client_id = $1 order by due_on desc', [id]),
    financials: await db.query('select kind, period_end, due_on, received_on, note from financials where client_id = $1 order by due_on desc', [id]),
    pipeline: await db.query('select code, kind, product, amount_cents, stage, expected_on from opportunities where client_id = $1 order by created_at desc', [id]),
    notices: await db.query('select code, kind, issued_on, effective_on, status from notices where client_id = $1 order by issued_on desc', [id]),
    recent: await db.query('select happened_on, kind, summary, next_step, next_step_on, next_step_done from interactions where client_id = $1 order by happened_on desc limit 5', [id]),
  };
}, { render: renderShow });

cmd('groups', 'Connected exposure by client group, largest first', async (db) =>
  db.query('select * from v_group_exposure order by limit_cents desc'), { cols: [
  { key: 'group_code', label: 'group' }, { key: 'group_name', label: 'name' }, { key: 'clients', label: 'entities', align: 'right' },
  { key: 'facilities', label: 'facilities', align: 'right' }, { key: 'limit_cents', label: 'limits', align: 'right', format: (v) => money(v) },
  { key: 'drawn_cents', label: 'drawn', align: 'right', format: (v) => money(v) }, { key: 'worst_grade', label: 'worst grade', align: 'right' },
  { key: 'on_watchlist', label: 'watch', format: (v) => (v ? 'yes' : '') }] });

cmd('facilities', 'Every active facility with limit, drawn and use (--client)', async (db, pos, f) => {
  const params = [];
  let where = "f.status = 'active'";
  if (f.client) { params.push(await resolve(db, 'client', f.client)); where += ` and f.client_id = $1`; }
  return db.query(`select f.code, c.name as client, f.kind, f.repayment, f.limit_cents, f.drawn_cents, f.maturity_on
                   from facilities f join clients c on c.id = f.client_id where ${where} order by c.code, f.code`, params);
}, { flags: ['client'], cols: [
  { key: 'code', label: 'facility' }, { key: 'client', label: 'client' }, { key: 'kind', label: 'type', format: kindLabel },
  { key: 'repayment', label: 'repayment', format: kindLabel }, { key: 'limit_cents', label: 'limit', align: 'right', format: (v) => money(v) },
  { key: 'drawn_cents', label: 'drawn', align: 'right', format: (v) => money(v) }, { key: 'use', label: 'used', align: 'right', format: (v, r) => `${pct(r.drawn_cents, r.limit_cents)}%` },
  { key: 'maturity_on', label: 'matures' }] });

cmd('headroom', 'Facilities drawn above a share of their limit (--over=90)', async (db, pos, f) => {
  const over = int(f.over ?? 90, '--over', 1, 200);
  return db.query(`select f.code, c.name as client, f.kind, f.limit_cents, f.drawn_cents,
                          round(100.0 * f.drawn_cents / nullif(f.limit_cents, 0))::int as used_pct,
                          (f.limit_cents - f.drawn_cents)::bigint as headroom_cents
                   from facilities f join clients c on c.id = f.client_id
                   where f.status = 'active' and f.limit_cents > 0 and 100.0 * f.drawn_cents / f.limit_cents >= $1
                   order by used_pct desc`, [over]);
}, { flags: ['over'], cols: [
  { key: 'code', label: 'facility' }, { key: 'client', label: 'client' }, { key: 'kind', label: 'type', format: kindLabel },
  { key: 'limit_cents', label: 'limit', align: 'right', format: (v) => money(v) }, { key: 'drawn_cents', label: 'drawn', align: 'right', format: (v) => money(v) },
  { key: 'used_pct', label: 'used', align: 'right', format: (v) => `${v}%` }, { key: 'headroom_cents', label: 'headroom', align: 'right', format: (v) => money(v) }] });

cmd('maturities', 'Facilities maturing soon, with the Banking Code notice date (--days=180)', async (db, pos, f) => {
  const d = int(f.days ?? 180, '--days', 1, 3650);
  return db.query(`select code, client, kind, repayment, limit_cents, maturity_on, days_to_maturity, notice_by, extension_decision, notice_issued, small_business
                   from v_maturities where days_to_maturity <= $1 order by maturity_on`, [d]);
}, { flags: ['days'], cols: [
  { key: 'code', label: 'facility' }, { key: 'client', label: 'client' }, { key: 'repayment', label: 'repayment', format: kindLabel },
  { key: 'limit_cents', label: 'limit', align: 'right', format: (v) => money(v) }, { key: 'maturity_on', label: 'matures' },
  { key: 'days_to_maturity', label: 'days', align: 'right' },
  { key: 'notice_by', label: 'notice by', format: (v, r) => (r.repayment === 'amortising' || !r.small_business ? '' : v) },
  { key: 'extension_decision', label: 'decision', format: kindLabel }, { key: 'notice_issued', label: 'notice', format: (v) => (v ? 'issued' : '') }] });

cmd('reviews', 'Open credit reviews due inside --days=60, overdue first, plus clients with none scheduled', async (db, pos, f) => {
  const d = int(f.days ?? 60, '--days', 1, 3650);
  const due = await db.query(`select code, name, banker, due_on, days_to_due, risk_grade as grade, watchlist from v_reviews_due where days_to_due <= $1 order by due_on`, [d]);
  const missing = await db.query(`select code, name, banker, null as due_on, null as days_to_due, null as grade, false as watchlist, last_review_on from v_reviews_missing order by code`);
  return [...due, ...missing.map((m) => ({ ...m, note: `none scheduled, last ${m.last_review_on ? isoDate(m.last_review_on) : 'never'}` }))];
}, { flags: ['days'], cols: [
  { key: 'code', label: 'code' }, { key: 'name', label: 'client' }, { key: 'banker', label: 'banker' }, { key: 'due_on', label: 'due' },
  { key: 'days_to_due', label: 'days', align: 'right', format: (v, r) => r.note || days(v) }, { key: 'grade', label: 'grade', align: 'right' },
  { key: 'watchlist', label: 'watch', format: (v) => (v ? 'yes' : '') }] });

cmd('covenants', 'Covenant tests due inside --days=30 or overdue, with the last result', async (db, pos, f) => {
  const d = int(f.days ?? 30, '--days', 0, 3650);
  return db.query(`select code, client, facility_code, kind, metric, comparator, threshold, next_test_on, days_to_test, last_result, last_value
                   from v_covenants_due where days_to_test <= $1 or last_result = 'breach' order by next_test_on`, [d]);
}, { flags: ['days'], cols: [
  { key: 'code', label: 'covenant' }, { key: 'client', label: 'client' }, { key: 'facility_code', label: 'facility' },
  { key: 'metric', label: 'test', format: (v, r) => `${v} ${r.comparator}${r.threshold !== null && r.threshold !== undefined ? ' ' + Number(r.threshold) : ''}` },
  { key: 'next_test_on', label: 'next test' }, { key: 'days_to_test', label: 'days', align: 'right', format: days },
  { key: 'last_result', label: 'last', format: (v, r) => (v ? `${v}${r.last_value !== null && r.last_value !== undefined ? ' ' + Number(r.last_value) : ''}` : '') }] });

cmd('breaches', 'Every covenant breach and waiver on record, newest first', async (db) =>
  db.query(`select v.code, c.name as client, f.code as facility_code, v.metric, v.comparator, v.threshold, t.tested_on, t.value, t.result, t.note
            from covenant_tests t join covenants v on v.id = t.covenant_id join facilities f on f.id = v.facility_id join clients c on c.id = f.client_id
            where t.result in ('breach', 'waived') order by t.tested_on desc`), { cols: [
  { key: 'code', label: 'covenant' }, { key: 'client', label: 'client' }, { key: 'metric', label: 'test', format: (v, r) => `${v} ${r.comparator} ${Number(r.threshold)}` },
  { key: 'tested_on', label: 'tested' }, { key: 'value', label: 'value', align: 'right', format: (v) => (v === null ? '' : Number(v)) },
  { key: 'result', label: 'result' }, { key: 'note', label: 'note', format: (v) => truncate(v, 50) }] });

cmd('financials', 'Financial information owed and not received, latest first', async (db) =>
  db.query('select client_code, client, banker, kind, period_end, due_on, days_overdue from v_financials_outstanding order by days_overdue desc'), { cols: [
  { key: 'client_code', label: 'code' }, { key: 'client', label: 'client' }, { key: 'banker', label: 'banker' }, { key: 'kind', label: 'what', format: kindLabel },
  { key: 'period_end', label: 'period end' }, { key: 'due_on', label: 'due' },
  { key: 'days_overdue', label: 'late', align: 'right', format: (v) => (v > 0 ? `${v} days` : `in ${-v} days`) }] });

cmd('kyc', 'KYC refreshes due inside --days=30 or overdue, by risk rating', async (db, pos, f) => {
  const d = int(f.days ?? 30, '--days', 0, 3650);
  return db.query(`select code, name, banker, kyc_risk, kyc_reviewed_on, kyc_due_on, (kyc_due_on - current_date) as days_to_due
                   from v_kyc_due where kyc_due_on <= current_date + $1::int order by kyc_due_on`, [d]);
}, { flags: ['days'], cols: [
  { key: 'code', label: 'code' }, { key: 'name', label: 'client' }, { key: 'banker', label: 'banker' }, { key: 'kyc_risk', label: 'risk' },
  { key: 'kyc_reviewed_on', label: 'last done', format: (v) => (v ? isoDate(v) : 'never') }, { key: 'kyc_due_on', label: 'due' },
  { key: 'days_to_due', label: 'days', align: 'right', format: days }] });

cmd('quiet', 'Active clients with no contact inside --days (policy default 90)', async (db, pos, f) => {
  const p = await policy(db);
  const d = int(f.days ?? p.quiet_days, '--days', 1, 3650);
  return db.query(`select code, name, banker, last_contact_on, days_since from v_last_contact
                   where coalesce(days_since, 100000) > $1 order by days_since desc nulls first`, [d]);
}, { flags: ['days'], cols: [
  { key: 'code', label: 'code' }, { key: 'name', label: 'client' }, { key: 'banker', label: 'banker' },
  { key: 'last_contact_on', label: 'last contact', format: (v) => (v ? isoDate(v) : 'never') }, { key: 'days_since', label: 'days', align: 'right' }] });

cmd('pipeline', 'Open deals by stage with days since they last moved (--all includes settled and lost)', async (db, pos, f) =>
  db.query(`select o.code, c.name as client, b.name as banker, o.kind, o.product, o.amount_cents, o.stage, o.expected_on,
                   (current_date - o.updated_at::date) as idle_days, o.source, o.lost_reason
            from opportunities o join clients c on c.id = o.client_id left join bankers b on b.id = o.banker_id
            where $1 or o.stage not in ('settled', 'lost')
            order by array_position(array['lead','discovery','application','credit','approved','settled','lost'], o.stage), o.expected_on`, [Boolean(f.all)]),
{ flags: ['all'], cols: [
  { key: 'code', label: 'deal' }, { key: 'client', label: 'client' }, { key: 'product', label: 'product' }, { key: 'stage', label: 'stage' },
  { key: 'amount_cents', label: 'amount', align: 'right', format: (v) => money(v) }, { key: 'expected_on', label: 'expected' },
  { key: 'idle_days', label: 'idle', align: 'right', format: (v) => `${v}d` }, { key: 'banker', label: 'banker' }] });

cmd('book', 'The book by banker: clients, limits, drawn, average grade, watchlist', async (db) =>
  db.query(`select coalesce(e.banker, '(none)') as banker, count(*)::int as clients, sum(e.limit_cents)::bigint as limit_cents,
                   sum(e.drawn_cents)::bigint as drawn_cents, round(avg(e.risk_grade), 1) as avg_grade,
                   count(*) filter (where e.watchlist)::int as watchlist
            from v_client_exposure e group by e.banker order by limit_cents desc`), { cols: [
  { key: 'banker', label: 'banker' }, { key: 'clients', label: 'clients', align: 'right' },
  { key: 'limit_cents', label: 'limits', align: 'right', format: (v) => money(v) }, { key: 'drawn_cents', label: 'drawn', align: 'right', format: (v) => money(v) },
  { key: 'avg_grade', label: 'avg grade', align: 'right', format: (v) => (v === null ? '' : Number(v)) }, { key: 'watchlist', label: 'watch', align: 'right' }] });

cmd('concentration', 'Limits and drawn by industry, with share of the book and watchlist exposure', async (db) =>
  db.query(`select coalesce(c.industry, '(not set)') as industry, count(distinct c.id)::int as clients,
                   sum(e.limit_cents)::bigint as limit_cents, sum(e.drawn_cents)::bigint as drawn_cents,
                   round(100.0 * sum(e.limit_cents) / nullif((select sum(limit_cents) from v_client_exposure), 0), 1) as share_pct,
                   coalesce(sum(e.limit_cents) filter (where e.watchlist), 0)::bigint as watch_cents
            from v_client_exposure e join clients c on c.id = e.client_id
            group by coalesce(c.industry, '(not set)') order by limit_cents desc`), { cols: [
  { key: 'industry', label: 'industry' }, { key: 'clients', label: 'clients', align: 'right' },
  { key: 'limit_cents', label: 'limits', align: 'right', format: (v) => money(v) }, { key: 'share_pct', label: 'share', align: 'right', format: (v) => `${Number(v)}%` },
  { key: 'drawn_cents', label: 'drawn', align: 'right', format: (v) => money(v) }, { key: 'watch_cents', label: 'on watch', align: 'right', format: (v) => (Number(v) ? money(v) : '') }] });

cmd('grade-drift', 'Clients whose risk grade got worse at their last completed review', async (db) =>
  db.query(`select distinct on (c.id) c.code, c.name, r.completed_on, r.grade_before, r.grade_after, r.outcome, r.summary
            from credit_reviews r join clients c on c.id = r.client_id
            where r.completed_on is not null order by c.id, r.completed_on desc`).then((rows) =>
    rows.filter((r) => r.grade_after > r.grade_before).sort((a, b) => String(b.completed_on).localeCompare(String(a.completed_on)))), { cols: [
  { key: 'code', label: 'code' }, { key: 'name', label: 'client' }, { key: 'completed_on', label: 'reviewed' },
  { key: 'grade_before', label: 'from', align: 'right' }, { key: 'grade_after', label: 'to', align: 'right' }, { key: 'outcome', label: 'outcome' },
  { key: 'summary', label: 'why', format: (v) => truncate(v, 50) }] });

cmd('attention', 'Everything that needs a banker this week, worst first', async (db, pos, f) => {
  const params = [];
  let where = 'true';
  if (f.banker) { const [b] = await db.query('select name from bankers where id = $1', [await resolve(db, 'banker', f.banker)]); params.push(b.name); where = 'banker = $1'; }
  return db.query(`select issue, client_code, client, banker, on_date, detail from v_attention where ${where} order by severity, on_date nulls first`, params);
}, { flags: ['banker'], cols: [
  { key: 'issue', label: 'issue' }, { key: 'client_code', label: 'code' }, { key: 'client', label: 'client' }, { key: 'banker', label: 'banker' },
  { key: 'on_date', label: 'date', format: (v) => (v ? isoDate(v) : '') }, { key: 'detail', label: 'detail', format: (v) => truncate(v, 60) }] });

cmd('compliance', 'Check the book against the rules in docs/compliance.md (--detail lists every item)', async (db, pos, f) => {
  const rows = await complianceChecks(db);
  if (f.detail) return rows.flatMap((r) => r.items.map((i) => ({ rule: r.rule, source: r.source, ...i })));
  return rows.map((r) => ({ ...r, worst: r.items[0] ? `${r.items[0].ref} ${r.items[0].client}: ${r.items[0].detail}` : '' }));
}, { flags: ['detail'], cols: [
  { key: 'status', label: 'status' }, { key: 'rule', label: 'rule', format: (v) => truncate(v, 64) }, { key: 'breaches', label: 'breach', align: 'right' },
  { key: 'due', label: 'due', align: 'right' }, { key: 'worst', label: 'worst example', format: (v) => truncate(v, 70) }], detailCols: [
  { key: 'rule', label: 'rule', format: (v) => truncate(v, 50) }, { key: 'ref', label: 'ref' }, { key: 'client', label: 'client' }, { key: 'detail', label: 'detail' }] });

cmd('history', 'The audit log and call notes for one client, newest first', async (db, pos) => {
  const id = await resolve(db, 'client', pos.join(' '));
  const [c] = await db.query('select code from clients where id = $1', [id]);
  const refs = (await db.query(`select code from facilities where client_id = $1 union select v.code from covenants v join facilities f on f.id = v.facility_id where f.client_id = $1
                                union select code from opportunities where client_id = $1 union select code from notices where client_id = $1`, [id])).map((r) => r.code);
  const log = await db.query(`select at::date as on_date, actor as who, action as what, ref, detail::text as detail from audit where ref = any($1::text[]) order by at desc`, [[c.code, ...refs]]);
  const calls = await db.query(`select i.happened_on as on_date, coalesce(b.name, '') as who, i.kind as what, '' as ref, i.summary as detail
                                from interactions i left join bankers b on b.id = i.banker_id where i.client_id = $1`, [id]);
  return [...log, ...calls].sort((a, b) => String(b.on_date).localeCompare(String(a.on_date)));
}, { cols: [
  { key: 'on_date', label: 'date', format: (v) => isoDate(v) }, { key: 'who', label: 'who' }, { key: 'what', label: 'what' }, { key: 'ref', label: 'ref' },
  { key: 'detail', label: 'detail', format: (v) => truncate(v, 70) }] });

// ---------------------------------------------------------------- writes

cmd('add-client', 'Add a client (--code --name --banker --industry --grade --kyc-risk --group --entity --balance-month)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'code', 'name');
  return tx(db, async () => {
    const banker = f.banker ? await resolve(db, 'banker', f.banker) : null;
    const group = f.group ? await resolve(db, 'group', f.group) : null;
    const [row] = await db.query(`insert into clients (code, name, banker_id, group_id, industry, risk_grade, kyc_risk, kyc_reviewed_on, entity_type,
                                    balance_month, small_business, status, client_since)
                                  values ($1, $2, $3, $4, $5, $6, coalesce($7, 'medium'), $8, coalesce($9, 'company'), coalesce($10, 3), $11, coalesce($12, 'active'), current_date)
                                  returning code, name, status`,
      [f.code, f.name, banker, group, f.industry || null, int(f.grade, '--grade', 1, 10), oneOf(f['kyc-risk'], ['low', 'medium', 'high'], '--kyc-risk'),
       date(f['kyc-on'], '--kyc-on'), oneOf(f.entity, ['company', 'trust', 'partnership', 'sole_trader', 'cooperative', 'other'], '--entity'),
       int(f['balance-month'], '--balance-month', 1, 12), f['not-small-business'] ? false : true, oneOf(f.status, ['prospect', 'active', 'exited'], '--status')]);
    await audit(db, by, 'add-client', 'client', row.code, { name: row.name });
    return [row];
  });
}, { write: true, flags: ['code', 'name', 'banker', 'group', 'industry', 'grade', 'kyc-risk', 'kyc-on', 'entity', 'balance-month', 'not-small-business', 'status'] });

const FAC_KINDS = ['overdraft', 'term_loan', 'revolving', 'equipment_finance', 'property_investment', 'property_development', 'construction', 'trade_finance', 'seasonal', 'bank_guarantee'];

cmd('add-facility', 'Add a facility (--client --code --kind --limit --drawn --maturity --repayment --specialised --purpose --security)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'client', 'code', 'kind', 'limit');
  return tx(db, async () => {
    const client = await resolve(db, 'client', f.client);
    const kind = oneOf(f.kind, FAC_KINDS, '--kind');
    const [row] = await db.query(`insert into facilities (code, client_id, kind, purpose, limit_cents, drawn_cents, currency, margin_bps, start_on, maturity_on,
                                    repayment, specialised, security)
                                  values ($1, $2, $3, $4, $5, coalesce($6, 0), coalesce($7, 'NZD'), $8, coalesce($9, current_date), $10, coalesce($11, 'amortising'), $12, $13)
                                  returning code, kind, limit_cents, maturity_on`,
      [f.code, client, kind, f.purpose || null, cents(f.limit, '--limit'), cents(f.drawn, '--drawn'), f.currency || null, int(f.margin, '--margin', 0, 5000),
       date(f.start, '--start'), date(f.maturity, '--maturity'), oneOf(f.repayment, ['amortising', 'interest_only', 'balloon', 'revolving'], '--repayment'),
       Boolean(f.specialised) || ['property_development', 'construction'].includes(kind), f.security || null]);
    await audit(db, by, 'add-facility', 'facility', row.code, { limit_cents: row.limit_cents });
    return [row];
  });
}, { write: true, flags: ['client', 'code', 'kind', 'limit', 'drawn', 'currency', 'margin', 'start', 'maturity', 'repayment', 'specialised', 'purpose', 'security'] });

cmd('amend', 'Change a facility: --limit --drawn --maturity --decision=extend|not_extend --status --reason', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'reason');
  return tx(db, async () => {
    const id = await resolve(db, 'facility', pos[0]);
    const [before] = await db.query('select code, limit_cents, drawn_cents, maturity_on, extension_decision, status from facilities where id = $1', [id]);
    const [row] = await db.query(`update facilities set limit_cents = coalesce($2, limit_cents), drawn_cents = coalesce($3, drawn_cents),
                                    maturity_on = coalesce($4, maturity_on), extension_decision = coalesce($5, extension_decision),
                                    status = coalesce($6, status), closed_on = case when $6 = 'closed' then current_date else closed_on end
                                  where id = $1 returning code, limit_cents, drawn_cents, maturity_on, extension_decision, status`,
      [id, cents(f.limit, '--limit'), cents(f.drawn, '--drawn'), date(f.maturity, '--maturity'),
       oneOf(f.decision, ['undecided', 'extend', 'not_extend'], '--decision'), oneOf(f.status, ['pending', 'active', 'closed', 'declined'], '--status')]);
    await audit(db, by, 'amend', 'facility', row.code, { reason: f.reason, before, after: row });
    return [row];
  });
}, { write: true, flags: ['limit', 'drawn', 'maturity', 'decision', 'status', 'reason'] });

cmd('add-covenant', 'Add a covenant (--facility --code --kind --metric --comparator --threshold --every --next)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'facility', 'code', 'kind', 'metric', 'next');
  return tx(db, async () => {
    const facility = await resolve(db, 'facility', f.facility);
    const kind = oneOf(f.kind, ['financial', 'reporting', 'undertaking'], '--kind');
    const comparator = kind === 'financial' ? String(f.comparator || '') : 'delivered';
    if (!['>=', '<=', 'delivered'].includes(comparator)) throw new Error('--comparator must be >=, <= or delivered');
    const [row] = await db.query(`insert into covenants (code, facility_id, kind, metric, comparator, threshold, every_months, next_test_on, notes)
                                  values ($1, $2, $3, $4, $5, $6, coalesce($7, 12), $8, $9) returning code, metric, comparator, threshold, next_test_on`,
      [f.code, facility, kind, f.metric, comparator, num(f.threshold, '--threshold'), int(f.every, '--every', 1, 36), date(f.next, '--next'), f.note || null]);
    await audit(db, by, 'add-covenant', 'covenant', row.code, { metric: row.metric });
    return [row];
  });
}, { write: true, flags: ['facility', 'code', 'kind', 'metric', 'comparator', 'threshold', 'every', 'next', 'note'] });

cmd('test', 'Record a covenant test (--value or --delivered, --on, --period-end, --waive, --note); rolls the next test date', async (db, pos, f) => {
  const by = actor(f);
  return tx(db, async () => {
    const id = await resolve(db, 'covenant', pos[0]);
    const [v] = await db.query('select code, comparator, threshold, every_months, next_test_on from covenants where id = $1', [id]);
    const on = date(f.on, '--on') || isoDate(new Date());
    let value = null;
    let result;
    if (v.comparator === 'delivered') {
      if (f.delivered === undefined && f.missed === undefined) throw new Error('Reporting covenants need --delivered or --missed');
      result = f.missed ? 'breach' : 'pass';
    } else {
      value = num(f.value, '--value');
      if (value === null) throw new Error('Financial covenants need --value');
      const t = Number(v.threshold);
      result = (v.comparator === '>=' ? value >= t : value <= t) ? 'pass' : 'breach';
    }
    if (f.waive) {
      if (result !== 'breach') throw new Error('Only a breach can be waived');
      need(f, 'note');
      result = 'waived';
    }
    await db.query('insert into covenant_tests (covenant_id, tested_on, period_end, value, result, note, tested_by) values ($1, $2, $3, $4, $5, $6, $7)',
      [id, on, date(f['period-end'], '--period-end'), value, result, f.note || null, by]);
    const [row] = await db.query(`update covenants set next_test_on = (greatest(next_test_on, $2::date) + every_months * interval '1 month')::date
                                  where id = $1 returning code, next_test_on`, [id, on]);
    await audit(db, by, 'test', 'covenant', v.code, { value, result });
    return [{ code: v.code, result, value, next_test_on: row.next_test_on }];
  });
}, { write: true, flags: ['value', 'delivered', 'missed', 'on', 'period-end', 'waive', 'note'] });

const FIN_KINDS = ['annual_accounts', 'management_accounts', 'tax_return', 'aged_debtors', 'valuation', 'insurance_certificate', 'budget'];

cmd('request', 'Ask a client for financial information (--kind --due --period-end --note)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'kind', 'due');
  return tx(db, async () => {
    const client = await resolve(db, 'client', pos.join(' '));
    const [row] = await db.query(`insert into financials (client_id, kind, period_end, due_on, note) values ($1, $2, $3, $4, $5) returning kind, due_on`,
      [client, oneOf(f.kind, FIN_KINDS, '--kind'), date(f['period-end'], '--period-end'), date(f.due, '--due'), f.note || null]);
    const [c] = await db.query('select code from clients where id = $1', [client]);
    await audit(db, by, 'request', 'client', c.code, row);
    return [{ client: c.code, ...row }];
  });
}, { write: true, flags: ['kind', 'due', 'period-end', 'note'] });

cmd('receive', 'Mark financial information received (--kind, --on)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'kind');
  return tx(db, async () => {
    const client = await resolve(db, 'client', pos.join(' '));
    const kind = oneOf(f.kind, FIN_KINDS, '--kind');
    const open = await db.query('select id from financials where client_id = $1 and kind = $2 and received_on is null order by due_on limit 1', [client, kind]);
    if (!open.length) throw new Error(`Nothing outstanding of kind ${kind} for that client`);
    const [row] = await db.query('update financials set received_on = $2 where id = $1 returning kind, due_on, received_on', [open[0].id, date(f.on, '--on') || isoDate(new Date())]);
    const [c] = await db.query('select code from clients where id = $1', [client]);
    await audit(db, by, 'receive', 'client', c.code, row);
    return [{ client: c.code, ...row }];
  });
}, { write: true, flags: ['kind', 'on'] });

cmd('schedule-review', 'Schedule a credit review (--due)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'due');
  return tx(db, async () => {
    const client = await resolve(db, 'client', pos.join(' '));
    const open = await db.query('select due_on from credit_reviews where client_id = $1 and completed_on is null', [client]);
    if (open.length) throw new Error(`A review is already open, due ${isoDate(open[0].due_on)}`);
    const [c] = await db.query('select code, risk_grade from clients where id = $1', [client]);
    const [row] = await db.query('insert into credit_reviews (client_id, due_on, grade_before) values ($1, $2, $3) returning due_on', [client, date(f.due, '--due'), c.risk_grade]);
    await audit(db, by, 'schedule-review', 'client', c.code, row);
    return [{ client: c.code, ...row }];
  });
}, { write: true, flags: ['due'] });

cmd('complete-review', 'Close the open credit review (--outcome --grade --approved-by --summary); schedules the next one', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'outcome', 'grade', 'approved-by', 'summary');
  return tx(db, async () => {
    const client = await resolve(db, 'client', pos.join(' '));
    const p = await policy(db);
    const open = await db.query('select id from credit_reviews where client_id = $1 and completed_on is null order by due_on limit 1', [client]);
    if (!open.length) throw new Error('No open review for that client: schedule-review first');
    const grade = int(f.grade, '--grade', 1, 10);
    const outcome = oneOf(f.outcome, ['renew', 'amend', 'reduce', 'exit', 'watch'], '--outcome');
    const on = date(f.on, '--on') || isoDate(new Date());
    await db.query('update credit_reviews set completed_on = $2, outcome = $3, grade_after = $4, approved_by = $5, summary = $6 where id = $1',
      [open[0].id, on, outcome, grade, f['approved-by'], f.summary]);
    await db.query('update clients set risk_grade = $2, watchlist = $3 where id = $1', [client, grade, outcome === 'watch' || outcome === 'exit']);
    let next = null;
    if (outcome !== 'exit') {
      [next] = await db.query(`insert into credit_reviews (client_id, due_on, grade_before) values ($1, ($2::date + $3 * interval '1 month')::date, $4) returning due_on`, [client, on, p.review_months, grade]);
    }
    const [c] = await db.query('select code from clients where id = $1', [client]);
    await audit(db, by, 'complete-review', 'client', c.code, { outcome, grade, approved_by: f['approved-by'] });
    return [{ client: c.code, outcome, grade, next_review: next ? next.due_on : null }];
  });
}, { write: true, flags: ['outcome', 'grade', 'approved-by', 'summary', 'on'] });

cmd('kyc-done', 'Record a completed KYC refresh (--on, --risk to re-rate)', async (db, pos, f) => {
  const by = actor(f);
  return tx(db, async () => {
    const client = await resolve(db, 'client', pos.join(' '));
    const [row] = await db.query(`update clients set kyc_reviewed_on = $2, kyc_risk = coalesce($3, kyc_risk) where id = $1 returning code, kyc_risk, kyc_reviewed_on`,
      [client, date(f.on, '--on') || isoDate(new Date()), oneOf(f.risk, ['low', 'medium', 'high'], '--risk')]);
    await audit(db, by, 'kyc-done', 'client', row.code, row);
    return [row];
  });
}, { write: true, flags: ['on', 'risk'] });

cmd('log', 'Log a call, visit or meeting (--kind --summary --next --next-on --on)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'summary');
  return tx(db, async () => {
    const client = await resolve(db, 'client', pos.join(' '));
    const banker = (await db.query('select id from bankers where lower(name) = lower($1)', [by]))[0]?.id || null;
    const [row] = await db.query(`insert into interactions (client_id, banker_id, kind, happened_on, summary, next_step, next_step_on)
                                  values ($1, $2, coalesce($3, 'call'), $4, $5, $6, $7) returning kind, happened_on, next_step, next_step_on`,
      [client, banker, oneOf(f.kind, ['call', 'visit', 'meeting', 'email', 'site_visit'], '--kind'), date(f.on, '--on') || isoDate(new Date()),
       f.summary, f.next || null, date(f['next-on'], '--next-on')]);
    const [c] = await db.query('select code from clients where id = $1', [client]);
    await audit(db, by, 'log', 'client', c.code, { kind: row.kind });
    return [{ client: c.code, ...row }];
  });
}, { write: true, flags: ['kind', 'summary', 'next', 'next-on', 'on'] });

cmd('done-step', 'Mark a client follow-up done (the oldest open one, or --step="part of its text")', async (db, pos, f) => {
  const by = actor(f);
  return tx(db, async () => {
    const client = await resolve(db, 'client', pos.join(' '));
    const rows = await db.query(`select id, next_step from interactions where client_id = $1 and next_step is not null and not next_step_done
                                 and ($2::text is null or next_step ilike '%' || $2 || '%') order by next_step_on`, [client, f.step ? String(f.step) : null]);
    if (!rows.length) throw new Error('No open follow-up matches');
    await db.query('update interactions set next_step_done = true where id = $1', [rows[0].id]);
    const [c] = await db.query('select code from clients where id = $1', [client]);
    await audit(db, by, 'done-step', 'client', c.code, { step: rows[0].next_step });
    return [{ client: c.code, done: rows[0].next_step }];
  });
}, { write: true, flags: ['step'] });

cmd('notice', 'Record a formal notice as a draft (--kind --facility --effective --grounds --issued); checked against the Code', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'kind', 'code', 'effective');
  return tx(db, async () => {
    const client = await resolve(db, 'client', pos.join(' '));
    const facility = f.facility ? await resolve(db, 'facility', f.facility) : null;
    const kind = oneOf(f.kind, ['non_extension', 'default_remedy', 'payment_default', 'unfavourable_change'], '--kind');
    const [row] = await db.query(`insert into notices (code, client_id, facility_id, kind, issued_on, effective_on, grounds, issued_by)
                                  values ($1, $2, $3, $4, $5, $6, $7, $8) returning code, kind, issued_on, effective_on, status`,
      [f.code, client, facility, kind, date(f.issued, '--issued') || isoDate(new Date()), date(f.effective, '--effective'), f.grounds || null, by]);
    if (kind === 'non_extension' && facility) await db.query("update facilities set extension_decision = 'not_extend' where id = $1", [facility]);
    await audit(db, by, 'notice', 'notice', row.code, row);
    return [row];
  });
}, { write: true, flags: ['kind', 'code', 'facility', 'effective', 'grounds', 'issued'] });

cmd('issue-notice', 'Mark a draft notice as issued (--on). Refuses one that fails the Code check', async (db, pos, f) => {
  const by = actor(f);
  return tx(db, async () => {
    const id = await resolve(db, 'notice', pos[0]);
    const p = await policy(db);
    const on = date(f.on, '--on') || isoDate(new Date());
    const [n] = await db.query('select code, kind, effective_on, coalesce(trim(grounds), \'\') as grounds, status from notices where id = $1', [id]);
    if (n.status !== 'draft') throw new Error(`${n.code} is already ${n.status}`);
    const gap = Math.round((Date.parse(isoDate(n.effective_on)) - Date.parse(on)) / 86400000);
    const min = n.kind === 'unfavourable_change' ? p.notice_days_change : n.kind === 'non_extension' ? 0 : p.notice_days_default;
    if (gap < min && !f.override) throw new Error(`${n.code} gives ${gap} days; the Code check needs ${min}. Move --effective, or pass --override with a --reason`);
    if (n.kind === 'default_remedy' && !n.grounds) throw new Error(`${n.code} states no grounds (Banking Code para 88)`);
    if (f.override) need(f, 'reason');
    const [row] = await db.query("update notices set status = 'issued', issued_on = $2 where id = $1 returning code, kind, issued_on, effective_on, status", [id, on]);
    await audit(db, by, 'issue-notice', 'notice', row.code, { gap_days: gap, override: f.override ? f.reason : undefined });
    return [row];
  });
}, { write: true, flags: ['on', 'override', 'reason'] });

cmd('opportunity', 'Add a deal (--code --kind --product --amount --stage --expected --source)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'code', 'kind');
  return tx(db, async () => {
    const client = await resolve(db, 'client', pos.join(' '));
    const banker = (await db.query('select banker_id from clients where id = $1', [client]))[0].banker_id;
    const [row] = await db.query(`insert into opportunities (code, client_id, banker_id, kind, product, amount_cents, stage, expected_on, source)
                                  values ($1, $2, $3, $4, $5, coalesce($6, 0), coalesce($7, 'lead'), $8, $9) returning code, kind, stage, amount_cents`,
      [f.code, client, banker, oneOf(f.kind, ['new_facility', 'limit_increase', 'refinance', 'term_extension', 'referral'], '--kind'), f.product || null,
       cents(f.amount, '--amount'), oneOf(f.stage, ['lead', 'discovery', 'application', 'credit', 'approved', 'settled', 'lost'], '--stage'),
       date(f.expected, '--expected'), f.source || null]);
    await audit(db, by, 'opportunity', 'opportunity', row.code, row);
    return [row];
  });
}, { write: true, flags: ['code', 'kind', 'product', 'amount', 'stage', 'expected', 'source'] });

cmd('move', 'Move a deal to a stage (--stage, --reason when lost)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'stage');
  return tx(db, async () => {
    const id = await resolve(db, 'opportunity', pos[0]);
    const stage = oneOf(f.stage, ['lead', 'discovery', 'application', 'credit', 'approved', 'settled', 'lost'], '--stage');
    if (stage === 'lost') need(f, 'reason');
    const [row] = await db.query('update opportunities set stage = $2, lost_reason = coalesce($3, lost_reason) where id = $1 returning code, stage', [id, stage, f.reason || null]);
    await audit(db, by, 'move', 'opportunity', row.code, { stage, reason: f.reason });
    return [row];
  });
}, { write: true, flags: ['stage', 'reason'] });

// ---------------------------------------------------------------- import and export

const SF_KIND = [
  [/overdraft/i, 'overdraft'], [/line of credit|revolv/i, 'revolving'], [/equipment|lease|asset/i, 'equipment_finance'],
  [/construction/i, 'construction'], [/development/i, 'property_development'], [/mortgage|property|real estate/i, 'property_investment'],
  [/trade|letter of credit|invoice/i, 'trade_finance'], [/guarantee/i, 'bank_guarantee'], [/seasonal/i, 'seasonal'],
];

cmd('import', 'Bring records across: import salesforce --accounts=Account.csv [--facilities=FinancialAccount.csv] [--dry-run]', async (db, pos, f) => {
  if (pos[0] !== 'salesforce') throw new Error('Usage: import salesforce --accounts=<csv> [--facilities=<csv>] [--dry-run] --by=<name>');
  const by = actor(f);
  need(f, 'accounts');
  const read = (file) => parseCsv(readFileSync(path.resolve(String(file)), 'utf8'));
  const accounts = read(f.accounts);
  const accts = f.facilities ? read(f.facilities) : [];
  const out = { clients_new: 0, clients_matched: 0, bankers_new: 0, facilities_new: 0, facilities_matched: 0, skipped: [] };
  const run = async () => {
    const byRef = new Map();
    for (const a of accounts) {
      const ref = pick(a, 'Id', 'Account ID', 'AccountId');
      const name = pick(a, 'Name', 'Account Name');
      if (!ref || !name) { out.skipped.push(`account row without Id or Name: ${JSON.stringify(a).slice(0, 80)}`); continue; }
      const existing = await db.query('select id from clients where source_ref = $1', [ref]);
      if (existing.length) { byRef.set(ref, existing[0].id); out.clients_matched++; continue; }
      let banker = null;
      const owner = pick(a, 'Owner Name', 'Account Owner', 'OwnerName', 'Owner.Name');
      if (owner) {
        banker = (await db.query('select id from bankers where lower(name) = lower($1)', [owner]))[0]?.id;
        if (!banker) {
          const n = (await db.query("select count(*)::int as n from bankers where code like 'SF-RM-%'"))[0].n + 1;
          banker = (await db.query('insert into bankers (code, name) values ($1, $2) returning id', [`SF-RM-${String(n).padStart(2, '0')}`, owner]))[0].id;
          out.bankers_new++;
        }
      }
      const code = `SF-${ref.slice(-6).toUpperCase()}`;
      const [row] = await db.query(`insert into clients (code, name, banker_id, industry, status, source_ref, notes, client_since)
                                    values ($1, $2, $3, $4, 'active', $5, $6, $7) returning id`,
        [code, name, banker, pick(a, 'Industry') || null, ref, pick(a, 'Description') || null,
         sfDate(pick(a, 'FinServ__ClientSince__c', 'ClientSince'), 'client since date') ]);
      byRef.set(ref, row.id);
      out.clients_new++;
    }
    for (const r of accts) {
      const ref = pick(r, 'Id');
      const owner = pick(r, 'FinServ__PrimaryOwner__c', 'PrimaryOwnerId', 'Primary Owner ID');
      let client = byRef.get(owner) || (await db.query('select id from clients where source_ref = $1', [owner]))[0]?.id;
      if (!ref || !client) { out.skipped.push(`financial account ${ref || '(no Id)'}: owner ${owner || '(blank)'} not among the imported accounts`); continue; }
      if ((await db.query('select 1 from facilities where source_ref = $1', [ref])).length) { out.facilities_matched++; continue; }
      const type = pick(r, 'FinServ__FinancialAccountType__c', 'FinancialAccountType', 'Type');
      const kind = (SF_KIND.find(([re]) => re.test(type)) || [null, 'term_loan'])[1];
      const status = /closed|inactive/i.test(pick(r, 'FinServ__Status__c', 'Status')) ? 'closed' : 'active';
      const code = pick(r, 'FinServ__FinancialAccountNumber__c', 'FinancialAccountNumber', 'Name') || `SF-${ref.slice(-6).toUpperCase()}`;
      const taken = (await db.query('select 1 from facilities where code = $1', [code])).length;
      await db.query(`insert into facilities (code, client_id, kind, purpose, limit_cents, drawn_cents, start_on, maturity_on, repayment, status, source_ref, notes)
                      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [taken ? `${code}-${ref.slice(-4)}` : code, client, kind, pick(r, 'Name') || null,
         cents(pick(r, 'FinServ__LoanAmount__c', 'LoanAmount') || pick(r, 'FinServ__Balance__c', 'Balance') || 0, 'loan amount'),
         cents(pick(r, 'FinServ__Balance__c', 'Balance') || 0, 'balance'),
         sfDate(pick(r, 'FinServ__OpenDate__c', 'OpenDate'), 'open date'), sfDate(pick(r, 'FinServ__LoanEndDate__c', 'LoanEndDate'), 'loan end date'),
         ['revolving', 'overdraft', 'seasonal', 'trade_finance'].includes(kind) ? 'revolving' : 'amortising', status, ref,
         [type && `Salesforce type: ${type}`, pick(r, 'FinServ__InterestRate__c', 'InterestRate') && `Rate: ${pick(r, 'FinServ__InterestRate__c', 'InterestRate')}%`].filter(Boolean).join('. ') || null]);
      out.facilities_new++;
    }
    await audit(db, by, f['dry-run'] ? 'import-dry-run' : 'import', 'import', 'salesforce', { ...out, skipped: out.skipped.length });
  };
  await db.exec('BEGIN');
  try {
    await run();
    await db.exec(f['dry-run'] ? 'ROLLBACK' : 'COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  return [{ mode: f['dry-run'] ? 'dry run, nothing saved' : 'imported', ...out, skipped: out.skipped.length, skipped_detail: out.skipped }];
}, { write: true, flags: ['accounts', 'facilities', 'dry-run'], cols: [
  { key: 'mode', label: 'mode' }, { key: 'clients_new', label: 'new clients', align: 'right' }, { key: 'clients_matched', label: 'already here', align: 'right' },
  { key: 'bankers_new', label: 'new bankers', align: 'right' }, { key: 'facilities_new', label: 'new facilities', align: 'right' },
  { key: 'facilities_matched', label: 'facilities here', align: 'right' }, { key: 'skipped', label: 'skipped', align: 'right' }] });

const EXPORT_TABLES = ['bankers', 'client_groups', 'clients', 'contacts', 'facilities', 'covenants', 'covenant_tests', 'financials',
  'credit_reviews', 'opportunities', 'interactions', 'notices', 'policy', 'audit'];

cmd('export', 'Write every table to CSV (--out=exports/<date>)', async (db, pos, f) => {
  const dir = path.resolve(REPO_ROOT, typeof f.out === 'string' ? f.out : path.join('exports', isoDate(new Date())));
  mkdirSync(dir, { recursive: true });
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out = [];
  for (const t of EXPORT_TABLES) {
    const rows = await db.query(`select * from ${t}`);
    const cols = rows.length ? Object.keys(rows[0]) : (await db.query(`select column_name from information_schema.columns where table_name = $1 order by ordinal_position`, [t])).map((r) => r.column_name);
    writeFileSync(path.join(dir, `${t}.csv`), [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n');
    out.push({ table: t, rows: rows.length, file: path.relative(REPO_ROOT, path.join(dir, `${t}.csv`)) });
  }
  return out;
}, { flags: ['out'] });

export const commands = Object.keys(C);

// ---------------------------------------------------------------- output

function renderShow(r) {
  const c = r.client;
  const lines = [heading(`${c.code}  ${c.name}`),
    `  ${kindLabel(c.entity_type)}, ${c.industry || 'industry not set'}. Banker: ${c.banker || 'none'}. Group: ${c.group_name || 'none'}.`,
    `  Risk grade ${c.risk_grade ?? 'not set'}${c.watchlist ? ', ON WATCHLIST' : ''}. KYC ${c.kyc_risk} risk, last done ${c.kyc_reviewed_on ? isoDate(c.kyc_reviewed_on) : 'never'}. Balance month ${c.balance_month}.`];
  if (c.notes) lines.push(`  ${c.notes}`);
  const block = (title, rows, cols) => lines.push(`\n${title}`, table(rows, cols));
  block('Facilities', r.facilities, [{ key: 'code', label: 'facility' }, { key: 'kind', label: 'type', format: kindLabel }, { key: 'limit_cents', label: 'limit', align: 'right', format: (v) => money(v) },
    { key: 'drawn_cents', label: 'drawn', align: 'right', format: (v) => money(v) }, { key: 'repayment', label: 'repayment', format: kindLabel }, { key: 'maturity_on', label: 'matures' }, { key: 'status', label: 'status' }]);
  block('Covenants', r.covenants, [{ key: 'code', label: 'covenant' }, { key: 'metric', label: 'test', format: (v, x) => `${v} ${x.comparator}${x.threshold !== null ? ' ' + Number(x.threshold) : ''}` },
    { key: 'next_test_on', label: 'next test' }, { key: 'last_result', label: 'last' }]);
  block('Financial information', r.financials, [{ key: 'kind', label: 'what', format: kindLabel }, { key: 'due_on', label: 'due' }, { key: 'received_on', label: 'received', format: (v) => (v ? isoDate(v) : 'OUTSTANDING') }]);
  block('Credit reviews', r.reviews, [{ key: 'due_on', label: 'due' }, { key: 'completed_on', label: 'done' }, { key: 'outcome', label: 'outcome' },
    { key: 'grade_after', label: 'grade', format: (v, x) => (v ? `${x.grade_before} to ${v}` : '') }, { key: 'summary', label: 'summary', format: (v) => truncate(v, 50) }]);
  block('Pipeline', r.pipeline, [{ key: 'code', label: 'deal' }, { key: 'product', label: 'product' }, { key: 'stage', label: 'stage' }, { key: 'amount_cents', label: 'amount', align: 'right', format: (v) => money(v) }]);
  if (r.notices.length) block('Notices', r.notices, [{ key: 'code', label: 'notice' }, { key: 'kind', label: 'kind', format: kindLabel }, { key: 'issued_on', label: 'issued' }, { key: 'effective_on', label: 'effective' }, { key: 'status', label: 'status' }]);
  block('Recent contact', r.recent, [{ key: 'happened_on', label: 'date' }, { key: 'kind', label: 'kind' }, { key: 'summary', label: 'summary', format: (v) => truncate(v, 60) },
    { key: 'next_step', label: 'next step', format: (v, x) => (v ? `${truncate(v, 35)}${x.next_step_done ? ' (done)' : ` by ${x.next_step_on ? isoDate(x.next_step_on) : '?'}`}` : '') }]);
  block('Contacts', r.contacts, [{ key: 'name', label: 'name' }, { key: 'role', label: 'role' }, { key: 'email', label: 'email' }, { key: 'phone', label: 'phone' }, { key: 'guarantor', label: 'guarantor', format: (v) => (v ? 'yes' : '') }]);
  return lines.join('\n');
}

export function format(name, result, flags = {}) {
  const c = C[name];
  if (c.render) return c.render(result);
  const cols = (flags.detail && c.detailCols) || c.cols || (result[0] ? Object.keys(result[0]).filter((k) => typeof result[0][k] !== 'object' || result[0][k] === null).map((k) => ({ key: k, label: k })) : []);
  const dated = cols.map((col) => (col.format ? col : { ...col, format: (v) => (v instanceof Date ? isoDate(v) : v) }));
  return table(result, dated);
}

export async function run(db, argv) {
  const { pos, flags } = parseArgs(argv);
  const name = pos.shift();
  if (!name) throw new Error('Name a command. Try: help');
  const c = C[name];
  if (!c) throw new Error(`Unknown command "${name}". Try: help`);
  const allowed = new Set([...(c.flags || []), 'json', ...(c.write ? ['by'] : [])]);
  for (const k of Object.keys(flags)) if (!allowed.has(k)) throw new Error(`Unknown flag --${k} for ${name}`);
  return c.fn(db, pos, flags);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const argv = process.argv.slice(2);
  const { pos, flags } = parseArgs(argv);
  const db = await getDb();
  try {
    const result = await run(db, argv);
    if (flags.json) console.log(JSON.stringify(result, (k, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
    else console.log(format(pos[0], result, flags));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}
