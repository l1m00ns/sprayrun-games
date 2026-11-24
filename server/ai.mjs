// Backend AI panel: TWO independent reviewers (OpenRouter + Token Harbor, free models) that decide, cross-review each
// other over several rounds, and only spend tokens when the case needs it. No Claude / Anthropic API.
//
//  seat A = OpenRouter   (default chain: nemotron-3-ultra-550b -> nemotron-3.5-super -> openrouter/free)
//  seat B = Token Harbor (default chain: deepseek-v4.1-flash -> mimo-v2.6-flash)
//
// Judge pipeline (fair-play):
//  tier 0  rules only, ZERO tokens: clean events, and overwhelming hard evidence
//  round 1 both seats judge independently, in parallel (compact evidence, ~400 tokens each)
//  round 2 only on disagreement / low confidence: each seat re-analyses against the other's opinion (cross-review)
//  round 3 only if still split: a third distinct model arbitrates, majority wins; otherwise the conservative choice
//  guardrails: the AI can never ban or pay; "kick" needs hard evidence; every outcome is stored with the votes
// Support pipeline: seat A drafts, seat B reviews the draft ONLY for sensitive topics / risky wording, then a
// deterministic output guard runs. Everything falls back to rules when a provider is down, rate-limited or over budget.
//
// Honest note: models are not fine-tuned here. Behaviour comes from strict system prompts (prompts.mjs), schema
// validation of every answer, DB-built context, cross-review, and server rules that bound what an answer can cause.
// Free tiers are rate-limited and rotate models: that is why every call has fallbacks, cooldowns and a budget.
import './env.mjs';
import crypto from 'node:crypto';
import {
  SUPPORT_SYSTEM, SUPPORT_REVIEW_SYSTEM, JUDGE_SYSTEM, JUDGE_CHALLENGE_SYSTEM, JUDGE_ARBITER_SYSTEM, GAME_FACTS,
  checkJudge, checkSupport, checkReview,
} from './prompts.mjs';

const list = (v, d) => String(v || d).split(',').map((s) => s.trim()).filter(Boolean);
const PROVIDERS = {
  openrouter: {
    label: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions', key: () => process.env.OPENROUTER_API_KEY,
    models: () => list(process.env.OPENROUTER_MODELS, 'nvidia/nemotron-3-ultra-550b-a55b:free,nvidia/nemotron-3.5-super-vl:free,openrouter/free'),
    extra: { reasoning: { enabled: false } }, headers: { 'X-Title': 'Reverse Surfers' }, perMin: 16, maxTokens: 420, // reasoning off: measured ~120 output tokens instead of ~900
  },
  tokenharbor: {
    label: 'Token Harbor', url: 'https://tokenharbor.ai/v1/chat/completions', key: () => process.env.TOKENHARBOR_API_KEY,
    models: () => list(process.env.TOKENHARBOR_MODELS, 'deepseek-v4.1-flash:free,mimo-v2.6-flash:free'),
    extra: { thinking: { type: 'disabled' } }, headers: {}, perMin: 50, maxTokens: 420,
  },
};
const DAILY_TOKEN_BUDGET = Number(process.env.AI_DAILY_TOKEN_BUDGET) || 600000;
const now = () => Date.now();
const dbg = (...a) => { if (process.env.AI_DEBUG) console.log('[ai]', ...a); };

// ------------------------------------------------------------------------------------------ health
const health = {};
for (const id of Object.keys(PROVIDERS)) health[id] = { disabledUntil: 0, lastError: null, calls: 0, ok: 0, tokens: 0, window: [], models: {} };
const day = { key: '', tokens: 0 };
const rollDay = () => { const k = new Date().toISOString().slice(0, 10); if (day.key !== k) { day.key = k; day.tokens = 0; } };
const modelState = (pid, m) => (health[pid].models[m] ||= { until: 0, fails: 0, calls: 0 });
const underRate = (pid) => { const h = health[pid], t = now(); h.window = h.window.filter((x) => t - x < 60000); return h.window.length < PROVIDERS[pid].perMin; };
const providerUp = (pid) => !process.env.AI_DISABLED && !!PROVIDERS[pid].key() && now() >= health[pid].disabledUntil && underRate(pid);
const modelsUp = (pid) => PROVIDERS[pid].models().filter((m) => now() >= modelState(pid, m).until);

export function aiStatus() {
  rollDay();
  const prov = {};
  for (const [id, p] of Object.entries(PROVIDERS)) {
    const h = health[id];
    prov[id] = { label: p.label, configured: !!p.key(), available: providerUp(id) && modelsUp(id).length > 0, models: p.models(), cooling: p.models().filter((m) => now() < modelState(id, m).until), calls: h.calls, ok: h.ok, tokens: h.tokens, lastError: h.lastError };
  }
  const live = Object.values(prov).filter((p) => p.available).length;
  return { providers: prov, seats: live, live: live > 0, panel: live >= 2 ? 'two providers' : live === 1 ? 'one provider (two models)' : 'rules only', tokensToday: day.tokens, dailyBudget: DAILY_TOKEN_BUDGET };
}

// -------------------------------------------------------------------------------------- one model call
let inflight = 0;
const waiters = [];
const slot = () => new Promise((res) => { const go = () => { inflight++; res(); }; if (inflight < 4) go(); else waiters.push(go); });
const release = () => { inflight--; const n = waiters.shift(); if (n) n(); };

function extractJson(text) {
  let t = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

// Try one provider's models in order. `avoid` = model ids already used by the other seat (keeps opinions independent).
async function callProvider(pid, system, user, check, { avoid = [], maxTokens } = {}) {
  const P = PROVIDERS[pid], h = health[pid];
  rollDay();
  if (day.tokens > DAILY_TOKEN_BUDGET || !providerUp(pid)) return null;
  const norm = (m) => String(m).replace(/:free$/, '');
  const av = avoid.map(norm);
  const order = [...modelsUp(pid).filter((m) => !av.includes(norm(m))), ...modelsUp(pid).filter((m) => av.includes(norm(m)))];
  for (const model of order.slice(0, 3)) {
    const ms = modelState(pid, model);
    h.window.push(now()); h.calls++; ms.calls++;
    await slot();
    const t0 = Date.now();
    try {
      const r = await fetch(P.url, {
        method: 'POST', headers: { Authorization: `Bearer ${P.key()}`, 'Content-Type': 'application/json', ...P.headers },
        body: JSON.stringify({ model, temperature: 0, max_tokens: maxTokens || P.maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], ...P.extra }),
        signal: AbortSignal.timeout(45000),
      });
      const j = await r.json().catch(() => ({}));
      dbg(pid, model, 'HTTP', r.status, `${Date.now() - t0}ms`);
      if (r.status === 401 || r.status === 403) { h.lastError = `auth_${r.status}`; h.disabledUntil = now() + 30 * 60 * 1000; return null; } // bad key: stop hammering
      if (r.status === 429 || r.status === 402) { const ra = Number(r.headers.get('retry-after')) || 60; ms.until = now() + Math.min(ra, 900) * 1000; h.lastError = `rate_${r.status}`; continue; }
      if (!r.ok) { ms.until = now() + 30000; h.lastError = `http_${r.status}`; continue; }
      const used = (j.usage && j.usage.total_tokens) || 0;
      h.tokens += used; day.tokens += used;
      const msg = j.choices && j.choices[0] && j.choices[0].message;
      const obj = check(extractJson(msg && msg.content));
      if (!obj) { dbg(pid, model, 'BAD OUTPUT:', String(JSON.stringify(msg && msg.content)).slice(0, 160), 'finish=', j.choices && j.choices[0] && j.choices[0].finish_reason, 'tokens', used); ms.fails++; h.lastError = 'bad_output'; if (ms.fails >= 4) { ms.until = now() + 120000; ms.fails = 0; } continue; }
      ms.fails = 0; h.ok++; h.lastError = null;
      return { obj, model: (j.model || model).replace(/:free$/, ''), provider: pid, tokens: used };
    } catch (e) {
      dbg(pid, model, 'EXC', e.name, e.message); ms.until = now() + 30000; h.lastError = e.name === 'TimeoutError' ? 'timeout' : 'network';
    } finally { release(); }
  }
  return null;
}

// Two seats. If one provider is down, the other provider supplies BOTH opinions with two different models.
async function pairCall(system, userA, userB, check, opts = {}) {
  const [a, b] = await Promise.all([
    callProvider('openrouter', system, userA, check, opts),
    callProvider('tokenharbor', system, userB ?? userA, check, opts),
  ]);
  const out = [a, b].filter(Boolean);
  if (out.length === 2 || out.length === 0) return out;
  // degraded: the surviving provider answers a second time with a DIFFERENT model for diversity
  const pid = out[0].provider;
  const second = await callProvider(pid, system, pid === 'openrouter' ? (userB ?? userA) : userA, check, { ...opts, avoid: [out[0].model, `${out[0].model}:free`] });
  return second && second.model !== out[0].model ? [out[0], second] : out;
}

// ------------------------------------------------------------------------------------------- judge
const SEV_V = { legit: 0, insufficient_evidence: 1, suspicious: 2, cheating: 3 };
const SEV_A = { none: 0, monitor: 1, flag_run: 2, escalate_human: 2, strike: 3, kick: 4 };
const cache = new Map(); // fingerprint -> { at, result }
const recentByPlayer = new Map(); // pid -> { at, result }
setInterval(() => { const t = now(); for (const [k, v] of cache) if (t - v.at > 6 * 3600 * 1000) cache.delete(k); for (const [k, v] of recentByPlayer) if (t - v.at > 10 * 60 * 1000) recentByPlayer.delete(k); }, 600000).unref();

// Short, number-first evidence text: fewer tokens than pretty JSON.
const compact = (ev) => {
  const f = (ev.flags || []).map((x) => (x.hard ? '!' : '') + x.flag).join(',') || 'none';
  const kv = (o) => Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && typeof v !== 'object').map(([k, v]) => `${k}=${typeof v === 'number' ? Math.round(v * 100) / 100 : String(v).slice(0, 40)}`).join(' ');
  return `kind=${ev.kind} flags(!=hard)=${f}\n${ev.run ? 'run: ' + kv(ev.run) + ' ' + (ev.run.stats ? 'stats: ' + kv(ev.run.stats) : '') + ' ' + (ev.run.input ? 'input: ' + kv(ev.run.input) : '') : ''}${ev.duel ? 'duel: ' + kv(ev.duel) : ''}\naccount: ${kv(ev.account)}${ev.ceiling ? '\nphysical: ' + kv(ev.ceiling) : ''}`;
};
const fmtOpinion = (r) => `${r.model}: verdict=${r.obj.verdict} confidence=${r.obj.confidence} action=${r.obj.recommended_action} because ${r.obj.reasons.join(' ')}`;
const agree = (a, b) => a.verdict === b.verdict && (a.confidence !== 'low' || b.confidence !== 'low' || a.recommended_action === b.recommended_action);

// Deterministic rules: used as tier 0, as the fallback, and as the guardrail on what the AI may cause.
export function ruleJudge(ev) {
  const hard = (ev.flags || []).filter((f) => f.hard).length, soft = (ev.flags || []).length - hard;
  if (hard >= 2) return { verdict: 'cheating', confidence: 'high', reasons: [`${hard} physically impossible values in one event.`], recommended_action: 'kick', summary: `${hard} hard rule violations`, hard, soft };
  if (hard === 1) return { verdict: 'cheating', confidence: 'medium', reasons: ['A physically impossible value was reported.'], recommended_action: 'strike', summary: 'One hard rule violation', hard, soft };
  if (soft >= 3) return { verdict: 'suspicious', confidence: 'medium', reasons: ['Several independent statistical anomalies.'], recommended_action: 'flag_run', summary: `${soft} soft anomalies`, hard, soft };
  if (soft >= 1) return { verdict: 'suspicious', confidence: 'low', reasons: ['A single statistical anomaly, possible with skilled or throttled play.'], recommended_action: 'monitor', summary: 'One soft anomaly', hard, soft };
  return { verdict: 'legit', confidence: 'medium', reasons: ['No anomaly.'], recommended_action: 'none', summary: 'Clean', hard, soft };
}
// The AI may soften or confirm what the rules found, never exceed it: kick needs hard evidence, "cheating" needs hard evidence or two agreeing high-confidence opinions.
function guard(res, det, unanimousHigh) {
  const r = { ...res };
  if (det.hard === 0) {
    if (r.recommended_action === 'kick') r.recommended_action = 'strike';
    if (r.verdict === 'cheating' && !unanimousHigh) { r.verdict = 'suspicious'; r.recommended_action = SEV_A[r.recommended_action] > 2 ? 'flag_run' : r.recommended_action; }
    if (r.recommended_action === 'strike' && !unanimousHigh) r.recommended_action = 'flag_run';
  }
  return r;
}

export async function judge(ev, { pid } = {}) {
  const det = ruleJudge(ev);
  const base = (x, extra) => ({ ...x, ...extra });
  if (!(ev.flags || []).length) return base(det, { source: 'rules', rounds: 0, tokens: 0 });          // tier 0a: clean
  if (det.hard >= 2) return base(det, { source: 'rules', rounds: 0, tokens: 0, note: 'overwhelming hard evidence' }); // tier 0b: no AI needed
  if (!aiStatus().live) return base(det, { source: 'rules', rounds: 0, tokens: 0 });

  const text = compact(ev);
  const fp = crypto.createHash('sha1').update(text.replace(/[0-9]+(\.[0-9]+)?/g, (n) => String(Math.round(Number(n) / 5) * 5))).digest('hex'); // near-identical cases share a decision
  const hit = cache.get(fp);
  if (hit && now() - hit.at < 6 * 3600 * 1000) return { ...hit.result, cached: true, tokens: 0 };
  if (pid) { const rp = recentByPlayer.get(pid); if (rp && now() - rp.at < 5 * 60 * 1000) return { ...rp.result, cached: true, tokens: 0 }; }

  let tokens = 0, rounds = 1;
  const votes = [];
  const user1 = `<evidence>\n${text}\n</evidence>\nJudge this event.`;
  let r1 = await pairCall(JUDGE_SYSTEM, user1, user1, checkJudge);
  r1.forEach((r) => { tokens += r.tokens; votes.push({ round: 1, model: r.model, v: r.obj.verdict, c: r.obj.confidence, a: r.obj.recommended_action }); });

  let final = null, finalVotes = r1;
  if (r1.length === 0) return base(det, { source: 'rules', rounds: 0, tokens });
  if (r1.length === 1) {
    // only one opinion available: review it against itself ONLY when it asks for a heavy action (saves tokens otherwise)
    const o = r1[0];
    if (SEV_A[o.obj.recommended_action] >= 3 || o.obj.verdict === 'cheating') {
      rounds = 2;
      const u2 = `<evidence>\n${text}\n</evidence>\n<other_opinion>\n${fmtOpinion(o)}\n</other_opinion>\nRe-analyse and keep or change the verdict.`;
      const c = await callProvider(o.provider, JUDGE_CHALLENGE_SYSTEM, u2, checkJudge, { avoid: [o.model, `${o.model}:free`] });
      if (c) { tokens += c.tokens; votes.push({ round: 2, model: c.model, v: c.obj.verdict, c: c.obj.confidence, a: c.obj.recommended_action }); finalVotes = [o, c]; final = agree(o.obj, c.obj) ? merge(finalVotes) : conservative(finalVotes); }
      else final = conservative([o]);
    } else final = o.obj;
  } else if (agree(r1[0].obj, r1[1].obj)) {
    final = merge(r1);                                     // round 1 consensus: stop here, 2 calls total
  } else {
    rounds = 2;                                            // round 2: cross-review
    const [a, b] = r1;
    const ua = `<evidence>\n${text}\n</evidence>\n<other_opinion>\n${fmtOpinion(b)}\n</other_opinion>\nRe-analyse and keep or change the verdict.`;
    const ub = `<evidence>\n${text}\n</evidence>\n<other_opinion>\n${fmtOpinion(a)}\n</other_opinion>\nRe-analyse and keep or change the verdict.`;
    const [ca, cb] = await Promise.all([
      callProvider(a.provider, JUDGE_CHALLENGE_SYSTEM, ua, checkJudge, { avoid: [b.model] }),
      callProvider(b.provider, JUDGE_CHALLENGE_SYSTEM, ub, checkJudge, { avoid: [a.model] }),
    ]);
    const r2 = [ca, cb].filter(Boolean);
    r2.forEach((r) => { tokens += r.tokens; votes.push({ round: 2, model: r.model, v: r.obj.verdict, c: r.obj.confidence, a: r.obj.recommended_action }); });
    finalVotes = r2.length === 2 ? r2 : [a, b];
    if (r2.length === 2 && agree(r2[0].obj, r2[1].obj)) final = merge(r2);
    else {
      rounds = 3;                                          // round 3: arbiter (a third, different model), majority wins
      const u3 = `<evidence>\n${text}\n</evidence>\n<opinions>\n${finalVotes.map(fmtOpinion).join('\n')}\n</opinions>\nDecide.`;
      const used = finalVotes.map((r) => r.model);
      const arb = (await callProvider('openrouter', JUDGE_ARBITER_SYSTEM, u3, checkJudge, { avoid: used })) || (await callProvider('tokenharbor', JUDGE_ARBITER_SYSTEM, u3, checkJudge, { avoid: used }));
      if (arb && !used.map((u) => u.replace(/:free$/, '')).includes(arb.model)) {
        tokens += arb.tokens; votes.push({ round: 3, model: arb.model, v: arb.obj.verdict, c: arb.obj.confidence, a: arb.obj.recommended_action });
        const all = [...finalVotes, arb];
        const maj = all.find((x) => all.filter((y) => y.obj.verdict === x.obj.verdict).length >= 2);
        final = maj ? merge(all.filter((y) => y.obj.verdict === maj.obj.verdict)) : conservative(all);
        if (!maj) final.recommended_action = 'escalate_human';
      } else final = conservative(finalVotes);
    }
  }
  const unanimousHigh = finalVotes.length >= 2 && finalVotes.every((r) => r.obj.verdict === 'cheating' && r.obj.confidence === 'high');
  const result = { ...guard(final, det, unanimousHigh), hard: det.hard, soft: det.soft, source: finalVotes.length >= 2 ? 'panel' : 'single', rounds, tokens, votes };
  cache.set(fp, { at: now(), result });
  if (pid) recentByPlayer.set(pid, { at: now(), result });
  return result;
}
// consensus: most severe verdict among the agreeing opinions, lowest confidence, union of reasons
function merge(rs) {
  const objs = rs.map((r) => r.obj ?? r);
  const top = objs.reduce((a, b) => (SEV_V[b.verdict] > SEV_V[a.verdict] ? b : a));
  const conf = ['low', 'medium', 'high'][Math.min(...objs.map((o) => ['low', 'medium', 'high'].indexOf(o.confidence)))];
  const act = objs.map((o) => o.recommended_action).reduce((a, b) => (SEV_A[b] < SEV_A[a] ? b : a)); // agree on the milder action
  return { verdict: top.verdict, confidence: conf, reasons: [...new Set(objs.flatMap((o) => o.reasons))].slice(0, 3), recommended_action: act, summary: top.summary };
}
// no consensus: the LEAST severe verdict wins (a false accusation costs more); a human is asked to look if anyone said cheating
function conservative(rs) {
  const objs = rs.map((r) => r.obj ?? r);
  const low = objs.reduce((a, b) => (SEV_V[b.verdict] < SEV_V[a.verdict] ? b : a));
  const anyCheat = objs.some((o) => o.verdict === 'cheating');
  return { verdict: low.verdict, confidence: 'low', reasons: [...new Set(objs.flatMap((o) => o.reasons))].slice(0, 3), recommended_action: anyCheat ? 'escalate_human' : low.recommended_action, summary: objs.length > 1 ? `Reviewers disagreed; ${low.summary || 'conservative outcome'}` : `Single opinion, not confirmed; ${low.summary || 'conservative outcome'}` };
}

// ----------------------------------------------------------------------------------- support chat
const esc = (s) => String(s ?? '').replace(/[<>]/g, (c) => (c === '<' ? '‹' : '›')); // player text can't close our tags
const RISKY = /(refund|rembours|guarantee|garanti|promis|unban|d[ée]bann|will (give|add|restore)|je (vais|vous|te).{0,12}(donner|ajouter|restaurer|d[ée]bannir)|threshold|seuil|detect)/i;
const LEAK = /(sk-or-|thk_live|system prompt|prompt syst|api[_ -]?key|ADMIN_KEY)/i;

function supportContext(player, ctx) {
  const c = { n: player.name, lv: player.level, tier: player.tier, acct: player.hasAccount, banned: player.banned, kicked: !!player.kickedUntil, reason: player.banReason || undefined, strikes: ctx.strikes, wallet: ctx.wallet, boards: ctx.inventory && ctx.inventory.boards, buys: (ctx.purchases || []).slice(0, 4).map((p) => `${p.item}:${p.price}`), runs: (ctx.runs || []).slice(0, 3).map((r) => `${r.mode}:${r.score}${r.flagged ? '!' : ''}`), flagged: (ctx.flagged || []).length, openTickets: ctx.openTickets };
  return JSON.stringify(c);
}

export async function supportReply({ player, ctx, history }) {
  const last = history[history.length - 1]?.text || '';
  const lines = history.slice(-8).map((m) => (m.role === 'user' ? `<player_message>${esc(m.text).slice(0, 500)}</player_message>` : `<assistant_message>${esc(m.text).slice(0, 400)}</assistant_message>`)).join('\n');
  const user = `<game_facts>\n${GAME_FACTS}\n</game_facts>\n<player_context>${esc(supportContext(player, ctx))}</player_context>\n${lines}\nAnswer the latest player_message.`;
  let tokens = 0;

  // author: the FAST seat (Token Harbor, ~3 s) so the player isn't kept waiting; the strong OpenRouter model reviews sensitive drafts
  let draft = await callProvider('tokenharbor', SUPPORT_SYSTEM, user, checkSupport) || await callProvider('openrouter', SUPPORT_SYSTEM, user, checkSupport);
  if (!draft) return { ...ruleSupport(last, player), source: 'rules', rounds: 0, tokens: 0 };
  tokens += draft.tokens;
  let out = draft.obj, rounds = 1, reviewed = false;

  // review by the OTHER seat, only when it matters (saves tokens on routine questions)
  const sensitive = ['fairplay_appeal', 'purchase', 'safety'].includes(out.category) || out.needs_human || RISKY.test(out.reply);
  if (sensitive) {
    const other = draft.provider === 'openrouter' ? 'tokenharbor' : 'openrouter';
    const ru = `<game_facts>\n${GAME_FACTS}\n</game_facts>\n<player_message>${esc(last).slice(0, 500)}</player_message>\n<draft_reply>${esc(out.reply)}</draft_reply>`;
    const rev = await callProvider(other, SUPPORT_REVIEW_SYSTEM, ru, checkReview, { avoid: [draft.model, `${draft.model}:free`] });
    if (rev) {
      tokens += rev.tokens; rounds = 2; reviewed = true;
      if (!rev.obj.approved && rev.obj.revised_reply) out = { ...out, reply: rev.obj.revised_reply, needs_human: out.needs_human || out.category === 'fairplay_appeal' };
    }
  }
  // deterministic output guard (last line of defence): never leak secrets, never promise, always sensible length
  if (LEAK.test(out.reply) || (RISKY.test(out.reply) && !reviewed)) {
    const fb = ruleSupport(last, player);
    out = { ...out, reply: fb.reply, needs_human: true, suggested_action: out.suggested_action === 'none' ? 'escalate' : out.suggested_action };
  }
  return { ...out, source: reviewed ? 'panel' : 'single', rounds, tokens, model: draft.model };
}

// ---- deterministic fallback (FR / EN): answers the common questions, always escalates what it cannot answer
const FAQ = [
  { re: /(ban|banni|kick|expuls|cheat|triche|injust)/i, cat: 'fairplay_appeal', human: true, action: 'review_ban',
    en: 'I can\'t judge the case myself, but a person will review it. Please tell me what you were doing, about when it happened and whether your connection or device was acting up. I\'ve passed your ticket to the team.',
    fr: 'Je ne peux pas juger le dossier moi-même, mais quelqu\'un de l\'équipe va l\'examiner. Dis-moi ce que tu faisais, à peu près quand ça s\'est produit et si ta connexion ou ton appareil avait un souci. J\'ai transmis ton ticket.' },
  { re: /(coin|pi[eè]ce|achat|bought|purchase|wallet|solde|perdu|lost|boutique|shop)/i, cat: 'purchase', human: false, action: 'none',
    en: 'Your wallet and inventory are stored on the server, so they follow you across devices once you are signed in. Open Shop or Career to see your balance. If something looks wrong, tell me what you expected and when you noticed - I\'ll forward it.',
    fr: 'Ton solde et ton inventaire sont stockés sur le serveur : ils te suivent sur tous tes appareils une fois connecté. Ouvre Boutique ou Carrière pour voir ton solde. Si quelque chose cloche, dis-moi ce que tu attendais et quand tu l\'as remarqué - je transmets.' },
  { re: /(rank|elo|rating|classement|niveau|tier)/i, cat: 'ranking', human: false, action: 'none',
    en: 'Ranked uses Elo: you gain or lose rating depending on your placement and your opponents\' rating. Tiers: Bronze, Silver 1100, Gold 1300, Platinum 1500, Diamond 1700, Champion 1900. Leaving a race early costs extra rating.',
    fr: 'Le classé utilise l\'Elo : tu gagnes ou perds des points selon ta place et le niveau des adversaires. Paliers : Bronze, Argent 1100, Or 1300, Platine 1500, Diamant 1700, Champion 1900. Quitter une course trop tôt coûte des points en plus.' },
  { re: /(advent|noel|noël|christmas|winter|calendrier|porte|door)/i, cat: 'event', human: false, action: 'none',
    en: 'Winter Fest runs from December 1 to January 6 (UTC). The advent calendar opens one door per day at 00:00 UTC for everybody; missed doors can still be opened later during the event.',
    fr: 'Winter Fest dure du 1er décembre au 6 janvier (UTC). Le calendrier de l\'avent ouvre une porte par jour à 00h00 UTC pour tout le monde ; les portes manquées peuvent être ouvertes plus tard pendant l\'événement.' },
  { re: /(bug|crash|freez|lag|bloqu|plante|erreur|error|glitch)/i, cat: 'bug', human: false, action: 'none',
    en: 'Thanks for reporting it! Could you tell me the map, the mode, your graphics setting and your browser? Lowering Graphics to Performance often fixes lag.',
    fr: 'Merci du signalement ! Peux-tu me dire la carte, le mode, ton réglage graphique et ton navigateur ? Passer les graphismes en Performance règle souvent les ralentissements.' },
];
function ruleSupport(text, player) {
  const fr = /[éèêàùç]|\b(le|la|les|mon|ma|je|j'ai|pas|est|pourquoi|comment|bonjour|salut)\b/i.test(text);
  const hit = FAQ.find((f) => f.re.test(text));
  if (hit) return { reply: fr ? hit.fr : hit.en, category: hit.cat, needs_human: hit.human, suggested_action: hit.action, summary: `Keyword match (${hit.cat}): ${text.slice(0, 160)}` };
  return {
    reply: fr ? 'Merci pour ton message ! Je n\'ai pas de réponse certaine, donc je le transmets à l\'équipe. Peux-tu ajouter quelques détails (quand, sur quelle carte, ce que tu attendais) ?' : 'Thanks for your message! I\'m not certain about this one, so I\'m passing it to the team. Could you add a few details (when, which map, what you expected)?',
    category: 'other', needs_human: true, suggested_action: 'escalate', summary: `No FAQ match for ${player.name}: ${text.slice(0, 160)}`,
  };
}
