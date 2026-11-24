import { mk, toTex, speckle, rr, drawTag } from './textures.js';
import { paintTrainSide } from './graffiti.js';
import { mulberry32 } from './util.js';

const W = 1408, H = 410;
const grime = (ctx, rnd) => {
  for (let i = 0; i < 30; i++) {
    const x = rnd() * W, g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(10,8,6,0.2)'); g.addColorStop(0.55, 'rgba(10,8,6,0)');
    ctx.fillStyle = g; ctx.fillRect(x, 0, 2 + rnd() * 6, H * (0.3 + rnd() * 0.4));
  }
  const g2 = ctx.createLinearGradient(0, H - 110, 0, H);
  g2.addColorStop(0, 'rgba(15,12,8,0)'); g2.addColorStop(1, 'rgba(15,12,8,0.5)');
  ctx.fillStyle = g2; ctx.fillRect(0, H - 110, W, 110);
};
const tag = (ctx, rnd, pals) => {
  const pal = pals[Math.floor(rnd() * pals.length)];
  drawTag(ctx, 200 + rnd() * (W - 400), 340 + rnd() * 24, ['ZAP', 'RUSH', 'NOVA', 'YO!', 'JAM'][Math.floor(rnd() * 5)], 110 + rnd() * 40, pal, (rnd() - 0.5) * 0.18, rnd);
};
const PALS = [['#ff3d71', '#ffd23f', '#1a1a2e'], ['#00e5ff', '#7b4dff', '#10122b'], ['#7dff6b', '#00b86b', '#06231a']];

// Streamlined high-speed car: continuous window band, swoosh livery.
export function texBullet(main, accent, seed, graffiti = true) {
  const [c, ctx] = mk(W, H);
  const rnd = mulberry32(seed * 17 + 3);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, main); g.addColorStop(1, '#8e98a8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // swoosh
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.moveTo(0, 250); ctx.bezierCurveTo(400, 190, 900, 330, W, 220); ctx.lineTo(W, 290); ctx.bezierCurveTo(900, 390, 400, 260, 0, 320); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.moveTo(0, 236); ctx.bezierCurveTo(400, 176, 900, 316, W, 206); ctx.lineTo(W, 214); ctx.bezierCurveTo(900, 324, 400, 184, 0, 244); ctx.fill();
  // window band
  ctx.fillStyle = '#0c1830'; rr(ctx, 40, 66, W - 80, 104, 46); ctx.fill();
  const wg = ctx.createLinearGradient(0, 66, 0, 170); wg.addColorStop(0, '#3d5f8f'); wg.addColorStop(1, '#0c1830');
  ctx.fillStyle = wg; rr(ctx, 48, 72, W - 96, 92, 40); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let x = 90; x < W - 100; x += 210) { ctx.beginPath(); ctx.moveTo(x, 160); ctx.lineTo(x + 50, 76); ctx.lineTo(x + 80, 76); ctx.lineTo(x + 30, 160); ctx.fill(); }
  ctx.fillStyle = main; for (let x = 150; x < W - 100; x += 210) ctx.fillRect(x, 66, 10, 104);
  // doors
  ctx.strokeStyle = 'rgba(30,40,60,0.55)'; ctx.lineWidth = 3;
  for (const x of [330, 1010]) { ctx.strokeRect(x, 60, 70, 270); ctx.strokeRect(x + 70, 60, 70, 270); }
  ctx.fillStyle = '#1c2438'; ctx.font = '40px "Lilita One", Impact, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SKYLINER', W * 0.5, 372);
  ctx.fillStyle = '#1c2438'; ctx.fillRect(0, H - 40, W, 40);
  if (graffiti && rnd() > 0.4) tag(ctx, rnd, PALS);
  grime(ctx, rnd);
  return toTex(c);
}

export function texLoco(main, accent, num, seed) {
  const [c, ctx] = mk(W, H);
  const rnd = mulberry32(seed * 29 + 1);
  ctx.fillStyle = main; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, W, 30);
  ctx.fillStyle = '#23262f'; ctx.fillRect(0, H - 70, W, 70);
  // diagonal stripe
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.moveTo(0, 270); ctx.lineTo(W, 150); ctx.lineTo(W, 210); ctx.lineTo(0, 330); ctx.fill();
  ctx.fillStyle = '#1b1d24'; ctx.fillRect(0, 50, W, 8);
  // radiator grilles
  for (const x of [120, 520, 760, 1160]) {
    ctx.fillStyle = '#16181f'; rr(ctx, x, 80, 200, 150, 10); ctx.fill();
    ctx.strokeStyle = '#3a3f4c'; ctx.lineWidth = 4;
    for (let y = 92; y < 224; y += 14) { ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + 190, y); ctx.stroke(); }
  }
  // cab window + door
  ctx.fillStyle = '#0c1830'; rr(ctx, 380, 76, 110, 110, 14); ctx.fill(); rr(ctx, 910, 76, 110, 110, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 4; ctx.strokeRect(370, 66, 130, 270); ctx.strokeRect(900, 66, 130, 270);
  ctx.fillStyle = '#fff'; ctx.font = '60px "Lilita One", Impact, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(String(num), W * 0.5, 300);
  speckle(ctx, rnd, W, H, 500, ['rgba(0,0,0,0.3)'], 2, 8, 0.4);
  if (rnd() > 0.5) tag(ctx, rnd, PALS);
  grime(ctx, rnd);
  return toTex(c);
}

export function texMaglev(c1, c2, seed) {
  const [c, ctx] = mk(W, H);
  const [e, ectx] = mk(W, H);
  const rnd = mulberry32(seed * 41 + 9);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#202642'); g.addColorStop(1, '#0a0d1c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, W, H);
  const glow = (y, h, col) => { ectx.fillStyle = col; ectx.fillRect(0, y, W, h); ctx.fillStyle = '#0a0d1c'; ctx.fillRect(0, y, W, h); };
  glow(48, 8, c1); glow(300, 10, c2); glow(340, 5, c1);
  // window band (lit)
  ctx.fillStyle = '#05070f'; rr(ctx, 60, 80, W - 120, 120, 50); ctx.fill();
  ectx.fillStyle = c1; ectx.globalAlpha = 0.5; rr(ectx, 68, 88, W - 136, 104, 44); ectx.fill(); ectx.globalAlpha = 1;
  ectx.strokeStyle = c1; ectx.lineWidth = 6; rr(ectx, 60, 80, W - 120, 120, 50); ectx.stroke();
  for (let x = 160; x < W - 100; x += 220) { ctx.fillStyle = '#10142a'; ctx.fillRect(x, 80, 14, 120); ectx.fillStyle = '#000'; ectx.fillRect(x, 80, 14, 120); }
  // chevrons
  for (let x = 120; x < W; x += 200) { ectx.strokeStyle = c2; ectx.lineWidth = 7; ectx.beginPath(); ectx.moveTo(x, 232); ectx.lineTo(x + 34, 262); ectx.lineTo(x, 292); ectx.stroke(); }
  ectx.fillStyle = c1; ectx.font = '46px "Lilita One", Impact, sans-serif'; ectx.textAlign = 'center'; ectx.fillText('MAGLEV-9', W * 0.5, 392);
  ctx.fillStyle = '#9fb0d0'; ctx.font = '46px "Lilita One", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MAGLEV-9', W * 0.5, 392);
  void rnd;
  return { map: toTex(c), emissive: toTex(e) };
}

export function texCaboose(seed) {
  const [c, ctx] = mk(W, H);
  const rnd = mulberry32(seed * 7 + 11);
  ctx.fillStyle = '#c4332b'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#7a1c18'; ctx.fillRect(0, H - 60, W, 60); ctx.fillRect(0, 0, W, 24);
  ctx.fillStyle = '#f4ead2'; ctx.fillRect(0, 200, W, 16);
  for (const x of [250, 560, 850, 1160]) {
    ctx.fillStyle = '#2a1410'; rr(ctx, x - 6, 70, 124, 106, 12); ctx.fill();
    ctx.fillStyle = '#1b2a44'; rr(ctx, x, 76, 112, 94, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(x + 10, 164); ctx.lineTo(x + 52, 80); ctx.lineTo(x + 76, 80); ctx.lineTo(x + 34, 164); ctx.fill();
  }
  ctx.fillStyle = '#f4ead2'; ctx.font = '54px "Lilita One", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CABOOSE 91', W * 0.5, 292);
  grime(ctx, rnd);
  return toTex(c);
}

// Corrugated shipping container side (used on flatcars).
export function texContainer(color, label, seed) {
  const [c, ctx] = mk(512, 256);
  const rnd = mulberry32(seed * 13 + 5);
  ctx.fillStyle = color; ctx.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 16) { ctx.fillStyle = (x / 16) % 2 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)'; ctx.fillRect(x, 20, 8, 216); }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, 512, 20); ctx.fillRect(0, 236, 512, 20);
  ctx.fillStyle = '#fff'; ctx.font = '70px "Lilita One", Impact, sans-serif'; ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 8; ctx.strokeText(label, 256, 148); ctx.fillText(label, 256, 148);
  speckle(ctx, rnd, 512, 256, 300, ['rgba(80,30,10,0.5)'], 2, 7, 0.5);
  return toTex(c);
}

export function texTankDecal(label, band) {
  const [c, ctx] = mk(256, 128);
  ctx.clearRect(0, 0, 256, 128);
  ctx.fillStyle = band; ctx.fillRect(0, 40, 256, 48);
  ctx.fillStyle = '#fff'; ctx.font = '38px "Lilita One", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, 128, 78);
  return toTex(c);
}

// Refrigerated box car: white, blue band, snowflakes.
export function texReefer() {
  const [c, ctx] = mk(W, H);
  const rnd = mulberry32(55);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c9d3de');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2f7fd0'; ctx.fillRect(0, 196, W, 56);
  ctx.fillStyle = '#8fc4ff'; ctx.fillRect(0, 252, W, 10);
  ctx.fillStyle = '#9aa7b6'; ctx.fillRect(0, H - 60, W, 60);
  for (let x = 40; x < W; x += 88) { ctx.fillStyle = 'rgba(80,100,130,0.22)'; ctx.fillRect(x, 24, 4, 170); }
  ctx.strokeStyle = 'rgba(70,90,120,0.5)'; ctx.lineWidth = 4;
  for (const x of [W * 0.5 - 90, W * 0.5 + 90]) ctx.strokeRect(x, 40, 180, 150);
  ctx.fillStyle = '#fff'; ctx.font = '78px "Lilita One", Impact, sans-serif'; ctx.textAlign = 'center';
  ctx.strokeStyle = '#13487e'; ctx.lineWidth = 10; ctx.lineJoin = 'round';
  ctx.strokeText('ICEBOX', W * 0.2, 242); ctx.fillText('ICEBOX', W * 0.2, 242);
  ctx.strokeText('ICEBOX', W * 0.8, 242); ctx.fillText('ICEBOX', W * 0.8, 242);
  for (const [x, y] of [[W * 0.12, 120], [W * 0.88, 120], [W * 0.36, 120]]) { ctx.strokeStyle = '#4aa0e8'; ctx.lineWidth = 6; for (let a = 0; a < 6; a++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a * 1.047) * 34, y + Math.sin(a * 1.047) * 34); ctx.stroke(); } }
  paintTrainSide(ctx, W, H, rnd);
  grime(ctx, rnd);
  return toTex(c);
}

// Double-decker passenger car: two rows of windows.
export function texDecker(main, accent, seed) {
  const [c, ctx] = mk(W, H);
  const rnd = mulberry32(seed * 19 + 2);
  ctx.fillStyle = main; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(0, 0, W, 24);
  ctx.fillStyle = '#23262f'; ctx.fillRect(0, H - 60, W, 60);
  for (const [y, h] of [[44, 96], [168, 96]]) {
    for (let x = 60; x < W - 120; x += 150) {
      if (y > 100 && (Math.abs(x - 270) < 90 || Math.abs(x - 1140) < 90)) continue; // doors on the lower deck
      ctx.fillStyle = '#10182c'; rr(ctx, x - 5, y - 5, 118, h + 10, 14); ctx.fill();
      const g = ctx.createLinearGradient(x, y, x + 108, y + h); g.addColorStop(0, '#46678f'); g.addColorStop(1, '#101a30');
      ctx.fillStyle = g; rr(ctx, x, y, 108, h, 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.moveTo(x + 8, y + h - 6); ctx.lineTo(x + 44, y + 6); ctx.lineTo(x + 66, y + 6); ctx.lineTo(x + 30, y + h - 6); ctx.fill();
    }
  }
  for (const x of [270, 1140]) { ctx.fillStyle = accent; ctx.fillRect(x - 70, 150, 140, 190); ctx.fillStyle = '#10182c'; rr(ctx, x - 58, 162, 52, 150, 8); ctx.fill(); rr(ctx, x + 6, 162, 52, 150, 8); ctx.fill(); }
  ctx.fillStyle = accent; ctx.fillRect(0, 142, W, 12); ctx.fillRect(0, 300, W, 18);
  ctx.fillStyle = '#fff'; ctx.font = '40px "Lilita One", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DOUBLE DECK', W * 0.5, 345);
  paintTrainSide(ctx, W, H, rnd);
  grime(ctx, rnd);
  return toTex(c);
}
