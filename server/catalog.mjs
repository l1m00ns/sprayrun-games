// Server-side game catalogue: shop items & prices, seasonal events, advent calendar, levels, achievements.
// The client only DISPLAYS this data; prices, rewards and availability are decided here.

// ------------------------------------------------------------------------------------------ clock
// All dates are computed from the server clock (UTC) so every player sees the same event windows.
// TEST_NOW (ISO date) lets tests / staging simulate another day. Never set it in production.
import './env.mjs';
const OFFSET = process.env.TEST_NOW ? Date.parse(process.env.TEST_NOW) - Date.now() : 0;
export const nowMs = () => Date.now() + OFFSET;
export const dayKey = (t = nowMs()) => { const d = new Date(t); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); };

// ------------------------------------------------------------------------------------------ items
export const UPGRADE_COSTS = [400, 900, 1700, 3000, 5000];
export const UPGRADE_IDS = ['magnet', 'jetpack', 'sneakers', 'mult'];
export const BOARD_PRICE = 300, BOARD_MAX = 99;

export const RUNNERS = {
  rio: 0, kit: 0, rook: 0, nova: 600, rex: 1800, zip: 3500, mika: 6000, bolt: 10000, frost: 12000, coco: 15000, dune: 18000, volt: 22000, bun: 26000, duke: 30000,
};
// Cosmetics. `event` = only purchasable while that event is running (owners keep them forever).
export const COSMETICS = {
  // outfits (applied on top of any runner)
  'o_street':   { slot: 'outfit', name: 'Street Legend', price: 2500, rarity: 'rare', desc: 'Neon-trimmed bomber and cargo pants.' },
  'o_gold':     { slot: 'outfit', name: 'Gold Rush', price: 9000, rarity: 'epic', desc: 'A shimmering golden puffer jacket.' },
  'o_shadow':   { slot: 'outfit', name: 'Night Shift', price: 5500, rarity: 'rare', desc: 'All black, violet reflectors.' },
  'o_santa':    { slot: 'outfit', name: 'Santa Sprint', price: 3500, rarity: 'epic', event: 'winterfest', desc: 'Red coat, white fur trim, a very fast sleigh driver.' },
  'o_elf':      { slot: 'outfit', name: 'Rail Elf', price: 3000, rarity: 'rare', event: 'winterfest', desc: 'Pointy hat, green tunic, jingle bells.' },
  'o_frostking':{ slot: 'outfit', name: 'Frost King', price: 0, rarity: 'legendary', event: 'winterfest', exclusive: true, desc: 'Advent calendar exclusive (day 24).' },
  // hoverboard skins
  'b_sunset':   { slot: 'board', name: 'Sunset Cruiser', price: 1500, rarity: 'rare', desc: 'Orange to pink gradient deck.' },
  'b_neon':     { slot: 'board', name: 'Neon Wave', price: 2200, rarity: 'rare', desc: 'Glowing cyan rails.' },
  'b_gold':     { slot: 'board', name: 'Midas Deck', price: 8000, rarity: 'epic', desc: 'Solid gold, naturally.' },
  'b_candy':    { slot: 'board', name: 'Candy Cane', price: 2500, rarity: 'epic', event: 'winterfest', desc: 'Red and white stripes.' },
  'b_aurora':   { slot: 'board', name: 'Aurora', price: 0, rarity: 'legendary', event: 'winterfest', exclusive: true, desc: 'Advent calendar exclusive (day 25).' },
  // backpacks
  'bg_cat':     { slot: 'bag', name: 'Cat Pouch', price: 1800, rarity: 'rare', desc: 'A small friend rides along.' },
  'bg_rocket':  { slot: 'bag', name: 'Rocket Pack', price: 2600, rarity: 'rare', desc: 'Two boosters. Purely decorative, mostly.' },
  'bg_guitar':  { slot: 'bag', name: 'Guitar Case', price: 2200, rarity: 'common', desc: 'Busker on the night line.' },
  'bg_wings':   { slot: 'bag', name: 'Feather Wings', price: 7000, rarity: 'epic', desc: 'Light, white, a little dramatic.' },
  'bg_cube':    { slot: 'bag', name: 'Neon Cube', price: 6000, rarity: 'epic', desc: 'A glowing cube that follows you.' },
  'bg_cup':     { slot: 'bag', name: 'Cup Champion', price: 0, rarity: 'legendary', exclusive: true, tournament: 'weekly', desc: 'Weekly Cup winners only.' },
  // auras (a glow around the runner)
  'au_ember':   { slot: 'aura', name: 'Ember Ring', price: 3200, rarity: 'rare', desc: 'Slow orange embers circle your feet.' },
  'au_frost':   { slot: 'aura', name: 'Frost Veil', price: 3200, rarity: 'rare', desc: 'A cold blue shimmer.' },
  'au_volt':    { slot: 'aura', name: 'Volt Field', price: 7500, rarity: 'epic', desc: 'Crackling electric rings.' },
  'au_royal':   { slot: 'aura', name: 'Royal Glow', price: 0, rarity: 'legendary', exclusive: true, tournament: 'weekly', desc: 'Weekly Cup top 3.' },
  'au_dawn':    { slot: 'aura', name: 'Dawn Light', price: 0, rarity: 'epic', exclusive: true, tournament: 'daily', desc: 'Daily Sprint winners.' },
  // run styles (how the runner moves)
  'st_chill':   { slot: 'style', name: 'Chill', price: 1500, rarity: 'common', desc: 'Relaxed arms, easy stride.' },
  'st_ninja':   { slot: 'style', name: 'Ninja', price: 4000, rarity: 'rare', desc: 'Arms swept back, low and fast.' },
  'st_bounce':  { slot: 'style', name: 'Bounce', price: 3000, rarity: 'rare', desc: 'A springy, joyful stride.' },
  'st_sprinter':{ slot: 'style', name: 'Sprinter', price: 4500, rarity: 'epic', desc: 'Track-star lean and pump.' },
  // skins (a different look for the runner: skin tone, hair, eyes)
  'sk_ocean':   { slot: 'skin', name: 'Ocean', price: 3500, rarity: 'rare', desc: 'Sea-blue skin and sun-bleached hair.' },
  'sk_ghost':   { slot: 'skin', name: 'Spectre', price: 5000, rarity: 'epic', desc: 'Pale, glowing and a little eerie.' },
  'sk_lava':    { slot: 'skin', name: 'Magma', price: 6500, rarity: 'epic', desc: 'Dark rock skin, molten hair.' },
  'sk_crown':   { slot: 'skin', name: 'Champion Gold', price: 0, rarity: 'legendary', exclusive: true, tournament: 'weekly', desc: 'Weekly Cup champion.' },
  // trails
  't_sparks':   { slot: 'trail', name: 'Sparks', price: 1200, rarity: 'common', desc: 'A line of golden sparks.' },
  't_stars':    { slot: 'trail', name: 'Stardust', price: 2600, rarity: 'rare', desc: 'Twinkling stars in your wake.' },
  't_snow':     { slot: 'trail', name: 'Snow Flurry', price: 1800, rarity: 'rare', event: 'winterfest', desc: 'Snowflakes swirl behind you.' },
  // Easter / Spring
  'o_bunny':    { slot: 'outfit', name: 'Bunny Hop', price: 3200, rarity: 'epic', event: 'easter', desc: 'A pastel hoodie, floppy ears and a cotton tail.' },
  'b_egg':      { slot: 'board', name: 'Eggshell', price: 1600, rarity: 'rare', event: 'easter', desc: 'A speckled pastel deck with a jelly-bean rail.' },
  'bg_basket':  { slot: 'bag', name: 'Egg Basket', price: 1800, rarity: 'rare', event: 'easter', desc: 'A woven basket full of painted eggs.' },
  'au_bloom':   { slot: 'aura', name: 'Cherry Bloom', price: 3000, rarity: 'rare', event: 'easter', desc: 'Pink petals drift around your feet.' },
  't_petals':   { slot: 'trail', name: 'Petal Trail', price: 1400, rarity: 'common', event: 'easter', desc: 'A soft ribbon of petals.' },
  // Halloween
  'o_pumpkin':  { slot: 'outfit', name: 'Pumpkin Jack', price: 3600, rarity: 'epic', event: 'halloween', desc: 'A carved-orange puffer with midnight trim.' },
  'b_broom':    { slot: 'board', name: 'Broomstick', price: 1900, rarity: 'epic', event: 'halloween', desc: 'A bristly deck that leaves a trail of sparks.' },
  'bg_bat':     { slot: 'bag', name: 'Little Bat', price: 2200, rarity: 'rare', event: 'halloween', desc: 'A sleepy bat rides on your back.' },
  'au_spirit':  { slot: 'aura', name: 'Spirit Veil', price: 3400, rarity: 'rare', event: 'halloween', desc: 'A cold violet shimmer.' },
  't_embers':   { slot: 'trail', name: 'Ember Wake', price: 1500, rarity: 'common', event: 'halloween', desc: 'Orange embers glow in your wake.' },
};
export const BUNDLES = {
  'bundle_starter': { name: 'Starter Pack', price: 1200, desc: '5 hoverboards, Magnet and Jetpack level 1.', grant: { boards: 5, up: { magnet: 1, jetpack: 1 } } },
  'bundle_pro':     { name: 'Pro Pack', price: 4800, desc: '15 hoverboards and Super Sneakers + Double Score level 2.', grant: { boards: 15, up: { sneakers: 2, mult: 2 } } },
  'bundle_winter':  { name: 'Winter Pack', price: 5200, event: 'winterfest', desc: 'Santa Sprint outfit, Candy Cane board and 8 hoverboards.', grant: { boards: 8, cos: ['o_santa', 'b_candy'] } },
};

// ----------------------------------------------------------------------------------------- events
// start/end are [month, day] in UTC. `year` of the end is next year when the window wraps.
export const EVENTS = {
  easter:     { id: 'easter', name: 'Egg Hunt', start: [3, 20], end: [4, 20], blurb: 'Spring comes to the rails: pastel cosmetics, an egg basket and a free Bunny Hop outfit.' },
  halloween:  { id: 'halloween', name: 'Haunted Rails', start: [10, 1], end: [11, 2], blurb: 'The night line wakes up: pumpkin gear, a little bat and a free Pumpkin Jack outfit.' },
  winterfest: { id: 'winterfest', name: 'Winter Fest', start: [12, 1], end: [1, 6], blurb: 'Snow village map, holiday train, advent calendar and limited cosmetics.' },
};
// One free cosmetic + coins per event, once per account and per occurrence.
export const EVENT_GIFTS = {
  easter:     { cos: 'o_bunny', coins: 500, label: 'Bunny Hop outfit + 500 coins' },
  halloween:  { cos: 'o_pumpkin', coins: 666, label: 'Pumpkin Jack outfit + 666 coins' },
  winterfest: { cos: 't_snow', coins: 500, label: 'Snow Flurry trail + 500 coins' },
};
export function eventStatus(id, t = nowMs()) {
  const e = EVENTS[id];
  if (!e) return null;
  const d = new Date(t), y = d.getUTCFullYear();
  const wraps = e.end[0] < e.start[0];
  // the occurrence that could contain `t`: started this year, or (when wrapping) started last year
  const candidates = [y - 1, y].map((sy) => ({ s: Date.UTC(sy, e.start[0] - 1, e.start[1]), en: Date.UTC(sy + (wraps ? 1 : 0), e.end[0] - 1, e.end[1] + 1), sy }));
  const cur = candidates.find((c) => t >= c.s && t < c.en);
  const gift = EVENT_GIFTS[id] || null;
  if (cur) return { id, active: true, year: cur.sy, startsAt: cur.s, endsAt: cur.en, name: e.name, blurb: e.blurb, gift };
  const next = Date.UTC(t < Date.UTC(y, e.start[0] - 1, e.start[1]) ? y : y + 1, e.start[0] - 1, e.start[1]);
  const nextEnd = Date.UTC(new Date(next).getUTCFullYear() + (wraps ? 1 : 0), e.end[0] - 1, e.end[1] + 1);
  return { id, active: false, year: new Date(next).getUTCFullYear(), startsAt: next, endsAt: nextEnd, name: e.name, blurb: e.blurb, gift };
}
export const eventIds = () => Object.keys(EVENTS);
export const allEvents = (t = nowMs()) => Object.fromEntries(eventIds().map((id) => [id, eventStatus(id, t)]));
export const eventActive = (id, t = nowMs()) => eventStatus(id, t).active;

// Limited-time event: "Neon Rush". LTM_SCHEDULE=always (default) | weekend (Fri 18:00 -> Mon 06:00 UTC)
export function ltmStatus(t = nowMs()) {
  const mode = process.env.LTM_SCHEDULE || 'always';
  const d = new Date(t);
  const dow = d.getUTCDay(), h = d.getUTCHours();
  const weekend = (dow === 5 && h >= 18) || dow === 6 || dow === 0 || (dow === 1 && h < 6);
  const active = mode === 'always' || weekend || eventActive('winterfest', t);
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + ((8 - dow) % 7 || 7), 6); // next Monday 06:00
  return { id: 'neonrush', name: 'Neon Rush', active, schedule: mode, endsAt: active ? monday : null, desc: 'The city goes dark and the track lights up: a free Double Score at the start, a magnet at 400 m, and neon rails everywhere. Play it offline from the play button.' };
}

// -------------------------------------------------------------------------------- advent calendar
// Doors open on Dec 1..24 (+ a special door on the 25th), at 00:00 UTC for everyone at once.
export const ADVENT_DAYS = 25;
export function adventReward(day) {
  if (day === 24) return { coins: 1500, boards: 2, cos: ['o_frostking'], label: 'Frost King outfit + 1,500 coins' };
  if (day === 25) return { coins: 2500, boards: 3, cos: ['b_aurora'], label: 'Aurora hoverboard + 2,500 coins' };
  if (day % 6 === 0) return { coins: 400 + day * 20, boards: 3, label: `${400 + day * 20} coins + 3 hoverboards` };
  if (day % 3 === 0) return { coins: 250 + day * 15, boards: 1, label: `${250 + day * 15} coins + 1 hoverboard` };
  if (day % 5 === 0) return { coins: 200, upgrade: 'magnet', label: '200 coins + Magnet level' };
  return { coins: 120 + day * 15, label: `${120 + day * 15} coins` };
}
export function adventState(claimedDays, t = nowMs()) {
  const ev = eventStatus('winterfest', t);
  const year = ev.year;
  const d = new Date(t);
  // doors available: December of the event year, up to today's date (all 25 after the 25th, until the event ends)
  let today = 0;
  if (ev.active) {
    const startD = new Date(ev.startsAt);
    const days = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), startD.getUTCDate())) / 86400000) + 1;
    today = Math.min(ADVENT_DAYS, Math.max(0, days));
  }
  const claimed = new Set(claimedDays);
  const doors = Array.from({ length: ADVENT_DAYS }, (_, i) => {
    const day = i + 1;
    return { day, reward: adventReward(day), state: claimed.has(day) ? 'claimed' : day <= today ? 'open' : 'locked' };
  });
  return { active: ev.active, year, today, opensAt: ev.startsAt, closesAt: ev.endsAt, nextDoorAt: ev.active && today < ADVENT_DAYS ? Date.UTC(new Date(ev.startsAt).getUTCFullYear(), 11, today + 1) : null, doors };
}

// ------------------------------------------------------------------------------------- level / xp
export const xpForLevel = (lv) => Math.round(220 * (lv - 1) ** 1.45); // total xp needed to reach `lv`
export function levelOf(xp) {
  let lv = 1;
  while (xp >= xpForLevel(lv + 1) && lv < 200) lv++;
  const a = xpForLevel(lv), b = xpForLevel(lv + 1);
  return { level: lv, xp, into: xp - a, need: b - a };
}
export const TITLES = [[1, 'Rookie'], [5, 'Tagger'], [10, 'Rail Runner'], [20, 'Street Pro'], [35, 'Line Master'], [50, 'Legend']];
export const titleOf = (lv) => [...TITLES].reverse().find(([m]) => lv >= m)[1];

// ---------------------------------------------------------------------------------- achievements
// `test(career)` is evaluated on the server from validated stats only. Reward is paid once.
export const ACHIEVEMENTS = [
  { id: 'first_run', name: 'First Steps', desc: 'Finish a run.', reward: 50, test: (c) => c.runs >= 1 },
  { id: 'runs_25', name: 'Regular', desc: 'Finish 25 runs.', reward: 150, test: (c) => c.runs >= 25 },
  { id: 'runs_250', name: 'Rail Rat', desc: 'Finish 250 runs.', reward: 600, test: (c) => c.runs >= 250 },
  { id: 'dist_5k', name: 'Marathoner', desc: 'Run 5,000 m in total.', reward: 100, test: (c) => c.dist >= 5000 },
  { id: 'dist_100k', name: 'Ultra Marathoner', desc: 'Run 100,000 m in total.', reward: 800, test: (c) => c.dist >= 100000 },
  { id: 'score_10k', name: 'Five Digits', desc: 'Score 10,000 in one run.', reward: 150, test: (c) => c.bestScore >= 10000 },
  { id: 'score_100k', name: 'Six Digits', desc: 'Score 100,000 in one run.', reward: 700, test: (c) => c.bestScore >= 100000 },
  { id: 'coins_1k', name: 'Pocket Change', desc: 'Collect 1,000 coins in total.', reward: 100, test: (c) => c.coins >= 1000 },
  { id: 'coins_50k', name: 'Coin Hoarder', desc: 'Collect 50,000 coins in total.', reward: 900, test: (c) => c.coins >= 50000 },
  { id: 'nocoin_3k', name: 'Untouchable', desc: 'Score 3,000 in No Coin mode.', reward: 300, test: (c) => (c.bestNoCoin || 0) >= 3000 },
  { id: 'daily_1', name: 'Daily Habit', desc: 'Finish a daily run.', reward: 100, test: (c) => c.dailyRuns >= 1 },
  { id: 'ranked_1', name: 'Into the Ring', desc: 'Play a ranked match.', reward: 150, test: (c) => c.rankedGames >= 1 },
  { id: 'ranked_win', name: 'First Blood', desc: 'Win a ranked match.', reward: 300, test: (c) => c.rankedWins >= 1 },
  { id: 'ranked_10w', name: 'Contender', desc: 'Win 10 ranked matches.', reward: 900, test: (c) => c.rankedWins >= 10 },
  { id: 'duel_win', name: 'Quick Draw', desc: 'Win a Gold Rush duel.', reward: 400, test: (c) => c.duelWins >= 1 },
  { id: 'duel_10', name: 'Gunslinger', desc: 'Win 10 Gold Rush duels.', reward: 1200, test: (c) => c.duelWins >= 10 },
  { id: 'time_1h', name: 'Dedicated', desc: 'Spend one hour running.', reward: 400, test: (c) => c.time >= 3600 },
  { id: 'advent_5', name: 'Door Opener', desc: 'Open 5 advent doors.', reward: 200, test: (c) => (c.advent || 0) >= 5 },
  { id: 'advent_25', name: 'Christmas Spirit', desc: 'Open all 25 advent doors.', reward: 1500, test: (c) => (c.advent || 0) >= 25 },
];

// Ranked needs real play time first (anti smurf / throwaway accounts). RANKED_MIN_MINUTES, default 15.
export const rankedMinSeconds = () => Math.max(0, Number(process.env.RANKED_MIN_MINUTES ?? 15)) * 60;
export const BADGES = { gold_eagle: { name: 'Gold Eagle', desc: 'Won your first Gold Rush duel.' } };
export const newCareer = () => ({ badges: [], runs: 0, dist: 0, coins: 0, time: 0, bestScore: 0, bestNoCoin: 0, bestDist: 0, dailyRuns: 0, rankedGames: 0, rankedWins: 0, duelWins: 0, duelLosses: 0, duelDraws: 0, duelKills: 0, advent: 0, ach: [], maps: {} });

// Daily run: same track for everybody, derived from the UTC date.
export const DAILY_MAPS = ['city', 'snow', 'tropic', 'desert', 'neon'];
export const dailyInfo = () => { const k = dayKey(); return { key: k, seed: Math.imul(k, 2654435761) >>> 0, map: DAILY_MAPS[k % DAILY_MAPS.length] }; };
