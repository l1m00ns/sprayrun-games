// Performance manager: graphics presets, GPU tier detection, adaptive resolution and frame statistics.
// Pure logic (no THREE import) so it can be unit-tested; src/main.js applies the numbers to the renderer.

// What each preset switches on. `post` = bloom + cartoon outlines (EffectComposer, the expensive part).
export const PRESETS = {
  high:   { label: 'High',        post: true,  shadows: true,  shadowRes: 2048, prCap: 2,   particles: 1,    weather: 1,   birds: true,  aniso: 8, menuFps: 0 },
  medium: { label: 'Balanced',    post: false, shadows: true,  shadowRes: 1024, prCap: 1.5, particles: 0.7,  weather: 0.7, birds: true,  aniso: 4, menuFps: 0 },
  low:    { label: 'Performance', post: false, shadows: false, shadowRes: 512,  prCap: 1,   particles: 0.45, weather: 0.45, birds: false, aniso: 1, menuFps: 30 },
};
export const presetOf = (q) => PRESETS[q] || PRESETS.high;

// ---- GPU tier. Conservative: only clear cases drop below "high", and a weak machine is never pushed to "high".
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|mesa offscreen|virgl|vmware|parallels|virtualbox/;
const LOW_GPU = /intel.*(?:(?<!u)hd graphics(?! ?[56]\d\d\b)|gma)|mali-(4|t6|t7)|adreno.*\b(2|3|4)\d\d\b|adreno.*\b5(0|1|2)\d\b|powervr|vivante|videocore|geforce (g|gt) ?\d{3}\b|radeon (hd|r[2-5]) |radeon\(tm\) (r[2-5]|hd)|geforce [0-9]{3}m/;
const MID_GPU = /intel.*(uhd|iris|xe|hd graphics [56]\d\d)|mali-g|adreno.*\b(6|7)\d\d\b|radeon.*(vega|graphics)|geforce (gtx )?(7|9)\d\d|gtx 10(3|5)0|mx ?\d{3}|apple a(1[0-3])\b/;

export function gpuName(gl) {
  try {
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    return String(e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
  } catch { return ''; }
}

// Returns { tier: 'low'|'medium'|'high', name, why }
export function detectTier(name = '', env = {}) {
  const n = String(name).toLowerCase();
  const { mobile = false, cores = 8, memory = 8 } = env;
  let tier = 'high', why = 'dedicated or modern graphics card';
  if (SOFTWARE.test(n)) { tier = 'low'; why = 'software rendering (no GPU acceleration)'; }
  else if (LOW_GPU.test(n)) { tier = 'low'; why = 'entry-level graphics chip'; }
  else if (MID_GPU.test(n) || mobile) { tier = 'medium'; why = mobile ? 'phone or tablet' : 'integrated or mid-range graphics'; }
  if (tier === 'high' && (cores <= 2 || memory <= 2)) { tier = 'medium'; why = 'limited CPU or memory'; }
  if (tier === 'medium' && mobile && (cores <= 4 || memory <= 3)) { tier = 'low'; why = 'low-end phone'; }
  return { tier, name: name || 'unknown', why };
}

// ---- Adaptive resolution: keeps the frame rate by lowering the render scale when frames run late, and probes back up
// (with exponential back-off, so it does not flip-flop) when there is headroom.
export class AdaptiveRes {
  constructor({ min = 0.6, step = 0.1, window = 1000 } = {}) {
    this.min = min; this.step = step; this.window = window;
    this.k = 1; // current multiplier, 1 = the user's chosen resolution
    this.reset();
  }
  reset() {
    this.sum = 0; this.n = 0; this.t = 0; this.bad = 0; this.good = 0;
    this.backoff = 4; this.lastUp = -1e9; this.now = 0; // seconds of probing back-off
  }
  // ms = duration of the last frame, budget = target frame time (ms). Returns the new multiplier when it changes, else null.
  push(ms, budget) {
    ms = Math.min(ms, 250); // a hitch (tab switch, GC, shader compile) must not count as a slow second
    this.sum += ms; this.n++; this.t += ms; this.now += ms / 1000;
    if (this.t < this.window) return null;
    const avg = this.sum / this.n;
    this.sum = 0; this.n = 0; this.t = 0;
    if (avg > budget * 1.3) {
      this.good = 0; this.bad++;
      if ((this.bad >= 2 || avg > budget * 2) && this.k > this.min + 1e-6) {
        this.bad = 0;
        if (this.now - this.lastUp < 8) this.backoff = Math.min(this.backoff * 2, 120); // the last probe up failed: wait longer
        this.k = Math.max(this.min, +(this.k - this.step).toFixed(3));
        return this.k;
      }
    } else if (avg <= budget * 1.08) {
      this.bad = 0; this.good++;
      if (this.k < 1 - 1e-6 && this.good >= this.backoff) {
        this.good = 0; this.lastUp = this.now;
        this.k = Math.min(1, +(this.k + this.step / 2).toFixed(3));
        return this.k;
      }
      if (this.k >= 1 - 1e-6 || this.now - this.lastUp > 40) this.backoff = Math.max(4, this.backoff / 2); // stable: forget the penalty
    } else this.bad = 0;
    return null;
  }
}

// ---- Frame statistics for the FPS meter: average, 1% low and the worst frame over the last ~2 s.
export class FrameStats {
  constructor(size = 240) { this.buf = new Float32Array(size); this.i = 0; this.n = 0; }
  push(ms) { this.buf[this.i] = ms; this.i = (this.i + 1) % this.buf.length; this.n = Math.min(this.n + 1, this.buf.length); }
  summary() {
    if (this.n < 10) return null;
    const a = Array.from(this.buf.subarray(0, this.n)).sort((x, y) => x - y);
    const avg = a.reduce((s, v) => s + v, 0) / a.length;
    const worst = a.slice(a.length - Math.max(1, Math.round(a.length * 0.01)));
    const low = worst.reduce((s, v) => s + v, 0) / Math.max(1, worst.length);
    return { fps: Math.round(1000 / avg), ms: avg, low1: Math.round(1000 / low) };
  }
}
