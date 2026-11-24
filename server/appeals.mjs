// Appeals: a player contests a sanction (kick, ban, or strikes). At most 3 appeals per account, one open at a time.
// The player chooses HOW at filing time:
//   AI review     - answered in minutes (hard promise: 15 min; if the AI panel cannot decide it is escalated to a human)
//   Human review  - a moderator decides, typically within 1 to 7 days
// Every step is written to a timeline the player can follow. Guardrails: the AI can only overturn SOFT-evidence
// sanctions; hard evidence, manual (moderator) sanctions and anything inconclusive go to a human.
import { db, q, tx } from './db.mjs';
import { nowMs } from './catalog.mjs';
import { judge } from './ai.mjs';
import { recordEvent } from './players.mjs';

db.exec(`CREATE TABLE IF NOT EXISTS appeals (
  id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL, decision TEXT, message TEXT, case_json TEXT,
  created INTEGER NOT NULL, updated INTEGER NOT NULL, due INTEGER NOT NULL, decided INTEGER, result_json TEXT);
CREATE INDEX IF NOT EXISTS idx_appeals_pid ON appeals(pid, id);
CREATE TABLE IF NOT EXISTS appeal_events (id INTEGER PRIMARY KEY AUTOINCREMENT, appeal INTEGER NOT NULL, ts INTEGER NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_aev ON appeal_events(appeal, id);`);

export const MAX_APPEALS = 3;
export const AI_SLA_MS = Number(process.env.APPEAL_AI_SLA_MS) || 15 * 60e3;
export const HUMAN_SLA = { minDays: 1, maxDays: 7 };
const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);

const ins = db.prepare('INSERT INTO appeals (pid, type, status, message, case_json, created, updated, due) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const get = db.prepare('SELECT * FROM appeals WHERE id = ?');
const byPid = db.prepare('SELECT * FROM appeals WHERE pid = ? ORDER BY id DESC');
const countPid = db.prepare('SELECT COUNT(*) AS n FROM appeals WHERE pid = ?');
const openOf = db.prepare("SELECT id FROM appeals WHERE pid = ? AND status != 'decided' LIMIT 1");
const evOf = db.prepare('SELECT ts, kind, text FROM appeal_events WHERE appeal = ? ORDER BY id ASC');
const addEv = db.prepare('INSERT INTO appeal_events (appeal, ts, kind, text) VALUES (?, ?, ?, ?)');
const setStatus = db.prepare('UPDATE appeals SET status = ?, type = ?, updated = ?, due = ? WHERE id = ?');
const finish = db.prepare("UPDATE appeals SET status = 'decided', decision = ?, decided = ?, updated = ?, result_json = ? WHERE id = ?");
const queued = db.prepare("SELECT a.*, p.name AS pname FROM appeals a JOIN players p ON p.id = a.pid WHERE a.status = 'queued' ORDER BY a.created ASC LIMIT 100");
const event = (id, kind, text) => addEv.run(id, nowMs(), kind, text);

// ---- the case snapshot: what exactly is being contested, with the recorded evidence
export function caseOf(p) {
  const evs = q.events.all(p.id, 25).filter((e) => !/^(support|appeal)/.test(e.kind));
  const hardKinds = /^(run:|live:|duel:|race_final)/;
  return {
    banned: !!p.banned, banReason: p.ban_reason || null, kickedUntil: p.kicked_until > nowMs() ? p.kicked_until : 0, strikes: p.strikes,
    events: evs.slice(0, 12).map((e) => ({ kind: e.kind, severity: e.severity, at: e.ts, hard: hardKinds.test(e.kind) && e.severity >= 2 })),
    manual: !!p.banned && (/^Moderator/i.test(p.ban_reason || '') || evs.length === 0),
  };
}
export function eligibility(p) {
  const c = caseOf(p);
  if (!(c.banned || c.kickedUntil || p.strikes > 0)) return { ok: false, reason: 'no_sanction', message: 'There is nothing to contest on this account.' };
  if (countPid.get(p.id).n >= MAX_APPEALS) return { ok: false, reason: 'limit', message: `You have used your ${MAX_APPEALS} appeals.` };
  if (openOf.get(p.id)) return { ok: false, reason: 'already_open', message: 'You already have an appeal in progress.' };
  return { ok: true };
}

const view = (a) => ({
  id: a.id, type: a.type, status: a.status, decision: a.decision, created: a.created, updated: a.updated, decided: a.decided, due: a.due, message: a.message,
  sla: a.type === 'ai' ? 'AI review: under 15 minutes' : `Human review: ${HUMAN_SLA.minDays} to ${HUMAN_SLA.maxDays} days`, timeline: evOf.all(a.id),
});
export function list(pid) { const rows = byPid.all(pid); return { used: rows.length, limit: MAX_APPEALS, left: Math.max(0, MAX_APPEALS - rows.length), appeals: rows.map(view) }; }
export function detail(pid, id) { const a = get.get(Number(id)); return a && a.pid === pid ? view(a) : null; }

export function file(p, { type, message }) {
  if (!['ai', 'human'].includes(type)) return { ok: false, error: 'bad_type' };
  message = clip(message, 1000);
  if (message.length < 10) return { ok: false, error: 'message_too_short', message: 'Please explain what happened (10 characters minimum).' };
  const el = eligibility(p);
  if (!el.ok) return { ok: false, error: el.reason, message: el.message };
  const t = nowMs();
  const id = Number(ins.run(p.id, type, type === 'ai' ? 'reviewing' : 'queued', message, JSON.stringify(caseOf(p)), t, t, type === 'ai' ? t + AI_SLA_MS : t + HUMAN_SLA.maxDays * 86400e3).lastInsertRowid);
  event(id, 'submitted', `Appeal #${id} received (${type === 'ai' ? 'AI review' : 'human review'}).`);
  if (type === 'ai') { event(id, 'ai_started', 'The AI reviewers are examining the recorded evidence.'); setImmediate(() => runAi(id).catch((e) => escalate(id, 'The automatic review failed: ' + e.message))); setTimeout(() => { const a = get.get(id); if (a && a.status === 'reviewing') escalate(id, 'The AI review did not finish within 15 minutes.'); }, AI_SLA_MS).unref(); }
  else event(id, 'queued', `Waiting for a moderator (usually ${HUMAN_SLA.minDays} to ${HUMAN_SLA.maxDays} days).`);
  return { ok: true, appeal: view(get.get(id)) };
}

// ---- consequences
function applyDecision(a, decision, note) {
  const p = q.getPlayer.get(a.pid);
  const c = JSON.parse(a.case_json || '{}');
  const hard = (c.events || []).filter((e) => e.hard).length;
  tx(() => {
    if (decision === 'overturned') {
      const strikes = hard === 0 ? 0 : Math.max(0, p.strikes - 1); // soft-only: clean slate; one hard event: one strike off, the record stays
      db.prepare('UPDATE players SET banned = 0, ban_reason = NULL, kicked_until = 0, strikes = ?, tokver = tokver WHERE id = ?').run(strikes, p.id);
    }
    finish.run(decision, nowMs(), nowMs(), JSON.stringify({ note: clip(note, 300), hard }), a.id);
    event(a.id, 'decided', decision === 'overturned' ? 'Decision: the sanction was overturned. Your access is restored.' : 'Decision: the sanction stands.');
  });
  recordEvent(a.pid, 'appeal_' + decision, clip(note, 200), 0);
}
function escalate(id, why) {
  const a = get.get(id);
  if (!a || a.status === 'decided') return;
  setStatus.run('queued', 'human', nowMs(), nowMs() + HUMAN_SLA.maxDays * 86400e3, id);
  event(id, 'escalated', `${why} It was passed to a human moderator (${HUMAN_SLA.minDays} to ${HUMAN_SLA.maxDays} days).`);
}

// ---- AI review
async function runAi(id) {
  const a = get.get(id), c = JSON.parse(a.case_json);
  const p = q.getPlayer.get(a.pid);
  if (c.manual) return escalate(id, 'This sanction was placed or confirmed by a moderator, so only a human can review it.');
  const hard = c.events.filter((e) => e.hard);
  event(id, 'rules', `${c.events.length} event(s) on record: ${hard.length} impossible-value (hard), ${c.events.length - hard.length} statistical (soft).`);
  if (hard.length >= 2) { // overwhelming recorded physics: no tokens needed
    applyDecision(a, 'upheld', 'Several impossible values were recorded (e.g. movement or speed beyond the game limits).');
    return;
  }
  const ev = {
    kind: 'appeal', statement: clip(a.message, 400),
    flags: c.events.map((e) => ({ flag: `${e.kind}(sev${e.severity})`, hard: e.hard })),
    account: { ageDays: Math.floor((nowMs() - p.created) / 86400e3), games: p.games, strikes: p.strikes, banned: c.banned, kick: !!c.kickedUntil },
  };
  const v = await judge(ev, { pid: a.pid, onProgress: (x) => event(id, 'ai_round', x.note || `Reviewer opinions in: ${x.opinions}.`) });
  event(id, 'ai_done', `AI panel: ${v.source === 'panel' ? 'two independent reviewers' : v.source === 'single' ? 'one reviewer' : 'rule engine'}, ${v.rounds || 0} round(s).`);
  const note = `${v.verdict}/${v.confidence}: ${(v.reasons || []).join(' ')}`;
  if (v.source === 'rules' && !(v.verdict === 'legit' && c.events.length)) return escalate(id, 'The AI reviewers were unavailable.'); // never overturn on rules alone when the record is not empty
  if (v.verdict === 'insufficient_evidence' || v.recommended_action === 'escalate_human') return escalate(id, 'The evidence is not conclusive.');
  if (v.verdict === 'legit' && hard.length === 0) return applyDecision(a, 'overturned', note);
  if (v.verdict === 'legit' && hard.length === 1 && v.confidence === 'high') return applyDecision(a, 'overturned', note);
  if (v.verdict === 'legit') return escalate(id, 'A hard event is on record, so a human must confirm.');
  return applyDecision(a, 'upheld', note);
}

// ---- moderators
export const queue = () => queued.all().map((a) => ({ id: a.id, pid: a.pid, player: a.pname, type: a.type, created: a.created, due: a.due, message: a.message, case: JSON.parse(a.case_json || '{}') }));
export function humanDecide(id, decision, note) {
  const a = get.get(Number(id));
  if (!a) return { ok: false, error: 'not_found' };
  if (a.status === 'decided') return { ok: false, error: 'already_decided' };
  if (!['overturned', 'upheld'].includes(decision)) return { ok: false, error: 'bad_decision' };
  event(a.id, 'human_review', 'A moderator reviewed your case.');
  applyDecision(a, decision, note || 'Moderator decision');
  return { ok: true };
}
