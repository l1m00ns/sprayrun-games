// The "Spray Secret Menu": unlocked with the Konami code. A sandbox of 65+ options.
//
// Safety rules (enforced by the engine, see main.js):
//  - any option marked `taint` that differs from its default makes the session a PRACTICE session:
//    no ticket is requested, no score is submitted, nothing is banked (coins, XP, missions, records), online/ranked is blocked
//  - no option can read or write the server wallet, inventory, XP, rating or cosmetics - they simply have no access to them
//  - purely visual options (filters, camera gags, debug overlays) are free and never taint
// Values are stored in their own localStorage key (not in the cloud save), so they never travel with an account.

export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

const T = (id, g, label, def = false, o = {}) => ({ id, g, label, t: 'toggle', def, taint: true, ...o });
const R = (id, g, label, def, min, max, step, o = {}) => ({ id, g, label, t: 'range', def, min, max, step, taint: true, fmt: (v) => `${(+v).toFixed(step < 1 ? 2 : 0)}`, ...o });
const S = (id, g, label, def, opts, o = {}) => ({ id, g, label, t: 'select', def, opts, taint: true, ...o });
const B = (id, g, label, o = {}) => ({ id, g, label, t: 'button', def: null, taint: true, ...o });
const x = (v) => `${(+v).toFixed(2)}x`;

export const GROUPS = ['Player', 'Powers', 'Speed', 'Bot', 'World', 'Look', 'Camera', 'Duel', 'Tools'];

export const OPTIONS = [
  // ---- Player
  T('god', 'Player', 'Invincible', false, { hint: 'Hits never hurt.' }),
  T('noclip', 'Player', 'Ghost mode (no collisions)'),
  T('noStumble', 'Player', 'Bump-proof (obstacles never stumble you)'),
  T('freeRevive', 'Player', 'Free, unlimited revives'),
  T('doubleJump', 'Player', 'Double jump'),
  R('jumpScale', 'Player', 'Jump height', 1, 0.5, 3, 0.05, { fmt: x }),
  R('gravity', 'Player', 'Gravity', 1, 0.3, 2, 0.05, { fmt: x }),
  R('rollScale', 'Player', 'Roll duration', 1, 0.4, 3, 0.05, { fmt: x }),
  R('laneSpeed', 'Player', 'Lane-change speed', 1, 0.5, 3, 0.05, { fmt: x }),
  T('assist', 'Player', 'Auto jump & roll assist', false, { hint: 'You pick the lane, the game jumps and rolls.' }),
  T('autoLane', 'Player', 'Auto lane-dodge assist'),
  R('coinMul', 'Player', 'Coin value (practice only)', 1, 1, 10, 1, { fmt: (v) => `${v}x` }),
  R('scoreMul', 'Player', 'Score multiplier (practice only)', 1, 1, 10, 1, { fmt: (v) => `${v}x` }),
  // ---- Powers
  T('infBoards', 'Powers', 'Infinite hoverboards'),
  R('boardTime', 'Powers', 'Hoverboard duration (s)', 30, 10, 180, 5, { fmt: (v) => `${v}s` }),
  T('permMagnet', 'Powers', 'Permanent coin magnet'),
  T('permSneakers', 'Powers', 'Permanent super sneakers'),
  T('permMult', 'Powers', 'Permanent double score'),
  R('magnetRange', 'Powers', 'Magnet range', 1, 0.5, 4, 0.1, { fmt: x }),
  B('actJet', 'Powers', 'Launch jetpack now'),
  B('actMagnet', 'Powers', 'Activate magnet now'),
  B('actBoard', 'Powers', 'Spawn a hoverboard ride now'),
  // ---- Speed
  R('speedMul', 'Speed', 'Speed multiplier', 1, 0.4, 2, 0.05, { fmt: x }),
  T('lockSpeed', 'Speed', 'Lock the speed'),
  R('lockValue', 'Speed', 'Locked speed (m/s)', 24, 8, 60, 1, { fmt: (v) => `${v}` }),
  T('noProgress', 'Speed', 'Disable speed progression'),
  R('startPct', 'Speed', 'Start at % of the ramp', 0, 0, 300, 10, { fmt: (v) => `${v}%` }),
  R('timeScale', 'Speed', 'Time scale (slow-mo)', 1, 0.2, 1.5, 0.05, { fmt: x }),
  T('instantSpeed', 'Speed', 'No acceleration smoothing'),
  // ---- Bot
  T('bot', 'Bot', 'Pro bot drives for you', false, { hint: 'Lookahead planner: precise jumps and rolls, early lane choice, coin chasing, board saves.' }),
  T('botGod', 'Bot', 'Bot is invincible', true, { taint: false }),
  S('botStyle', 'Bot', 'Bot style', 'pro', [['pro', 'Pro (flawless)'], ['coins', 'Coin hunter'], ['safe', 'Safe & steady'], ['show', 'Show-off (jump-roll combos)']], { taint: false }),
  R('botReact', 'Bot', 'Bot reaction delay (ms)', 0, 0, 400, 10, { fmt: (v) => `${v}`, taint: false }),
  T('botBoards', 'Bot', 'Bot uses hoverboards to save itself', true, { taint: false }),
  T('botTag', 'Bot', 'Show "BOT" badge', true, { taint: false }),
  // ---- World
  S('forceMap', 'World', 'Force map', '', [['', 'Selected map'], ['city', 'Rail Yard'], ['snow', 'Snow'], ['tropic', 'Tropic'], ['desert', 'Desert'], ['neon', 'Neon'], ['tour', 'World Tour']]),
  S('timeOfDay', 'World', 'Time of day', 'auto', [['auto', 'Automatic'], ['day', 'Always day'], ['sunset', 'Always sunset'], ['night', 'Always night']], { taint: false }),
  T('winterPreview', 'World', 'Preview Winter Fest theme', false, { taint: false, hint: 'Visual only: no rewards or items.' }),
  R('fogScale', 'World', 'Fog distance', 1, 0.4, 3, 0.1, { fmt: x, taint: false }),
  T('wireframe', 'World', 'Wireframe world', false, { taint: false }),
  // ---- Look
  R('runnerSize', 'Look', 'Runner size', 1, 0.4, 2.5, 0.05, { fmt: x, taint: false }),
  R('bigHead', 'Look', 'Head size', 1, 0.6, 2.5, 0.05, { fmt: x, taint: false }),
  T('disco', 'Look', 'Disco colours', false, { taint: false }),
  T('grayscale', 'Look', 'Black & white', false, { taint: false }),
  T('sepia', 'Look', 'Old film', false, { taint: false }),
  T('invert', 'Look', 'Negative', false, { taint: false }),
  T('vivid', 'Look', 'Extra vivid', false, { taint: false }),
  T('retro', 'Look', 'Retro pixels', false, { taint: false }),
  T('mirror', 'Look', 'Mirror world', false, { taint: false }),
  T('upsideDown', 'Look', 'Upside-down', false, { taint: false }),
  T('hideHud', 'Look', 'Hide the HUD', false, { taint: false }),
  T('hideRunner', 'Look', 'Invisible runner', false, { taint: false }),
  // ---- Camera
  R('camHeight', 'Camera', 'Camera height', 1, 0.5, 2.2, 0.05, { fmt: x, taint: false }),
  R('camBack', 'Camera', 'Camera distance', 1, 0.5, 2.5, 0.05, { fmt: x, taint: false }),
  R('camSpin', 'Camera', 'Orbit speed', 0, 0, 2, 0.05, { fmt: x, taint: false }),
  T('topDown', 'Camera', 'Top-down view', false, { taint: false }),
  T('sideView', 'Camera', 'Side view', false, { taint: false }),
  R('camFov', 'Camera', 'Extra FOV', 0, -10, 40, 1, { fmt: (v) => `${v > 0 ? '+' : ''}${v}°`, taint: false }),
  // ---- Duel (practice arena)
  T('duelInfAmmo', 'Duel', 'Infinite ammo'),
  T('duelGod', 'Duel', 'Take no damage'),
  S('duelBot', 'Duel', 'Practice bot level', 'normal', [['dummy', 'Training dummy'], ['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['pro', 'Pro']], { taint: false }),
  R('duelRate', 'Duel', 'Fire-rate scale', 1, 0.5, 3, 0.1, { fmt: x }),
  T('duelBigHead', 'Duel', 'Big headshot hitbox'),
  T('duelHitbox', 'Duel', 'Show bot hitbox', false, { taint: false }),
  T('duelSlowKill', 'Duel', 'Slow-motion finish', false, { taint: false }),
  // ---- Tools
  T('debug', 'Tools', 'Debug overlay', false, { taint: false }),
  B('instantDie', 'Tools', 'End the run now'),
  B('unload', 'Tools', 'Unload: turn everything off and go back online', { taint: false }),
  B('resetAll', 'Tools', 'Reset every option', { taint: false }),
  B('lockMenu', 'Tools', 'Lock the secret menu again', { taint: false }),
];

const KEY = 'rs.secret.v1';
export const cheats = Object.fromEntries(OPTIONS.filter((o) => o.t !== 'button').map((o) => [o.id, o.def]));
try { Object.assign(cheats, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* storage unavailable */ }
export const unlocked = () => { try { return localStorage.getItem('rs.secret.unlocked') === '1'; } catch { return false; } };
export const setUnlocked = (v) => { try { localStorage.setItem('rs.secret.unlocked', v ? '1' : '0'); } catch { /* ignore */ } };
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(cheats)); } catch { /* ignore */ } };
export function resetAll() { for (const o of OPTIONS) if (o.t !== 'button') cheats[o.id] = o.def; persist(); }

// A session is "practice" (nothing banked / submitted / ranked) as soon as one gameplay option is off its default.
export const tainted = () => OPTIONS.some((o) => o.taint && o.t !== 'button' && cheats[o.id] !== o.def)
  || !!cheats.bot; // the bot always makes it a practice run, even in "invincible: off" mode
export const groupActive = (g) => OPTIONS.filter((o) => o.g === g && o.t !== 'button' && cheats[o.id] !== o.def).length;
export const activeCount = () => OPTIONS.filter((o) => o.t !== 'button' && cheats[o.id] !== o.def).length;

export function konamiListener(onTrigger) {
  let i = 0;
  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === KONAMI[i]) { i++; if (i === KONAMI.length) { i = 0; onTrigger(); } } else i = k === KONAMI[0] ? 1 : 0;
  }, true);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Renders one group. `onChange(id, value)` after each edit; `onButton(id)` for buttons.
export function renderGroup(body, group, onChange, onButton, query = '') {
  const q = String(query).trim().toLowerCase(); // a search looks through every group
  const items = q ? OPTIONS.filter((o) => `${o.label} ${o.g} ${o.hint || ''}`.toLowerCase().includes(q)) : OPTIONS.filter((o) => o.g === group);
  if (!items.length) { body.innerHTML = '<p class="empty">No option matches.</p>'; return; }
  body.innerHTML = items.map((o) => {
    const v = cheats[o.id];
    let ctl = '';
    if (o.t === 'toggle') ctl = `<label class="sw"><input type="checkbox" data-k="${o.id}" ${v ? 'checked' : ''}><i></i></label>`;
    else if (o.t === 'select') ctl = `<select data-k="${o.id}">${o.opts.map(([val, n]) => `<option value="${esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    else if (o.t === 'range') ctl = `<input type="range" data-k="${o.id}" min="${o.min}" max="${o.max}" step="${o.step}" value="${v}"><output data-o="${o.id}">${o.fmt(v)}</output>`;
    else ctl = `<button class="btn sm" data-b="${o.id}">GO</button>`;
    return `<div class="set-row${cheats[o.id] !== o.def && o.t !== 'button' ? ' on' : ''}"><span>${esc(o.label)}${q ? `<i class="sec-g">${esc(o.g)}</i>` : ''}${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</span><div class="set-ctl">${ctl}</div></div>`;
  }).join('');
  for (const el of body.querySelectorAll('[data-k]')) {
    const o = OPTIONS.find((q) => q.id === el.dataset.k);
    el.addEventListener(o.t === 'range' ? 'input' : 'change', () => {
      const val = o.t === 'toggle' ? el.checked : o.t === 'range' ? Number(el.value) : el.value;
      cheats[o.id] = val; persist();
      if (o.t === 'range') { const out = body.querySelector(`[data-o="${o.id}"]`); if (out) out.textContent = o.fmt(val); }
      onChange(o.id, val);
    });
  }
  for (const b of body.querySelectorAll('[data-b]')) b.onclick = () => onButton(b.dataset.b);
}
