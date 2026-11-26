// Unit tests for the performance manager (GPU tiers, adaptive resolution, frame stats). No browser needed.
import { detectTier, AdaptiveRes, FrameStats, PRESETS, presetOf, benchmarkTier } from '../src/perf.js';
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('PASS ', name, extra); } else { fail++; console.log('FAIL ', name, extra); } };

// ---- GPU tiers
const tier = (n, env) => detectTier(n, env).tier;
ok(tier('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)') === 'high', 'RTX card is high');
ok(tier('ANGLE (AMD, AMD Radeon RX 6600 Direct3D11)') === 'high', 'Radeon RX is high');
ok(tier('Apple M2') === 'high', 'Apple silicon is high');
ok(tier('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)') === 'medium', 'Intel UHD is medium');
ok(tier('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)') === 'medium', 'Intel Iris Xe is medium');
ok(tier('ANGLE (Intel, Intel(R) HD Graphics 4000 Direct3D11)') === 'low', 'old Intel HD is low');
ok(tier('Google SwiftShader') === 'potato', 'SwiftShader (software) gets the Potato preset');
ok(tier('llvmpipe (LLVM 15.0.7, 256 bits)') === 'potato', 'llvmpipe gets the Potato preset');
ok(tier('Mali-G78', { mobile: true }) === 'medium', 'modern phone is medium');
ok(tier('Mali-G52', { mobile: true, cores: 4, memory: 3 }) === 'low', 'low-end phone is low');
ok(tier('NVIDIA GeForce RTX 4070', { cores: 2, memory: 8 }) === 'medium', 'strong GPU on a 2-core CPU is held at medium');
ok(tier('') === 'high', 'unknown GPU string does not penalise the player');
ok(Object.keys(PRESETS).every((k) => PRESETS[k].shadowRes > 0 && PRESETS[k].prCap > 0), 'every preset is complete');
ok(presetOf('nope') === PRESETS.high && PRESETS.low.shadows === false && PRESETS.low.post === false, 'unknown preset falls back to high; Performance has no shadows or post');
ok(PRESETS.potato && !PRESETS.potato.post && !PRESETS.potato.shadows && PRESETS.potato.prCap < 1 && PRESETS.potato.weather === 0, 'Potato is the cheapest preset');

// ---- startup benchmark: frame time -> preset, never above the GPU tier
ok(benchmarkTier(50, 'high', 'high') === 'low', '20 fps on High drops two steps');
ok(benchmarkTier(35, 'high', 'high') === 'medium', '28 fps on High drops one step');
ok(benchmarkTier(16, 'high', 'high') === 'high', '60 fps keeps High');
ok(benchmarkTier(10, 'medium', 'high') === 'high', 'a fast machine can move up');
ok(benchmarkTier(10, 'low', 'medium') === 'medium', 'never above the detected GPU tier');
ok(benchmarkTier(80, 'potato', 'high') === 'potato', 'never below Potato');

// ---- adaptive resolution: feed frames of a fixed duration, one second at a time
const run = (a, ms, seconds, budget = 16.7) => { let last = null; const frames = Math.round((seconds * 1000) / ms); for (let i = 0; i < frames; i++) { const r = a.push(ms, budget); if (r !== null) last = r; } return last; };
let a = new AdaptiveRes({ min: 0.55 });
run(a, 16.7, 10);
ok(a.k === 1, 'a steady 60 fps keeps full resolution');
run(a, 40, 3);
ok(a.k < 1, 'sustained 25 fps lowers the resolution', `k=${a.k}`);
run(a, 40, 60);
ok(Math.abs(a.k - 0.55) < 1e-6, 'it never goes below the minimum', `k=${a.k}`);
run(a, 14, 12);
ok(a.k > 0.55, 'with headroom it probes back up', `k=${a.k}`);
// a single hitch must not trigger anything
a = new AdaptiveRes();
for (let i = 0; i < 59; i++) a.push(16.7, 16.7);
a.push(900, 16.7); // clamped to 250 ms
for (let i = 0; i < 200; i++) a.push(16.7, 16.7);
ok(a.k === 1, 'one long hitch (tab switch, GC) is ignored');
// failed probes back off: the interval between probes grows
a = new AdaptiveRes({ min: 0.5 });
run(a, 40, 4); const low = a.k;
let probes = 0, t = 0, lastProbe = 0; const gaps = [];
for (let s = 0; s < 400; s++) { // alternate: 60 fps frames when the scale is at the low value, slow when above it
  const ms = a.k > low + 1e-6 ? 40 : 14;
  const r = run(a, ms, 1);
  if (r !== null && r > low + 1e-6) { probes++; gaps.push(s - lastProbe); lastProbe = s; }
  t++;
}
ok(probes >= 2 && gaps[gaps.length - 1] > gaps[1], 'repeated failed probes back off', `probes=${probes} gaps=${gaps.slice(0, 6).join(',')}`);

// ---- frame stats
const fs = new FrameStats(120);
ok(fs.summary() === null, 'no summary before enough frames');
for (let i = 0; i < 120; i++) fs.push(i === 60 ? 100 : 10);
const s = fs.summary();
ok(s.fps >= 90 && s.fps <= 100 && s.low1 <= 12, '1% low reveals the stutter', JSON.stringify({ fps: s.fps, low1: s.low1 }));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
