// Server-authoritative economy: wallet, inventory, purchases, run rewards, XP/levels, achievements, advent calendar.
// Rules that keep the economy safe:
//  - coins only come from (a) runs that passed anti-cheat (b) advent doors (c) achievements - never from the client's say-so
//  - run coins are capped per run and per day; flagged runs earn nothing
//  - every purchase is one atomic transaction (price, ownership and wallet are re-checked inside it)
//  - cheat / secret-menu sessions never submit runs, so they can never touch the wallet, XP, boards or ranking
import { q, tx } from './db.mjs';
import { UPGRADE_COSTS, UPGRADE_IDS, BOARD_PRICE, BOARD_MAX, RUNNERS, COSMETICS, BUNDLES, ACHIEVEMENTS, ADVENT_DAYS, adventReward, adventState, eventActive, eventStatus, EVENT_GIFTS, nowMs, dayKey, newCareer } from './catalog.mjs';
import { careerOf } from './players.mjs';

export const DAILY_COIN_CAP = 60000;
export const RUN_XP_CAP = 450;

const SLOT_CAT = { outfit: 'outfits', board: 'boardskins', trail: 'trails', bag: 'bags', aura: 'auras', style: 'styles', skin: 'skins' };
export const SLOTS = ['outfit', 'board', 'trail', 'bag', 'aura', 'style', 'skin'];
export const newInv = () => ({ boards: 2, chars: ['rio', 'kit', 'rook'], up: { magnet: 0, jetpack: 0, sneakers: 0, mult: 0 }, cos: [], equip: { char: 'rio', outfit: null, board: null, trail: null, bag: null, aura: null, style: null, skin: null } });
export function invOf(p) {
  let inv;
  try { inv = p.inv ? JSON.parse(p.inv) : null; } catch { inv = null; }
  const base = newInv();
  if (!inv) return base;
  return { ...base, ...inv, up: { ...base.up, ...(inv.up || {}) }, equip: { ...base.equip, ...(inv.equip || {}) }, chars: [...new Set([...base.chars, ...(inv.chars || [])])], cos: inv.cos || [] };
}
export const stateOf = (p) => ({ wallet: p.wallet, inv: invOf(p) });

function save(pid, p, inv, wallet, extra = {}) {
  q.setProgress.run(extra.xp ?? p.xp, extra.career ?? p.career, wallet, JSON.stringify(inv), extra.earnedDay ?? p.earned_day, extra.earnedKey ?? p.earned_key, pid);
}

// ------------------------------------------------------------------------------------------ shop
export function shopView(p) {
  const inv = invOf(p);
  const items = [];
  const push = (it) => items.push(it);
  push({ id: 'board', cat: 'boards', name: 'Hoverboard', desc: 'Survives one crash. Double-tap Space or press B.', price: BOARD_PRICE, owned: inv.boards, max: BOARD_MAX, kind: 'consumable', can: inv.boards < BOARD_MAX });
  push({ id: 'board:5', cat: 'boards', name: 'Hoverboard x5', desc: 'Five hoverboards, small discount.', price: Math.round(BOARD_PRICE * 5 * 0.9), kind: 'consumable', can: inv.boards + 5 <= BOARD_MAX });
  for (const id of UPGRADE_IDS) {
    const lv = inv.up[id];
    push({ id: `up:${id}`, cat: 'upgrades', name: id, desc: '', level: lv, max: 5, price: lv >= 5 ? 0 : UPGRADE_COSTS[lv], kind: 'upgrade', can: lv < 5 });
  }
  for (const [id, price] of Object.entries(RUNNERS)) push({ id: `char:${id}`, cat: 'runners', name: id, price, owned: inv.chars.includes(id), kind: 'runner', can: !inv.chars.includes(id) });
  for (const [id, c] of Object.entries(COSMETICS)) {
    const ev = c.event ? eventActive(c.event) : true;
    const owned = inv.cos.includes(id);
    push({ id: `cos:${id}`, cat: SLOT_CAT[c.slot] || 'trails', name: c.name, desc: c.desc, rarity: c.rarity, price: c.price, owned, limited: c.event || null, exclusive: !!c.exclusive, kind: 'cosmetic', slot: c.slot, can: !owned && !c.exclusive && ev, lockedReason: !owned && c.exclusive ? 'Advent calendar exclusive' : !owned && !ev ? 'Only during the event' : null });
  }
  for (const [id, b] of Object.entries(BUNDLES)) {
    const ev = b.event ? eventActive(b.event) : true;
    const allOwned = (b.grant.cos || []).length > 0 && b.grant.cos.every((c) => inv.cos.includes(c));
    push({ id: `bundle:${id}`, cat: 'bundles', name: b.name, desc: b.desc, price: b.price, limited: b.event || null, kind: 'bundle', owned: allOwned, can: ev && !allOwned, lockedReason: !ev ? 'Only during the event' : null });
  }
  return { wallet: p.wallet, inv, items };
}

function parseItem(item) {
  const [kind, id] = String(item).split(':');
  if (kind === 'board') return { kind: 'board', qty: id ? Number(id) : 1 };
  if (kind === 'up' && UPGRADE_IDS.includes(id)) return { kind, id };
  if (kind === 'char' && id in RUNNERS) return { kind, id };
  if (kind === 'cos' && id in COSMETICS) return { kind, id };
  if (kind === 'bundle' && id in BUNDLES) return { kind, id };
  return null;
}

export function buy(pid, item) {
  const it = parseItem(item);
  if (!it) return { ok: false, error: 'unknown_item' };
  return tx(() => {
    const p = q.getPlayer.get(pid);
    const inv = invOf(p);
    let price = 0;
    if (it.kind === 'board') {
      if (![1, 5].includes(it.qty)) return { ok: false, error: 'unknown_item' };
      if (inv.boards + it.qty > BOARD_MAX) return { ok: false, error: 'max_reached' };
      price = it.qty === 5 ? Math.round(BOARD_PRICE * 5 * 0.9) : BOARD_PRICE;
      if (p.wallet < price) return { ok: false, error: 'not_enough_coins' };
      inv.boards += it.qty;
    } else if (it.kind === 'up') {
      const lv = inv.up[it.id];
      if (lv >= 5) return { ok: false, error: 'max_reached' };
      price = UPGRADE_COSTS[lv];
      if (p.wallet < price) return { ok: false, error: 'not_enough_coins' };
      inv.up[it.id]++;
    } else if (it.kind === 'char') {
      if (inv.chars.includes(it.id)) return { ok: false, error: 'already_owned' };
      price = RUNNERS[it.id];
      if (p.wallet < price) return { ok: false, error: 'not_enough_coins' };
      inv.chars.push(it.id);
    } else if (it.kind === 'cos') {
      const c = COSMETICS[it.id];
      if (inv.cos.includes(it.id)) return { ok: false, error: 'already_owned' };
      if (c.exclusive) return { ok: false, error: 'not_purchasable' };
      if (c.event && !eventActive(c.event)) return { ok: false, error: 'not_available' };
      price = c.price;
      if (p.wallet < price) return { ok: false, error: 'not_enough_coins' };
      inv.cos.push(it.id);
    } else if (it.kind === 'bundle') {
      const b = BUNDLES[it.id];
      if (b.event && !eventActive(b.event)) return { ok: false, error: 'not_available' };
      if ((b.grant.cos || []).length && b.grant.cos.every((c) => inv.cos.includes(c))) return { ok: false, error: 'already_owned' };
      price = b.price;
      if (p.wallet < price) return { ok: false, error: 'not_enough_coins' };
      applyGrant(inv, b.grant);
    }
    save(pid, p, inv, p.wallet - price);
    q.addPurchase.run(pid, item, price, nowMs());
    return { ok: true, price, ...stateOf(q.getPlayer.get(pid)) };
  });
}

function applyGrant(inv, g) {
  if (g.boards) inv.boards = Math.min(BOARD_MAX, inv.boards + g.boards);
  for (const [k, lv] of Object.entries(g.up || {})) inv.up[k] = Math.min(5, Math.max(inv.up[k], lv));
  for (const c of g.cos || []) if (!inv.cos.includes(c)) inv.cos.push(c);
}

export function equip(pid, slot, id) {
  return tx(() => {
    const p = q.getPlayer.get(pid);
    const inv = invOf(p);
    if (slot === 'char') { if (!inv.chars.includes(id)) return { ok: false, error: 'not_owned' }; inv.equip.char = id; }
    else if (SLOTS.includes(slot)) {
      if (id !== null && !(inv.cos.includes(id) && COSMETICS[id] && COSMETICS[id].slot === slot)) return { ok: false, error: 'not_owned' };
      inv.equip[slot] = id;
    } else return { ok: false, error: 'bad_slot' };
    save(pid, p, inv, p.wallet);
    return { ok: true, ...stateOf(q.getPlayer.get(pid)) };
  });
}

// ----------------------------------------------------------------------------------- run rewards
// Called for every ACCEPTED (not flagged) run. `run` is the validated payload. Returns what the player earned.
export function applyRun(pid, run, ticket) {
  return tx(() => {
    const p = q.getPlayer.get(pid);
    const inv = invOf(p);
    const career = careerOf(p);
    const today = dayKey();
    let earnedDay = p.earned_key === today ? p.earned_day : 0;

    const wantCoins = Math.max(0, Math.floor(run.coins || 0));
    const room = Math.max(0, DAILY_COIN_CAP - earnedDay);
    const coins = Math.min(wantCoins, room);
    earnedDay += coins;

    // revives are paid for with coins during a run: the price ladder is fixed by the game (100, 200, 400; max 3) - charge it here
    const revives = Math.min(3, Math.max(0, Math.floor((run.stats && run.stats.revives) || 0)));
    let reviveCost = 0;
    for (let i = 0; i < revives; i++) reviveCost += 100 * 2 ** i;
    // hoverboards: used during the run (bounded by what was owned + found in chests)
    const used = Math.min(8, Math.max(0, Math.floor((run.stats && run.stats.boards) || 0)));
    const found = Math.min(3, Math.max(0, Math.floor((run.stats && run.stats.chestBoards) || 0)));
    inv.boards = Math.min(BOARD_MAX, Math.max(0, inv.boards - used + found));
    const wallet = Math.max(0, p.wallet + coins - reviveCost);

    // career
    career.runs++; career.dist += Math.floor(run.dist); career.coins += coins; career.time += Math.floor(run.time);
    career.bestScore = Math.max(career.bestScore, Math.floor(run.score));
    career.bestDist = Math.max(career.bestDist, Math.floor(run.dist));
    if (ticket.mode === 'nocoin') career.bestNoCoin = Math.max(career.bestNoCoin || 0, Math.floor(run.score));
    if (ticket.daily) career.dailyRuns++;
    career.maps[ticket.map] = (career.maps[ticket.map] || 0) + 1;

    // xp (capped per run so one lucky run can't skip levels)
    const gainXp = Math.min(RUN_XP_CAP, Math.floor(run.score / 200) + Math.floor(run.dist / 100) + Math.floor(coins / 20) + 10);
    const xp = p.xp + gainXp;

    const unlocked = evalAchievements(career);
    let bonus = 0;
    for (const a of unlocked) bonus += a.reward;
    save(pid, p, inv, wallet + bonus, { xp, career: JSON.stringify(career), earnedDay, earnedKey: today });
    return { coins, coinsCapped: wantCoins > coins, xp: gainXp, reviveCost, achievements: unlocked.map((a) => ({ id: a.id, name: a.name, reward: a.reward })), ...stateOf(q.getPlayer.get(pid)) };
  });
}

function evalAchievements(career) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (!career.ach.includes(a.id) && a.test(career)) { career.ach.push(a.id); out.push(a); }
  }
  return out;
}
// Used by ranked / duel settlement.
export function bumpCareer(pid, fn) {
  return tx(() => {
    const p = q.getPlayer.get(pid);
    if (!p) return null;
    const career = careerOf(p);
    fn(career);
    const unlocked = evalAchievements(career);
    let bonus = 0;
    for (const a of unlocked) bonus += a.reward;
    save(pid, p, invOf(p), p.wallet + bonus, { career: JSON.stringify(career), xp: p.xp + (unlocked.length ? 0 : 0) });
    return unlocked;
  });
}
export function addXp(pid, n) {
  const p = q.getPlayer.get(pid);
  if (p) save(pid, p, invOf(p), p.wallet, { xp: p.xp + Math.max(0, Math.min(500, Math.floor(n))) });
}

// ---------------------------------------------------------------------------------------- advent
export function adventView(pid) {
  const year = adventState([]).year;
  const claimed = q.claims.all(pid, year).map((r) => r.day);
  return adventState(claimed);
}
// One free gift per event occurrence: a cosmetic + coins. Reuses the same inventory path as advent.
export function claimEventGift(pid, event) {
  const ev = eventStatus(event);
  const gift = EVENT_GIFTS[event];
  if (!ev || !gift) return { ok: false, error: 'unknown_event' };
  if (!ev.active) return { ok: false, error: 'event_not_active' };
  return tx(() => {
    const p = q.getPlayer.get(pid);
    if (q.eventClaim.get(pid, event, ev.year)) return { ok: false, error: 'already_claimed' };
    const inv = invOf(p);
    applyGrant(inv, { cos: [gift.cos] });
    q.claimEvent.run(pid, event, ev.year, nowMs());
    const career = careerOf(p);
    const unlocked = evalAchievements(career);
    let bonus = 0;
    for (const a of unlocked) bonus += a.reward;
    save(pid, p, inv, p.wallet + gift.coins + bonus, { career: JSON.stringify(career) });
    return { ok: true, event, reward: gift, achievements: unlocked.map((a) => ({ id: a.id, name: a.name, reward: a.reward })), ...stateOf(q.getPlayer.get(pid)) };
  });
}

export function claimAdvent(pid, day) {
  day = Math.floor(Number(day));
  if (!(day >= 1 && day <= ADVENT_DAYS)) return { ok: false, error: 'bad_day' };
  return tx(() => {
    const p = q.getPlayer.get(pid);
    const claimed = q.claims.all(pid, adventState([]).year).map((r) => r.day);
    const st = adventState(claimed);
    if (!st.active) return { ok: false, error: 'event_not_active' };
    if (day > st.today) return { ok: false, error: 'door_locked' };
    if (claimed.includes(day)) return { ok: false, error: 'already_claimed' };
    const r = adventReward(day);
    const inv = invOf(p);
    applyGrant(inv, { boards: r.boards, cos: r.cos, up: r.upgrade ? { [r.upgrade]: Math.min(5, inv.up[r.upgrade] + 1) } : undefined });
    q.addClaim.run(pid, st.year, day, nowMs());
    const career = careerOf(p);
    career.advent = claimed.length + 1;
    const unlocked = evalAchievements(career);
    let bonus = 0;
    for (const a of unlocked) bonus += a.reward;
    save(pid, p, inv, p.wallet + (r.coins || 0) + bonus, { career: JSON.stringify(career) });
    return { ok: true, day, reward: r, achievements: unlocked.map((a) => ({ id: a.id, name: a.name, reward: a.reward })), advent: adventView(pid), ...stateOf(q.getPlayer.get(pid)) };
  });
}

// ------------------------------------------------------------------------------ local save import
// One-time, capped import of an offline save when a guest creates an account. The cap is deliberately small:
// the local file is editable, so it must never be a way to mint a fortune.
export function importLocal(pid, local) {
  return tx(() => {
    const p = q.getPlayer.get(pid);
    if (p.imported) return { ok: false, error: 'already_imported' };
    const inv = invOf(p);
    const num = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
    const coins = num(local && local.coins, 3000);
    inv.boards = Math.max(inv.boards, num(local && local.boards, 5));
    for (const k of UPGRADE_IDS) inv.up[k] = Math.max(inv.up[k], num(local && local.upgrades && local.upgrades[k], 2));
    for (const c of (local && Array.isArray(local.unlocked) ? local.unlocked : []).slice(0, 20)) if (c in RUNNERS && RUNNERS[c] <= 3500 && !inv.chars.includes(c)) inv.chars.push(c);
    q.setInv.run(JSON.stringify(inv), p.wallet + coins, 1, pid);
    return { ok: true, coins, ...stateOf(q.getPlayer.get(pid)) };
  });
}

export { newCareer };

// Tournament / event rewards: grants cosmetics that cannot be bought (idempotent: already-owned items are skipped).
export function grantCosmetics(pid, ids) {
  return tx(() => {
    const p = q.getPlayer.get(pid);
    if (!p) return [];
    const inv = invOf(p), given = [];
    for (const id of ids) if (COSMETICS[id] && !inv.cos.includes(id)) { inv.cos.push(id); given.push(id); }
    if (given.length) save(pid, p, inv, p.wallet);
    return given;
  });
}
