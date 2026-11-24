// Fully synthesized audio: SFX + a procedural music loop. No samples are used.
let ctx = null;
let master, sfxBus, musicBus;
let sfxVol = 0.9, musicVol = 0.55;
let noiseBuf = null;

export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = musicVol * 0.5; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function resumeAudio() { if (ctx && ctx.state !== 'running') ctx.resume(); }
export function setVolumes(m, s) {
  musicVol = m; sfxVol = s;
  if (ctx) { musicBus.gain.value = m * 0.5; sfxBus.gain.value = s; }
}

function osc(type, freq, t0, dur, vol, dest = sfxBus, opts = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + (opts.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  let out = g;
  if (opts.filter) {
    const f = ctx.createBiquadFilter();
    f.type = opts.filter; f.frequency.value = opts.ff ?? 1200; f.Q.value = opts.q ?? 1;
    g.connect(f); out = f;
  }
  out.connect(dest);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(t0, dur, vol, ftype, f0, f1, dest = sfxBus, q = 1) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = ftype; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t0); s.stop(t0 + dur + 0.05);
}

let coinStep = 0, coinTime = 0;
export const sfx = {
  coin() {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (t - coinTime > 0.5) coinStep = 0;
    coinTime = t;
    const base = 880 * Math.pow(2, (coinStep % 8) / 12 * 2);
    coinStep++;
    osc('square', base, t, 0.09, 0.09, sfxBus, { filter: 'lowpass', ff: 5000 });
    osc('square', base * 1.5, t + 0.055, 0.2, 0.09, sfxBus, { filter: 'lowpass', ff: 5000 });
  },
  jump() { if (!ctx) return; const t = ctx.currentTime; osc('sine', 260, t, 0.22, 0.2, sfxBus, { to: 620 }); noise(t, 0.12, 0.05, 'highpass', 800, 2500); },
  land() { if (!ctx) return; const t = ctx.currentTime; osc('sine', 110, t, 0.16, 0.3, sfxBus, { to: 50 }); noise(t, 0.08, 0.08, 'lowpass', 900, 200); },
  roll() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.45, 0.16, 'bandpass', 500, 2400, sfxBus, 0.8); },
  lane() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.14, 0.09, 'bandpass', 1500, 600, sfxBus, 1.2); },
  stumble() { if (!ctx) return; const t = ctx.currentTime; osc('sawtooth', 160, t, 0.3, 0.22, sfxBus, { to: 60, filter: 'lowpass', ff: 900 }); noise(t, 0.2, 0.2, 'lowpass', 1500, 200); },
  crash() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.8, 0.45, 'lowpass', 3000, 90); osc('sawtooth', 120, t, 0.7, 0.3, sfxBus, { to: 30, filter: 'lowpass', ff: 700 }); osc('square', 523, t + 0.05, 0.4, 0.06, sfxBus, { to: 130 }); },
  power() { if (!ctx) return; const t = ctx.currentTime; [523, 659, 784, 1046, 1318].forEach((f, i) => osc('triangle', f, t + i * 0.055, 0.22, 0.16)); },
  board() { if (!ctx) return; const t = ctx.currentTime; osc('sawtooth', 200, t, 0.5, 0.16, sfxBus, { to: 900, filter: 'lowpass', ff: 1800 }); noise(t, 0.4, 0.07, 'bandpass', 600, 3000); },
  boardBreak() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.5, 0.35, 'bandpass', 3000, 300, sfxBus, 0.7); osc('square', 700, t, 0.3, 0.12, sfxBus, { to: 90 }); },
  click() { if (!ctx) return; const t = ctx.currentTime; osc('square', 660, t, 0.06, 0.08, sfxBus, { filter: 'lowpass', ff: 3000 }); osc('square', 990, t + 0.04, 0.08, 0.07, sfxBus, { filter: 'lowpass', ff: 3000 }); },
  buy() { if (!ctx) return; const t = ctx.currentTime; [784, 988, 1175, 1568].forEach((f, i) => osc('triangle', f, t + i * 0.07, 0.25, 0.14)); },
  deny() { if (!ctx) return; const t = ctx.currentTime; osc('square', 180, t, 0.14, 0.12, sfxBus, { to: 120 }); osc('square', 140, t + 0.12, 0.18, 0.12, sfxBus, { to: 90 }); },
  mission() { if (!ctx) return; const t = ctx.currentTime; [659, 784, 988, 1318].forEach((f, i) => osc('square', f, t + i * 0.09, 0.2, 0.09, sfxBus, { filter: 'lowpass', ff: 4000 })); },
  siren() { if (!ctx) return; const t = ctx.currentTime; osc('sine', 700, t, 0.25, 0.12, sfxBus, { to: 950 }); osc('sine', 950, t + 0.25, 0.25, 0.12, sfxBus, { to: 700 }); },
  bark() { if (!ctx) return; const t = ctx.currentTime; osc('sawtooth', 380, t, 0.12, 0.2, sfxBus, { to: 170, filter: 'lowpass', ff: 1200 }); osc('sawtooth', 340, t + 0.18, 0.12, 0.17, sfxBus, { to: 150, filter: 'lowpass', ff: 1200 }); },
  whistle() { if (!ctx) return; const t = ctx.currentTime; osc('sine', 2400, t, 0.35, 0.1, sfxBus, { to: 2700 }); },
  thunder() { if (!ctx) return; const t = ctx.currentTime; noise(t, 1.6, 0.5, 'lowpass', 600, 60, sfxBus, 0.7); noise(t + 0.15, 1.2, 0.3, 'lowpass', 300, 40, sfxBus, 0.5); osc('sawtooth', 55, t, 1.2, 0.18, sfxBus, { to: 30, filter: 'lowpass', ff: 200 }); },
  spray() { if (!ctx) return; noise(ctx.currentTime, 0.16, 0.07, 'highpass', 3500, 6500, sfxBus, 0.6); },
  horn() { if (!ctx) return; const t = ctx.currentTime; osc('sawtooth', 220, t, 0.7, 0.14, sfxBus, { filter: 'lowpass', ff: 900 }); osc('sawtooth', 277, t, 0.7, 0.12, sfxBus, { filter: 'lowpass', ff: 900 }); },
  // ---- Gold Rush duel
  gunshot(far = false) {
    if (!ctx) return; const t = ctx.currentTime, v = far ? 0.45 : 1;
    noise(t, 0.12, 0.5 * v, 'lowpass', 9000, 1200, sfxBus, 0.8);
    noise(t, 0.4, 0.26 * v, 'lowpass', 2600, 180, sfxBus, 0.7);
    osc('sine', 170, t, 0.24, 0.5 * v, sfxBus, { to: 42 });
    osc('square', 950, t, 0.05, 0.11 * v, sfxBus, { to: 180, filter: 'lowpass', ff: 3200 });
    osc('triangle', 2500, t + 0.02, 0.28, 0.045 * v, sfxBus, { to: 1700 });
  },
  reloadClick(i = 0) { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.05, 0.16, 'highpass', 1800 + i * 500, 5200, sfxBus, 1.4); osc('square', 320 + i * 90, t, 0.05, 0.06, sfxBus, { to: 140, filter: 'lowpass', ff: 1500 }); },
  empty() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.03, 0.12, 'highpass', 3000, 6000, sfxBus, 1.5); },
  hitmark(head = false) { if (!ctx) return; const t = ctx.currentTime; osc('square', head ? 1760 : 1100, t, 0.07, 0.1, sfxBus, { to: head ? 1320 : 900 }); if (head) osc('sine', 2640, t + 0.03, 0.18, 0.1, sfxBus); },
  hurt() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.2, 0.3, 'lowpass', 900, 150, sfxBus, 0.8); osc('sine', 120, t, 0.25, 0.35, sfxBus, { to: 50 }); },
  warp() { if (!ctx) return; const t = ctx.currentTime; osc('sawtooth', 120, t, 1.6, 0.16, sfxBus, { to: 1800, filter: 'lowpass', ff: 2600, attack: 0.3 }); noise(t, 1.5, 0.22, 'bandpass', 300, 6000, sfxBus, 0.9); osc('sine', 60, t + 1.3, 0.8, 0.35, sfxBus, { to: 30 }); },
  beep(f = 880) { if (!ctx) return; osc('square', f, ctx.currentTime, 0.14, 0.09, sfxBus, { filter: 'lowpass', ff: 3000 }); },
  jet: null,
};

// ----------------------------------------------------------------- music
// Minor-key funk groove, 4-bar loop, scheduled with a look-ahead clock.
const BPM = 118;
const STEP = 60 / BPM / 4; // 16th
const ROOTS = [57, 53, 48, 55]; // A, F, C, G (midi)
const CHORDS = [[0, 3, 7, 10], [0, 4, 7, 11], [0, 4, 7, 11], [0, 4, 7, 10]];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const MELODY = [
  [0, 4, 7, 4, 9, 7, 4, 2], [0, 2, 4, 7, 9, 12, 9, 7], [4, 7, 9, 7, 4, 2, 0, 2], [7, 9, 12, 9, 7, 4, 2, 4],
];
let musicOn = false, nextT = 0, stepIdx = 0, timer = null, mood = 'play';

function playStep(i, t) {
  const bar = Math.floor(i / 16) % 4;
  const s = i % 16;
  const root = ROOTS[bar];
  const play = mood === 'play';
  // kick
  if (s % 4 === 0 && play) {
    osc('sine', 150, t, 0.2, 0.55, musicBus, { to: 40 });
  }
  // snare on 2 & 4
  if ((s === 4 || s === 12) && play) {
    noise(t, 0.16, 0.22, 'bandpass', 1800, 900, musicBus, 0.9);
    osc('triangle', 220, t, 0.09, 0.15, musicBus, { to: 120 });
  }
  // hats
  if (s % 2 === 0 || (play && s % 2 === 1 && Math.random() > 0.55)) {
    noise(t, 0.04, s % 4 === 2 ? 0.1 : 0.05, 'highpass', 7000, 9000, musicBus);
  }
  // bass (syncopated)
  const bassPat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
  if (bassPat[s]) {
    const n = root - 24 + (s === 6 || s === 13 ? 12 : 0);
    osc('sawtooth', mtof(n), t, STEP * 1.8, play ? 0.28 : 0.2, musicBus, { filter: 'lowpass', ff: 500, q: 4, attack: 0.01 });
  }
  // chord stabs
  if ((s === 2 || s === 7 || s === 10 || s === 14) && (play || s === 2)) {
    for (const iv of CHORDS[bar]) {
      osc('square', mtof(root + iv), t, STEP * 1.3, 0.05, musicBus, { filter: 'lowpass', ff: 2200 });
    }
  }
  // lead
  if (play && s % 2 === 0 && (bar % 2 === 1 || s % 4 === 0)) {
    const mel = MELODY[bar];
    const n = mel[(s / 2) % mel.length];
    if (Math.random() > 0.12) osc('triangle', mtof(root + 12 + n), t, STEP * 2.2, 0.15, musicBus, { attack: 0.01 });
  }
  if (!play && s % 4 === 0) {
    // soft pad in menu
    for (const iv of CHORDS[bar]) osc('sine', mtof(root + 12 + iv), t, STEP * 4.5, 0.045, musicBus, { attack: 0.08 });
  }
}

function scheduler() {
  if (!ctx || !musicOn) return;
  while (nextT < ctx.currentTime + 0.18) {
    const swing = stepIdx % 2 === 1 ? STEP * 0.12 : 0;
    playStep(stepIdx, nextT + swing);
    nextT += STEP;
    stepIdx++;
  }
}

export function startMusic(m = 'play') {
  if (!ctx) return;
  mood = m;
  if (musicOn) return;
  musicOn = true;
  nextT = ctx.currentTime + 0.05;
  stepIdx = 0;
  timer = setInterval(scheduler, 40);
}
export function setMood(m) { mood = m; }
export function stopMusic() { musicOn = false; if (timer) clearInterval(timer); timer = null; }

// continuous wind / whoosh bed whose volume follows speed
let windSrc = null, windGain = null, windFilter = null;
export function startWind() {
  if (!ctx || windSrc) return;
  windSrc = ctx.createBufferSource();
  windSrc.buffer = noiseBuf; windSrc.loop = true;
  windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 600; windFilter.Q.value = 0.6;
  windGain = ctx.createGain(); windGain.gain.value = 0;
  windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(sfxBus);
  windSrc.start();
}
export function setWind(level) {
  if (!ctx || !windGain) return;
  windGain.gain.setTargetAtTime(level * 0.12, ctx.currentTime, 0.1);
  windFilter.frequency.setTargetAtTime(400 + level * 1600, ctx.currentTime, 0.1);
}
export function stopWind() { if (windSrc) { try { windSrc.stop(); } catch (e) { /* noop */ } windSrc = null; } }
