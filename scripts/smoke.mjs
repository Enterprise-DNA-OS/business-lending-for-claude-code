#!/usr/bin/env node
// npm test: a temporary database, migrate, seed twice, then every command, every write rule and the import.
// Set TEST_DATABASE_URL to run the same checks against an empty, disposable Postgres.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const temp = mkdtempSync(path.join(os.tmpdir(), 'business-lending-'));
process.env.DATA_DIR = path.join(temp, 'db');
process.env.OUTPUT_DIR = temp;
// Blank on purpose: stops .env or .env.local loading a live connection into the test.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';

const { getDb, REPO_ROOT } = await import('./lib/db.mjs');
const { migrate } = await import('./migrate.mjs');
const { seed } = await import('./seed.mjs');
const { run, commands, format, cents, complianceChecks } = await import('./lending.mjs');

let checks = 0;
const seen = new Set();
const ok = (v, m) => { assert.ok(v, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const rejects = async (fn, re) => { await assert.rejects(fn, re); checks++; };
const BY = { by: 'Test Banker' };
const argv = (c, pos, flags) => [c, ...pos, ...Object.entries(flags).map(([k, v]) => (v === true ? `--${k}` : `--${k}=${v}`))];
let db;
const call = async (c, pos = [], flags = {}) => { seen.add(c); const out = await run(db, argv(c, pos, flags)); format(c, out, flags); return out; };
const write = (c, pos = [], flags = {}) => call(c, pos, { ...BY, ...flags });
const child = (args) => {
  const r = spawnSync(process.execPath, args, { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  eq(r.status, 0, r.stderr || r.stdout);
  return r.stdout;
};

try {
  db = await getDb();
  eq(db.mode, process.env.TEST_DATABASE_URL ? 'postgres' : 'pglite', 'tests never use an operational connection');
  if (process.env.TEST_DATABASE_URL) {
    const tables = await db.query("select tablename from pg_tables where schemaname = 'public'");
    if (tables.length) throw new Error('TEST_DATABASE_URL must point at an empty, disposable database');
  }

  // Migrate is repeatable; seed is idempotent.
  eq((await migrate(db)).ran.length, readdirSync(path.join(REPO_ROOT, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql')).length);
  eq((await migrate(db)).ran.length, 0);
  await seed(db);
  const count = async (t) => (await db.query(`select count(*)::int as n from ${t}`))[0].n;
  const before = await count('facilities');
  await seed(db);
  eq(await count('facilities'), before, 'seed runs once');
  eq(await count('clients'), 10);

  // Input parsing.
  eq(cents('1.2m'), 120000000); eq(cents('250k'), 25000000); eq(cents('$80,000.50'), 8000050);
  await rejects(() => call('nonsense'), /Unknown command/);
  await rejects(() => call('groups', [], { banana: 1 }), /Unknown flag/);

  // Reads, each with something to say on the demo book.
  eq((await call('help')).length, commands.length);
  for (const c of ['clients', 'groups', 'facilities', 'headroom', 'maturities', 'reviews', 'covenants', 'breaches', 'financials', 'kyc', 'quiet', 'pipeline', 'book', 'concentration', 'grade-drift', 'attention'])
    ok((await call(c)).length > 0, `${c} has demo rows`);

  const groups = await call('groups');
  eq(groups[0].group_code, 'GRP-01', 'the Kereru group is the largest connected exposure');
  eq(Number(groups[0].limit_cents), 455000000);
  eq((await call('clients', [], { banker: 'hana', watch: true })).map((r) => r.code), ['CL-09']);
  eq((await call('clients', [], { all: true })).length, 10);
  eq((await call('headroom')).map((r) => r.code), ['FAC-201', 'FAC-302', 'FAC-401']);
  eq((await call('quiet')).map((r) => r.code), ['CL-05']);
  eq((await call('kyc')).map((r) => r.code), ['CL-01', 'CL-07']);
  eq((await call('grade-drift')).map((r) => r.code), ['CL-09']);
  eq((await call('pipeline')).length, 4); eq((await call('pipeline', [], { all: true })).length, 5);
  const reviews = await call('reviews');
  eq(reviews[0].code, 'CL-03'); ok(reviews.some((r) => r.code === 'CL-07' && /none scheduled/.test(r.note)), 'unscheduled review listed');
  const mat = await call('maturities');
  eq(mat.find((m) => m.code === 'FAC-901').notice_issued, true);

  const attention = await call('attention');
  for (const issue of ['review overdue', 'review not scheduled', 'notice deadline', 'covenant breach', 'covenant test', 'financials late', 'kyc refresh', 'quiet client', 'follow-up overdue', 'review due'])
    ok(attention.some((a) => a.issue === issue), `attention shows ${issue}`);
  ok((await call('attention', [], { banker: 'Tom' })).every((a) => a.banker === 'Tom Fraser'));

  // Compliance: the demo book has one of each problem.
  const comp = await call('compliance');
  const rule = (re) => comp.find((r) => re.test(r.rule));
  eq(rule(/Non-extension/).breaches, 1); eq(rule(/Non-extension/).due, 1);
  eq(rule(/Default notice/).breaches, 1);
  eq(rule(/Financial covenants only/).items.map((i) => i.ref), ['COV-301']);
  eq(rule(/due diligence/).breaches, 2);
  eq(rule(/payment default/).status, 'clean');
  ok((await call('compliance', [], { detail: true })).length >= 10);

  // Client lookup: code, name fragment, ambiguity.
  eq((await call('show', ['ashby', 'eng'])).client.code, 'CL-03');
  eq((await call('show', ['cl-08'])).facilities.length, 1);
  await rejects(() => call('show', ['kereru']), /Ambiguous client "kereru": CL-01.*CL-02/);
  await rejects(() => call('show', ['nobody']), /No client matches/);

  // Writes need a name for the audit log.
  await rejects(() => call('log', ['CL-05'], { summary: 'x' }), /--by/);
  await write('log', ['CL-05'], { summary: 'Rang about the fleet insurance certificate', next: 'Certificate by Friday', 'next-on': '+3d' });
  ok(!(await call('quiet')).some((r) => r.code === 'CL-05'), 'logging contact clears quiet');
  await write('done-step', ['CL-03'], { step: 'Lane' });
  ok(!(await call('attention')).some((a) => a.issue === 'follow-up overdue' && a.client_code === 'CL-03'));

  // Covenant tests roll the next date and judge the result.
  let t = await write('test', ['COV-602'], { value: 104, note: 'Two units resold' });
  eq(t[0].result, 'pass');
  t = await write('test', ['COV-301'], { value: 1.6 });
  eq(t[0].result, 'breach');
  await rejects(() => write('test', ['COV-301'], { value: 2.5, waive: true, note: 'x' }), /Only a breach/);
  await rejects(() => write('test', ['COV-302'], {}), /--delivered or --missed/);
  eq((await write('test', ['COV-302'], { delivered: true }))[0].result, 'pass');
  eq((await write('test', ['COV-603'], { missed: true, waive: true, note: 'QS on leave, report next week' }))[0].result, 'waived');
  ok((await call('breaches')).some((b) => b.code === 'COV-301' && Number(b.value) === 1.6));

  // Financials and KYC.
  await write('receive', ['CL-03'], { kind: 'annual_accounts' });
  ok(!(await call('financials')).some((f) => f.client_code === 'CL-03'));
  await rejects(() => write('receive', ['CL-03'], { kind: 'annual_accounts' }), /Nothing outstanding/);
  await write('request', ['CL-03'], { kind: 'management_accounts', due: '+14d' });
  await write('kyc-done', ['Kereru Dairy'], { risk: 'low' });
  eq((await call('kyc')).map((r) => r.code), ['CL-07']);

  // Credit reviews: close, re-grade, roll forward.
  await rejects(() => write('complete-review', ['CL-07'], { outcome: 'renew', grade: 5, 'approved-by': 'Priya Nair', summary: 'x' }), /No open review/);
  await write('schedule-review', ['CL-07'], { due: '+10d' });
  await rejects(() => write('schedule-review', ['CL-07'], { due: '+20d' }), /already open/);
  const done = await write('complete-review', ['CL-03'], { outcome: 'watch', grade: 7, 'approved-by': 'Priya Nair', summary: 'Accounts in. Interest cover below 2.' });
  ok(done[0].next_review, 'next review scheduled');
  eq((await call('grade-drift'))[0].code, 'CL-03');

  // Notices are checked against the Code before they go out.
  await rejects(() => write('issue-notice', ['NTC-02']), /needs 30/);
  await rejects(() => write('issue-notice', ['NTC-02'], { override: true }), /--reason/);
  await db.query("update notices set effective_on = current_date + 30 where code = 'NTC-02'");
  eq((await write('issue-notice', ['NTC-02']))[0].status, 'issued');
  await write('notice', ['CL-02'], { kind: 'non_extension', code: 'NTC-03', facility: 'FAC-201', effective: '+80d', grounds: 'Trust to refinance elsewhere' });
  eq((await db.query("select extension_decision from facilities where code = 'FAC-201'"))[0].extension_decision, 'not_extend');
  await write('amend', ['FAC-102'], { decision: 'extend', reason: 'Seasonal line renewed at credit' });
  const after = (await complianceChecks(db)).find((r) => /Non-extension/.test(r.rule));
  eq(after.due, 0, 'deciding to extend clears the due item');
  eq(after.status, 'breach', 'FAC-201 is still late: the notice could not go out in time');

  // Facilities, covenants, deals.
  await write('add-client', [], { code: 'CL-11', name: 'Kaka Brewing Co Ltd', banker: 'RM-02', industry: 'Brewing', grade: 5 });
  await write('add-facility', [], { client: 'Kaka', code: 'FAC-1101', kind: 'construction', limit: '1.2m', maturity: '+400d', repayment: 'balloon' });
  eq((await db.query("select specialised from facilities where code = 'FAC-1101'"))[0].specialised, true, 'construction loans are specialised');
  await write('add-covenant', [], { facility: 'FAC-1101', code: 'COV-1101', kind: 'financial', metric: 'Loan to cost %', comparator: '<=', threshold: 75, next: '+90d' });
  await rejects(() => write('add-covenant', [], { facility: 'FAC-1101', code: 'COV-1102', kind: 'financial', metric: 'x', comparator: '>', threshold: 1, next: '+90d' }), /comparator/);
  await rejects(() => write('add-facility', [], { client: 'Kaka', code: 'FAC-1102', kind: 'spaceship', limit: '1m' }), /--kind must be one of/);
  await rejects(() => write('add-facility', [], { client: 'Kaka', code: 'FAC-1102', kind: 'overdraft', limit: 'lots' }), /Invalid --limit/);
  await rejects(() => write('add-facility', [], { client: 'Kaka', code: 'FAC-1102', kind: 'overdraft', limit: '1m', maturity: '2027-02-30' }), /Invalid --maturity/);
  await write('opportunity', ['Kaka'], { code: 'OPP-06', kind: 'new_facility', product: 'Canning line', amount: '400k', stage: 'discovery' });
  await rejects(() => write('move', ['OPP-06'], { stage: 'lost' }), /--reason/);
  await write('move', ['OPP-06'], { stage: 'application' });
  eq((await db.query("select stage from opportunities where code = 'OPP-06'"))[0].stage, 'application');
  ok((await call('history', ['CL-03'])).some((h) => h.what === 'complete-review'), 'history reads the audit log');

  // Import from Salesforce Financial Services Cloud exports.
  const fx = (f) => path.join(REPO_ROOT, 'test', 'fixtures', f);
  const dry = await write('import', ['salesforce'], { accounts: fx('fsc-accounts.csv'), facilities: fx('fsc-financial-accounts.csv'), 'dry-run': true });
  eq(dry[0].clients_new, 3); eq(await count('clients'), 11, 'dry run saves nothing');
  const imp = await write('import', ['salesforce'], { accounts: fx('fsc-accounts.csv'), facilities: fx('fsc-financial-accounts.csv') });
  eq([imp[0].clients_new, imp[0].bankers_new, imp[0].facilities_new, imp[0].skipped], [3, 1, 3, 1]);
  const again = await write('import', ['salesforce'], { accounts: fx('fsc-accounts.csv'), facilities: fx('fsc-financial-accounts.csv') });
  eq([again[0].clients_new, again[0].clients_matched, again[0].facilities_new, again[0].facilities_matched], [0, 3, 0, 3], 'import is repeatable');
  const tui = (await db.query("select f.kind, f.limit_cents, f.drawn_cents, f.maturity_on, b.name as banker from facilities f join clients c on c.id = f.client_id left join bankers b on b.id = c.banker_id where f.code = 'TUI-0001'"))[0];
  eq([tui.kind, Number(tui.limit_cents), Number(tui.drawn_cents), String(tui.maturity_on).slice(0, 10), tui.banker], ['property_investment', 125000000, 118000050, '2027-06-30', 'Hana Walker']);
  eq((await db.query("select status, kind from facilities where code = 'KAHU-0002'"))[0], { status: 'closed', kind: 'equipment_finance' });
  eq((await db.query("select notes from clients where name = 'Weka Joinery Ltd'"))[0].notes, 'Joinery, "custom kitchens" and stairs');
  await rejects(() => write('import', ['xero'], { accounts: fx('fsc-accounts.csv') }), /Usage: import salesforce/);

  // Export every table.
  const exp = await call('export', [], { out: path.relative(REPO_ROOT, path.join(temp, 'export')) });
  ok(exp.length >= 14);
  ok(readFileSync(path.join(temp, 'export', 'facilities.csv'), 'utf8').includes('TUI-0001'));

  for (const c of commands) ok(seen.has(c), `smoke covers ${c}`);
  await db.close();
  db = null;

  // The documents, views and CLI run as their own processes.
  ok(child(['scripts/lending.mjs', 'attention']).includes('notice deadline'), 'CLI runs as a process');
  const docsOut = child(['scripts/docs.mjs']);
  ok(/document\(s\) rendered/.test(docsOut) && !/^0 document/m.test(docsOut), 'documents render');
  ok(child(['scripts/view.mjs']).includes('view:'), 'views render');
  const bad = spawnSync(process.execPath, ['scripts/lending.mjs', 'show', 'kereru'], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  eq(bad.status, 1); ok(/Ambiguous/.test(bad.stderr));
  console.log(`PASS  ${checks} checks, ${commands.length} CLI commands (${process.env.TEST_DATABASE_URL ? 'postgres' : 'pglite'})`);
} finally {
  if (db) await db.close();
  rmSync(temp, { recursive: true, force: true });
}
