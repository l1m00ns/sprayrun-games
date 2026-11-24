// Device signals for fair play (duplicate-account + ban-evasion detection). The server stores keyed hashes only.
// Collected on purpose and disclosed in the welcome screen ("Fair play & privacy"): nothing here reads personal files.
const KEY = 'rs.did';
const rnd = () => { const a = new Uint8Array(18); (self.crypto || window.crypto).getRandomValues(a); return [...a].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 28); };

// A persistent random id, stored twice (localStorage + a first-party cookie) so clearing one of them does not reset it.
export function deviceId() {
  let id = null;
  try { id = localStorage.getItem(KEY); } catch { /* blocked */ }
  if (!id) { const m = /(?:^|; )rs\.did=([^;]+)/.exec(document.cookie || ''); if (m) id = decodeURIComponent(m[1]); }
  if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) id = 'd' + rnd();
  try { localStorage.setItem(KEY, id); } catch { /* blocked */ }
  try { document.cookie = `rs.did=${id}; max-age=${3 * 365 * 86400}; path=/; SameSite=Lax`; } catch { /* blocked */ }
  return id;
}

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };

function gpu() {
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? `${gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)} / ${gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}` : gl.getParameter(gl.RENDERER);
  } catch { return 'err'; }
}
function canvasPrint() {
  try {
    const c = document.createElement('canvas'); c.width = 220; c.height = 40;
    const g = c.getContext('2d');
    g.textBaseline = 'top'; g.font = '16px Arial'; g.fillStyle = '#f60'; g.fillRect(100, 2, 60, 22);
    g.fillStyle = '#069'; g.fillText('Reverse Surfers 123 ⚡', 4, 8); g.strokeStyle = 'rgba(102,204,0,.7)'; g.arc(160, 20, 14, 0, 6.28); g.stroke();
    return hash(c.toDataURL());
  } catch { return 'err'; }
}
function fonts() {
  try {
    const probe = 'mmmmmmmmmmlli', base = ['monospace', 'sans-serif', 'serif'], list = ['Arial', 'Calibri', 'Cambria', 'Consolas', 'Georgia', 'Impact', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Verdana', 'Comic Sans MS', 'Courier New', 'Helvetica', 'Menlo', 'Ubuntu', 'Roboto'];
    const c = document.createElement('canvas').getContext('2d');
    const w = (f) => { c.font = `72px ${f}`; return c.measureText(probe).width; };
    const bw = base.map((b) => w(b));
    return list.filter((f) => base.some((b, i) => w(`'${f}',${b}`) !== bw[i])).join(',');
  } catch { return 'err'; }
}
function audioPrint() {
  return new Promise((resolve) => {
    try {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OAC) return resolve('none');
      const ctx = new OAC(1, 4410, 44100), osc = ctx.createOscillator(), comp = ctx.createDynamicsCompressor();
      osc.type = 'triangle'; osc.frequency.value = 10000; osc.connect(comp); comp.connect(ctx.destination); osc.start(0);
      const t = setTimeout(() => resolve('timeout'), 1500);
      ctx.oncomplete = (e) => { clearTimeout(t); const d = e.renderedBuffer.getChannelData(0); let s = 0; for (let i = 3000; i < 3600; i++) s += Math.abs(d[i]); resolve(hash(String(s))); };
      ctx.startRendering();
    } catch { resolve('err'); }
  });
}

let cached = null;
export async function collect() {
  if (cached) return cached;
  const n = navigator, s = screen;
  const signals = {
    tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })(),
    lang: n.language || '', langs: (n.languages || []).join(','), screen: `${s.width}x${s.height}x${s.colorDepth}`, dpr: window.devicePixelRatio || 1,
    cores: n.hardwareConcurrency || 0, mem: n.deviceMemory || 0, platform: n.platform || '', touch: n.maxTouchPoints || 0, ua: n.userAgent || '', webdriver: !!n.webdriver,
    gpu: gpu(), canvas: canvasPrint(), fonts: fonts(), audio: await audioPrint(),
  };
  cached = { did: deviceId(), signals };
  return cached;
}
