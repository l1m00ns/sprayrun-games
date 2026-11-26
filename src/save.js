const KEY = 'sprayrun.save.v1';

const defaults = () => ({
  coins: 0,
  best: 0,
  bestDist: 0,
  bestCoins: 0,
  character: 'rio',
  unlocked: ['rio', 'kit'],
  boards: 2,
  upgrades: { magnet: 0, jetpack: 0, sneakers: 0, mult: 0 },
  missions: null,
  level: 1,
  stats: { runs: 0, coins: 0, dist: 0, jumps: 0, rolls: 0 },
  settings: { music: 0.55, sfx: 0.9, quality: 'high', map: 'city', weather: true, outline: true, shake: true },
  tutorialDone: false,
  tutStep: 0,
  onboarded: false,
});

function merge(base, over) {
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      merge(base[k], over[k]);
    } else {
      base[k] = over[k];
    }
  }
  return base;
}

let data;
try {
  data = merge(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}'));
} catch (e) {
  data = defaults();
}

if (!data.unlocked.includes('rio')) data.unlocked.unshift('rio'); // the free starter hero
export const save = data;
let hook = null;
export const setPersistHook = (fn) => { hook = fn; }; // cloud sync listens here
export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  if (hook) try { hook(); } catch (e) { /* never break gameplay */ }
}
export function resetSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
