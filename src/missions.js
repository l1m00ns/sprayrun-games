import { save, persist } from './save.js';
import { randInt, shuffle } from './util.js';

// Mission templates. `scale(level)` returns the target for a given mission level.
const TEMPLATES = [
  { id: 'coins', text: (n) => `Collect ${n} coins`, scale: (l) => 120 + l * 90, event: 'coins' },
  { id: 'dist', text: (n) => `Run ${n} meters`, scale: (l) => 800 + l * 500, event: 'dist' },
  { id: 'jump', text: (n) => `Jump ${n} times`, scale: (l) => 15 + l * 10, event: 'jump' },
  { id: 'roll', text: (n) => `Roll ${n} times`, scale: (l) => 12 + l * 8, event: 'roll' },
  { id: 'power', text: (n) => `Collect ${n} power-ups`, scale: (l) => 3 + l * 2, event: 'power' },
  { id: 'lane', text: (n) => `Change lanes ${n} times`, scale: (l) => 40 + l * 25, event: 'lane' },
  { id: 'board', text: (n) => `Use a hoverboard ${Math.max(1, Math.floor(n))} time${n > 1 ? 's' : ''}`, scale: (l) => 1 + Math.floor(l / 3), event: 'board' },
  { id: 'score', text: (n) => `Score ${n} points in one run`, scale: (l) => 3000 + l * 2500, event: 'score', max: true },
  { id: 'roof', text: (n) => `Run ${n} meters on train roofs`, scale: (l) => 80 + l * 60, event: 'roof' },
  { id: 'jetpack', text: (n) => `Fly with the jetpack ${n} time${n > 1 ? 's' : ''}`, scale: (l) => 1 + Math.floor(l / 2), event: 'jetpack' },
];
const ACTIVE = () => TEMPLATES.filter((t) => !t.retired);

function roundTarget(n) {
  if (n >= 1000) return Math.round(n / 100) * 100;
  if (n >= 100) return Math.round(n / 10) * 10;
  return n;
}

function makeSet(level) {
  const picks = shuffle(ACTIVE()).slice(0, 3);
  return picks.map((t) => ({ id: t.id, target: roundTarget(t.scale(level)), progress: 0, done: false, reward: 150 + level * 60 }));
}

export function ensureMissions() {
  if (!save.missions || !save.missions.length) {
    save.missions = makeSet(save.level);
    persist();
  } else if (save.missions.some((m) => (templateOf(m.id) || { retired: true }).retired && !m.done)) {
    // a mission whose template was retired (roof running) is swapped for a fresh one the player does not already have
    const have = new Set(save.missions.map((m) => m.id));
    save.missions = save.missions.map((m) => {
      if (!((templateOf(m.id) || { retired: true }).retired && !m.done)) return m;
      const t = shuffle(ACTIVE().filter((x) => !have.has(x.id)))[0] || ACTIVE()[0];
      have.add(t.id);
      return { id: t.id, target: roundTarget(t.scale(save.level)), progress: 0, done: false, reward: 150 + save.level * 60 };
    });
    persist();
  }
}

export function templateOf(id) { return TEMPLATES.find((t) => t.id === id); }
export function missionText(m) { return templateOf(m.id).text(m.target); }

// Report an event; returns the list of newly completed missions.
export function report(event, amount = 1) {
  const done = [];
  for (const m of save.missions) {
    if (m.done) continue;
    const t = templateOf(m.id);
    if (t.event !== event) continue;
    if (t.max) m.progress = Math.max(m.progress, amount);
    else m.progress += amount;
    if (m.progress >= m.target) {
      m.progress = m.target;
      m.done = true;
      save.coins += m.reward;
      done.push(m);
    }
  }
  return done;
}

// If all three are done, advance a level and roll a new set. Returns true on level-up.
export function advanceIfComplete() {
  if (save.missions.every((m) => m.done)) {
    save.level++;
    save.missions = makeSet(save.level);
    persist();
    return true;
  }
  return false;
}
