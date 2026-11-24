// Support center: tickets + chat with the AI assistant, escalation to humans, admin actions (ADMIN_KEY).
import { q, tx } from './db.mjs';
import { nowMs } from './catalog.mjs';
import { profile } from './players.mjs';
import { supportReply } from './ai.mjs';
import { invOf } from './economy.mjs';

const CATS = new Set(['account', 'purchase', 'ranking', 'bug', 'fairplay_appeal', 'event', 'gameplay', 'feedback', 'safety', 'other']);
const msgRate = new Map(); // pid -> [timestamps]

function limited(pid) {
  const t = nowMs();
  const arr = (msgRate.get(pid) || []).filter((x) => t - x < 60000);
  arr.push(t); msgRate.set(pid, arr);
  return arr.length > 8;
}
const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);

function ctxFor(p) {
  return {
    strikes: p.strikes, wallet: p.wallet,
    purchases: q.recentPurchases.all(p.id, 6).map((r) => ({ item: r.item, price: r.price, at: new Date(r.ts).toISOString().slice(0, 10) })),
    runs: q.recentRuns.all(p.id, 5).map((r) => ({ mode: r.mode, score: r.score, dist: r.dist, flagged: !!r.flagged })),
    flagged: q.flaggedRuns.all(p.id, 3).map((r) => ({ mode: r.mode, score: r.score, flags: r.flags })),
    openTickets: q.openTicketCount.get(p.id).n,
    inventory: { boards: invOf(p).boards },
  };
}

export function listTickets(p) {
  return q.ticketsOf.all(p.id).map((t) => ({ id: t.id, subject: t.subject, category: t.category, status: t.status, updated: t.updated }));
}
export function getTicket(p, id) {
  const t = q.getTicketRow.get(Number(id));
  if (!t || t.pid !== p.id) return null;
  return { id: t.id, subject: t.subject, category: t.category, status: t.status, created: t.created, updated: t.updated, messages: q.msgsOf.all(t.id) };
}

async function respond(p, t, history) {
  const prof = profile(p, false);
  const r = await supportReply({ player: prof, ctx: ctxFor(p), history });
  const cat = CATS.has(r.category) ? r.category : 'other';
  const escalate = r.needs_human || r.suggested_action !== 'none';
  q.addMsg.run(t.id, 'ai', r.reply, nowMs());
  const status = escalate ? 'escalated' : t.status === 'escalated' ? 'escalated' : 'answered';
  q.setTicket.run(status, cat, clip(`${r.summary} [action: ${r.suggested_action}]`, 400), nowMs(), t.id);
  return { reply: r.reply, source: r.source, category: cat, status, suggested_action: r.suggested_action };
}

export async function openTicket(p, { subject, message, category }) {
  subject = clip(subject, 80) || 'Support request';
  message = clip(message, 1200);
  if (message.length < 3) return { ok: false, error: 'empty_message' };
  if (q.openTicketCount.get(p.id).n >= 5) return { ok: false, error: 'too_many_open_tickets' };
  if (limited(p.id)) return { ok: false, error: 'rate_limited' };
  const id = Number(q.newTicketRow.run(p.id, subject, CATS.has(category) ? category : 'other', 'open', nowMs(), nowMs()).lastInsertRowid);
  q.addMsg.run(id, 'user', message, nowMs());
  const t = q.getTicketRow.get(id);
  const res = await respond(p, t, [{ role: 'user', text: message }]);
  return { ok: true, id, ...res, ticket: getTicket(p, id) };
}

export async function sendMessage(p, id, text) {
  const t = q.getTicketRow.get(Number(id));
  if (!t || t.pid !== p.id) return { ok: false, error: 'not_found' };
  if (t.status === 'closed') return { ok: false, error: 'ticket_closed' };
  text = clip(text, 1200);
  if (text.length < 1) return { ok: false, error: 'empty_message' };
  if (limited(p.id)) return { ok: false, error: 'rate_limited' };
  q.addMsg.run(t.id, 'user', text, nowMs());
  const history = q.msgsOf.all(t.id).filter((m) => m.role === 'user' || m.role === 'ai').map((m) => ({ role: m.role, text: m.text }));
  const res = await respond(p, t, history);
  return { ok: true, ...res, ticket: getTicket(p, t.id) };
}

export function closeTicket(p, id) {
  const t = q.getTicketRow.get(Number(id));
  if (!t || t.pid !== p.id) return { ok: false, error: 'not_found' };
  q.setTicket.run('closed', t.category, t.ai_summary, nowMs(), t.id);
  return { ok: true };
}
export function escalateTicket(p, id) {
  const t = q.getTicketRow.get(Number(id));
  if (!t || t.pid !== p.id) return { ok: false, error: 'not_found' };
  q.setTicket.run('escalated', t.category, t.ai_summary, nowMs(), t.id);
  q.addMsg.run(t.id, 'ai', 'Done - I\'ve flagged this conversation for the human team.', nowMs());
  return { ok: true };
}

// ---- admin (human moderators). Protected by ADMIN_KEY; disabled when the variable is not set.
export const adminOk = (req) => !!process.env.ADMIN_KEY && req.headers['x-admin-key'] === process.env.ADMIN_KEY;
export function adminQueue() {
  return q.escalated.all().map((t) => ({ id: t.id, pid: t.pid, player: t.pname, subject: t.subject, category: t.category, summary: t.ai_summary, updated: t.updated }));
}
export function adminReply(id, text, resolve) {
  const t = q.getTicketRow.get(Number(id));
  if (!t) return { ok: false, error: 'not_found' };
  tx(() => {
    q.addMsg.run(t.id, 'staff', clip(text, 1500), nowMs());
    q.setTicket.run(resolve ? 'closed' : 'answered', t.category, t.ai_summary, nowMs(), t.id);
  });
  return { ok: true };
}
