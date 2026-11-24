import * as THREE from 'three';
import { mk, toTex, speckle, rr, drawTag, drawStar, makeGroundTexture, makeWallTexture } from './textures.js';
import { paintWall } from './graffiti.js';
import { mulberry32 } from './util.js';

// ---------------------------------------------------------------- ground
function groundTex(o) {
  const W = 1024, H = 1152;
  const [c, ctx] = mk(W, H);
  const rnd = mulberry32(o.seed);
  ctx.fillStyle = o.base;
  ctx.fillRect(0, 0, W, H);
  speckle(ctx, rnd, W, H, 9000, o.specks, 2, 7);
  for (let i = 0; i < 400; i++) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = rnd() > 0.5 ? o.dark : o.light;
    ctx.beginPath();
    ctx.ellipse(rnd() * W, rnd() * H, 8 + rnd() * 26, 5 + rnd() * 14, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const pxPerUnit = W / 9.4, tieSpacing = H / 12;
  for (let lane = -1; lane <= 1; lane++) {
    const cx = W / 2 + lane * 2.2 * pxPerUnit, tw = 1.95 * pxPerUnit;
    for (let i = 0; i < 12; i++) {
      const y = i * tieSpacing + tieSpacing * 0.15, th = tieSpacing * 0.34;
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(cx - tw / 2 - 4, y + 6, tw + 8, th + 4);
      const g = ctx.createLinearGradient(0, y, 0, y + th);
      g.addColorStop(0, o.tieA); g.addColorStop(1, o.tieB);
      ctx.fillStyle = g;
      ctx.fillRect(cx - tw / 2, y, tw, th);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 5; k++) { const yy = y + rnd() * th; ctx.beginPath(); ctx.moveTo(cx - tw / 2, yy); ctx.lineTo(cx + tw / 2, yy + (rnd() - 0.5) * 3); ctx.stroke(); }
      for (let k = 0; k < 22; k++) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = o.specks[Math.floor(rnd() * o.specks.length)];
        const s = 2 + rnd() * 4;
        ctx.fillRect(cx - tw / 2 + rnd() * tw, y + rnd() * th, s, s);
      }
      ctx.globalAlpha = 1;
    }
  }
  if (o.extra) o.extra(ctx, rnd, W, H);
  return toTex(c, { repeat: true, aniso: 12 });
}

export function makeGround(id) {
  switch (id) {
    case 'snow':
      return groundTex({
        seed: 21, base: '#cfd9e4', specks: ['#ffffff', '#c3cfdc', '#a4b4c6', '#e8eff6'], dark: '#7d8ea3', light: '#ffffff',
        tieA: '#6a5340', tieB: '#41301f',
        extra(ctx, rnd, W, H) {
          for (let i = 0; i < 90; i++) {
            ctx.globalAlpha = 0.55; ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.ellipse(rnd() * W, rnd() * H, 18 + rnd() * 50, 8 + rnd() * 18, rnd() * 3, 0, 7); ctx.fill();
          }
          ctx.globalAlpha = 1;
          for (let i = 0; i < 160; i++) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(rnd() * W, rnd() * H, 2, 2); }
        },
      });
    case 'tropic':
      return groundTex({
        seed: 33, base: '#d8c392', specks: ['#ecdcb0', '#bda676', '#a58f62', '#f4e8c4'], dark: '#8b7650', light: '#fff1c8',
        tieA: '#8a5a38', tieB: '#5a3820',
        extra(ctx, rnd, W, H) {
          for (let i = 0; i < 70; i++) {
            const x = rnd() < 0.5 ? rnd() * 60 : W - rnd() * 60, y = rnd() * H;
            ctx.strokeStyle = ['#3d9b3a', '#58b84a', '#2f7d32'][Math.floor(rnd() * 3)]; ctx.lineWidth = 3;
            for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 26, y - 14 - rnd() * 16); ctx.stroke(); }
          }
        },
      });
    case 'desert':
      return groundTex({
        seed: 47, base: '#d6a05f', specks: ['#e6b678', '#b9824a', '#c99058', '#f0c690'], dark: '#8a5a2c', light: '#ffd9a0',
        tieA: '#9c7a58', tieB: '#6b4f33',
        extra(ctx, rnd, W, H) {
          ctx.strokeStyle = 'rgba(120,70,30,0.22)'; ctx.lineWidth = 3;
          for (let i = 0; i < 40; i++) { const y = rnd() * H; ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= W; x += 60) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 8); ctx.stroke(); }
        },
      });
    case 'neon':
      return groundTex({
        seed: 61, base: '#181b2e', specks: ['#262b47', '#0f1222', '#323959', '#1c2038'], dark: '#05060d', light: '#3a4170',
        tieA: '#2b3050', tieB: '#171a2e',
        extra(ctx, rnd, W, H) {
          for (let i = 0; i < 26; i++) {
            const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 70);
            const col = ['255,60,200', '40,220,255', '255,220,60'][Math.floor(rnd() * 3)];
            g.addColorStop(0, `rgba(${col},0.45)`); g.addColorStop(1, `rgba(${col},0)`);
            ctx.save(); ctx.translate(rnd() * W, rnd() * H); ctx.scale(1.6 + rnd(), 0.5 + rnd() * 0.5); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 70, 0, 7); ctx.fill(); ctx.restore();
          }
        },
      });
    default:
      return makeGroundTexture();
  }
}

// ------------------------------------------------------------------ walls
function wallBase(rnd, W, H, base, specks) {
  const [c, ctx] = mk(W * 1.5, H * 1.5);
  ctx.scale(1.5, 1.5);
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  speckle(ctx, rnd, W, H, 4000, specks, 1, 5, 0.5);
  return [c, ctx];
}

export function makeWall(id, seed) {
  if (id === 'city') return makeWallTexture(seed);
  const W = 1024, H = 192;
  const rnd = mulberry32(seed * 733 + id.length * 31);
  let c, ctx;
  if (id === 'snow') {
    [c, ctx] = wallBase(rnd, W, H, '#7f8c9c', ['#97a4b4', '#657285', '#a9b6c6']);
    // stone blocks
    ctx.strokeStyle = 'rgba(30,38,52,0.55)'; ctx.lineWidth = 3;
    for (let row = 0; row < 4; row++) {
      const y = 36 + row * 36; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      for (let x = (row % 2) * 60; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 36); ctx.stroke(); }
    }
    // snow cap with icicles
    ctx.fillStyle = '#f4f8fc';
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, 26 + Math.sin(x * 0.05) * 6 + (rnd() > 0.7 ? 18 + rnd() * 22 : 0));
    ctx.lineTo(W, 0); ctx.fill();
    ctx.fillStyle = 'rgba(160,190,230,0.5)';
    for (let i = 0; i < 18; i++) { const x = rnd() * W; ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x + 5, 20); ctx.lineTo(x + 2.5, 40 + rnd() * 30); ctx.fill(); }
  } else if (id === 'tropic') {
    [c, ctx] = wallBase(rnd, W, H, '#e9d6a8', ['#f5e6bd', '#cdb585', '#dcc896']);
    // bamboo poles
    for (let x = 0; x < W; x += 38) {
      const g = ctx.createLinearGradient(x, 0, x + 34, 0);
      g.addColorStop(0, '#6a8f2e'); g.addColorStop(0.5, '#a7cf4a'); g.addColorStop(1, '#5a7a22');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 34, H);
      ctx.fillStyle = 'rgba(40,60,10,0.55)';
      for (let y = 20 + (x / 38 % 3) * 14; y < H; y += 56) ctx.fillRect(x, y, 34, 5);
    }
    ctx.fillStyle = '#7a4f2a'; ctx.fillRect(0, 70, W, 10); ctx.fillRect(0, 150, W, 10);
  } else if (id === 'desert') {
    [c, ctx] = wallBase(rnd, W, H, '#c8864c', ['#d8996a', '#a96c38', '#e1a876']);
    ctx.fillStyle = 'rgba(90,40,10,0.25)'; ctx.fillRect(0, 0, W, 14);
    ctx.strokeStyle = 'rgba(80,40,10,0.35)'; ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) { ctx.beginPath(); let x = rnd() * W, y = 20; ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 20; y += 20 + rnd() * 10; ctx.lineTo(x, y); } ctx.stroke(); }
    // painted patterns
    for (let i = 0; i < 4; i++) {
      const x = 80 + i * 250 + rnd() * 40;
      ctx.fillStyle = ['#2b6f8a', '#f4e2b8', '#7a2e1c', '#2f8a4a'][i % 4];
      ctx.beginPath();
      for (let k = 0; k < 7; k++) { ctx.lineTo(x + k * 20, 100 + (k % 2 ? -22 : 22)); }
      for (let k = 6; k >= 0; k--) { ctx.lineTo(x + k * 20, 120 + (k % 2 ? -22 : 22)); }
      ctx.fill();
      drawStar(ctx, x + 60, 52, 16, '#f4e2b8');
    }
  } else { // neon
    [c, ctx] = wallBase(rnd, W, H, '#12152a', ['#1c2140', '#0b0d1a', '#262d52']);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
    for (let x = 0; x <= W; x += W / 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    const neon = (y, col) => { ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = col; ctx.fillRect(0, y, W, 4); ctx.shadowBlur = 0; };
    neon(16, '#ff3dd0'); neon(176, '#2bdcff');
  }
  const words = { snow: ['SKI', 'SNOW', 'ICE', 'FROST', 'CHILL', 'ALPINE', 'SLED', 'POWDER'], tropic: ['SURF', 'WAVE', 'SUN', 'ALOHA', 'PALM', 'REEF', 'TIKI', 'SALT'], desert: ['DUNE', 'RUST', 'HEAT', 'MESA', 'DUST', 'CACTUS', 'SAND', 'OASIS'], neon: ['RAVE', 'NEON', 'GLOW', 'BYTE', 'ZONE', 'SYNTH', 'LASER', 'PIXEL'] }[id];
  paintWall(ctx, W * 1.5, H * 1.5, rnd, { neon: id === 'neon', words, patchColors: id === 'neon' ? ['rgba(10,12,30,0.6)', 'rgba(40,10,70,0.5)'] : undefined });
  const t = toTex(c, { repeat: true });
  t.repeat.set(6, 1);
  return t;
}

// ---------------------------------------------------------- neon facades
export function makeNeonFacade(seed) {
  const W = 512, H = 512;
  const [c, ctx] = mk(W, H);
  const [e, ectx] = mk(W, H);
  const rnd = mulberry32(seed * 977 + 5);
  const cols = 4, rows = 8;
  ctx.fillStyle = '#10142b'; ctx.fillRect(0, 0, W, H);
  speckle(ctx, rnd, W, H, 2200, ['#1b2142', '#0a0d1d', '#262d56'], 1, 4, 0.6);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, W, H);
  const cw = W / cols, ch = H / rows;
  const palette = ['#2bdcff', '#ff3dd0', '#ffd23f', '#7dff6b', '#a98bff'];
  const tint = palette[Math.floor(rnd() * palette.length)];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cw + cw * 0.16, y = r * ch + ch * 0.2, w = cw * 0.68, h = ch * 0.6;
      ctx.fillStyle = '#05070f'; ctx.fillRect(x, y, w, h);
      if (rnd() > 0.42) { ectx.fillStyle = rnd() > 0.7 ? palette[Math.floor(rnd() * palette.length)] : tint; ectx.fillRect(x + 2, y + 2, w - 4, h - 4); }
    }
  }
  // glowing vertical strips + edge lines
  for (const x of [6, W - 10]) { ectx.fillStyle = tint; ectx.fillRect(x, 0, 4, H); }
  ectx.fillStyle = tint; ectx.fillRect(0, H - 8, W, 4);
  return { map: toTex(c, { repeat: true }), emissive: toTex(e, { repeat: true }), cols, rows };
}

export function makeNeonSign(text, color, w = 512, h = 192) {
  const [c, ctx] = mk(w, h);
  ctx.fillStyle = '#05060f'; rr(ctx, 6, 6, w - 12, h - 12, 22); ctx.fill();
  ctx.shadowColor = color; ctx.shadowBlur = 26; ctx.strokeStyle = color; ctx.lineWidth = 8;
  rr(ctx, 14, 14, w - 28, h - 28, 18); ctx.stroke();
  ctx.font = `${h * 0.5}px "Lilita One", Impact, sans-serif`;
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.lineWidth = 5; ctx.strokeStyle = color;
  ctx.strokeText(text, w / 2, h * 0.67); ctx.fillText(text, w / 2, h * 0.67);
  return toTex(c);
}

// --------------------------------------------------------- horizon ring
export function makeRing(id) {
  const W = 2048, H = 256;
  const [c, ctx] = mk(W, H);
  const rnd = mulberry32(id.length * 313 + 7);
  ctx.clearRect(0, 0, W, H);
  const layer = (alpha, fn) => { ctx.fillStyle = `rgba(255,255,255,${alpha})`; fn(); ctx.fill(); };
  if (id === 'snow') {
    for (const [a, hmin, hmax] of [[0.5, 70, 190], [0.95, 40, 120]]) {
      layer(a, () => {
        ctx.beginPath(); ctx.moveTo(0, H);
        let x = 0;
        while (x < W) { const w = 90 + rnd() * 160, h = hmin + rnd() * (hmax - hmin); ctx.lineTo(x + w * 0.5, H - h); ctx.lineTo(x + w, H - hmin * 0.4); x += w; }
        ctx.lineTo(W, H);
      });
    }
  } else if (id === 'tropic') {
    layer(0.45, () => { ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 12) ctx.lineTo(x, H - 50 - Math.max(0, Math.sin(x * 0.006) * 70) - Math.sin(x * 0.03) * 6); ctx.lineTo(W, H); });
    layer(0.95, () => {
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, H - 26 - Math.max(0, Math.sin(x * 0.011 + 2) * 36));
      ctx.lineTo(W, H);
    });
    for (let i = 0; i < 26; i++) { // palm silhouettes
      const x = rnd() * W, h = 50 + rnd() * 40; ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillRect(x, H - 26 - h, 4, h);
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(x + 2 + (k - 2) * 11, H - 26 - h - 2 + Math.abs(k - 2) * 5, 15, 4, (k - 2) * 0.35, 0, 7); ctx.fill(); }
    }
  } else if (id === 'desert') {
    layer(0.5, () => { ctx.beginPath(); ctx.moveTo(0, H); let x = 0; while (x < W) { const w = 60 + rnd() * 120, h = 60 + rnd() * 80; ctx.lineTo(x, H - h); ctx.lineTo(x + w * 0.2, H - h); ctx.lineTo(x + w * 0.3, H - h * 0.7); ctx.lineTo(x + w, H - h * 0.7); x += w + 20; } ctx.lineTo(W, H); });
    layer(0.95, () => { ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 10) ctx.lineTo(x, H - 36 - (Math.sin(x * 0.008) + 1) * 24 - Math.sin(x * 0.05) * 3); ctx.lineTo(W, H); });
  } else if (id === 'neon') {
    for (const [a, hmin, hmax, wmin] of [[0.55, 70, 220, 24], [0.95, 40, 150, 34]]) {
      ctx.fillStyle = `rgba(255,255,255,${a})`; let x = 0;
      while (x < W) {
        const w = wmin + rnd() * 50, h = hmin + rnd() * (hmax - hmin);
        ctx.fillRect(x, H - h, w, h);
        if (rnd() > 0.5) ctx.fillRect(x + w * 0.45, H - h - 30 - rnd() * 40, 4, 40);
        x += w + 2;
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.0)';
  } else { // city
    for (let l = 0; l < 2; l++) {
      ctx.fillStyle = l === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.95)';
      let x = 0;
      while (x < W) { const w = 30 + rnd() * 70, h = (l === 0 ? 70 : 40) + rnd() * (l === 0 ? 150 : 90); ctx.fillRect(x, H - h, w, h); x += w + (l === 0 ? 4 : 10) * rnd(); }
    }
  }
  return toTex(c, { repeat: true, srgb: false });
}

// Gravel + sleepers for the side tracks (5.2 wide x 3.6 long per tile).
export function makeYardTexture() {
  const [c, ctx] = mk(256, 256);
  const rnd = mulberry32(88);
  ctx.fillStyle = '#6f685f'; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, rnd, 256, 256, 2600, ['#8a8277', '#5b554d', '#7d756a', '#a39b8e', '#4a453f'], 1, 4);
  for (let i = 0; i < 4; i++) {
    const y = i * 64 + 14;
    ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fillRect(66, y + 5, 124, 24);
    const g = ctx.createLinearGradient(0, y, 0, y + 20); g.addColorStop(0, '#7a5a3a'); g.addColorStop(1, '#4a3320');
    ctx.fillStyle = g; ctx.fillRect(66, y, 124, 20);
  }
  const eg = ctx.createLinearGradient(0, 0, 256, 0); eg.addColorStop(0, 'rgba(0,0,0,0.35)'); eg.addColorStop(0.18, 'rgba(0,0,0,0)'); eg.addColorStop(0.82, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = eg; ctx.fillRect(0, 0, 256, 256);
  return toTex(c, { repeat: true });
}
