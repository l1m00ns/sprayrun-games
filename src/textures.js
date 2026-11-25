import * as THREE from 'three';
import { drawBoard } from './icons.js';
import { mulberry32 } from './util.js';
import { bubblePiece, paletteFromTriple, paintWall } from './graffiti.js';

export function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
export function toTex(c, { repeat = false, aniso = 8, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
export function speckle(ctx, rnd, w, h, n, colors, minS, maxS, alpha = 1) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * (0.4 + rnd() * 0.6);
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    const s = minS + rnd() * (maxS - minS);
    ctx.fillRect(rnd() * w, rnd() * h, s, s * (0.6 + rnd() * 0.8));
  }
  ctx.globalAlpha = 1;
}
export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const WORDS = ['RUSH', 'ZIP', 'NOVA', 'YO!', 'CREW', 'SPRAY', 'FLOW', 'BOLT', 'WILD', 'HYPE', 'KIT', 'REX', 'MIKA', 'DASH', 'JAM', 'VIBE', 'POW', 'SKY', 'LOUD', 'FRESH'];
const PALETTES = [
  ['#ff3d71', '#ffd23f', '#1a1a2e'], ['#00e5ff', '#7b4dff', '#10122b'], ['#7dff6b', '#00b86b', '#06231a'],
  ['#ffa62b', '#ff3d00', '#2b0f06'], ['#ff6bd5', '#7a3cff', '#16062b'], ['#ffffff', '#ffd23f', '#1d2742'],
];

export function drawTag(ctx, x, y, text, size, pal, angle = 0, rnd = Math.random) {
  bubblePiece(ctx, text, x, y, size, paletteFromTriple(pal), rnd, { rot: angle, wobble: 0.18 });
}

export function drawStar(ctx, x, y, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

function drawCrown(ctx, x, y, s, col) {
  ctx.fillStyle = col;
  ctx.strokeStyle = '#111';
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x - s, y - s * 0.8);
  ctx.lineTo(x - s * 0.5, y - s * 0.3);
  ctx.lineTo(x, y - s);
  ctx.lineTo(x + s * 0.5, y - s * 0.3);
  ctx.lineTo(x + s, y - s * 0.8);
  ctx.lineTo(x + s, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ------------------------------------------------------------------ ground
export function makeGroundTexture() {
  const W = 1024, H = 1152; // 9.4 wide x 10.8 long
  const [c, ctx] = mk(W, H);
  const rnd = mulberry32(11);
  ctx.fillStyle = '#6f685f';
  ctx.fillRect(0, 0, W, H);
  speckle(ctx, rnd, W, H, 9000, ['#8a8277', '#5b554d', '#7d756a', '#a39b8e', '#4a453f', '#948b7e'], 2, 7);
  // gravel clumps
  for (let i = 0; i < 400; i++) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = rnd() > 0.5 ? '#2c2823' : '#b9b0a2';
    ctx.beginPath();
    ctx.ellipse(rnd() * W, rnd() * H, 8 + rnd() * 26, 5 + rnd() * 14, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const pxPerUnit = W / 9.4;
  const tieSpacing = H / 12;
  for (let lane = -1; lane <= 1; lane++) {
    const cx = W / 2 + lane * 2.2 * pxPerUnit;
    const tw = 1.95 * pxPerUnit;
    for (let i = 0; i < 12; i++) {
      const y = i * tieSpacing + tieSpacing * 0.15;
      const th = tieSpacing * 0.34;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(cx - tw / 2 - 4, y + 6, tw + 8, th + 4);
      const g = ctx.createLinearGradient(0, y, 0, y + th);
      const base = 78 + Math.floor(rnd() * 22);
      g.addColorStop(0, `rgb(${base + 22},${base - 6},${base - 28})`);
      g.addColorStop(1, `rgb(${base - 6},${base - 28},${base - 44})`);
      ctx.fillStyle = g;
      ctx.fillRect(cx - tw / 2, y, tw, th);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 6; k++) {
        const yy = y + rnd() * th;
        ctx.beginPath(); ctx.moveTo(cx - tw / 2, yy); ctx.lineTo(cx + tw / 2, yy + (rnd() - 0.5) * 3); ctx.stroke();
      }
      // gravel creeping over the ties
      speckle(ctx, rnd, W, H, 0, [], 0, 0);
      for (let k = 0; k < 24; k++) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = ['#8a8277', '#6a635a', '#a39b8e'][Math.floor(rnd() * 3)];
        const s = 2 + rnd() * 4;
        ctx.fillRect(cx - tw / 2 + rnd() * tw, y + rnd() * th, s, s);
      }
      ctx.globalAlpha = 1;
    }
  }
  // oil stains / dirt
  for (let i = 0; i < 20; i++) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#15110d';
    ctx.beginPath();
    ctx.ellipse(rnd() * W, rnd() * H, 20 + rnd() * 50, 10 + rnd() * 24, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return toTex(c, { repeat: true, aniso: 12 });
}

// -------------------------------------------------------------------- wall
export function makeWallTexture(seed) {
  const W = 1024, H = 192; // layout units: 10.8 wide x 2.0 tall world units (canvas is 1.5x for sharper tags)
  const [c, ctx] = mk(W * 1.5, H * 1.5);
  ctx.scale(1.5, 1.5);
  const rnd = mulberry32(seed * 977 + 5);
  const base = ['#9a9a95', '#8d8f93', '#a39c92', '#7f8790'][seed % 4];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  speckle(ctx, rnd, W, H, 5000, ['#b4b4ae', '#7c7d7a', '#a9a398', '#6d6f70'], 1, 5, 0.5);
  // formwork panels
  ctx.strokeStyle = 'rgba(40,40,40,0.35)';
  ctx.lineWidth = 3;
  for (let x = 0; x <= W; x += W / 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, H * 0.5); ctx.lineTo(W, H * 0.5); ctx.stroke();
  for (let x = 0; x < W; x += W / 4) {
    for (const yy of [0.25, 0.75]) {
      for (const xx of [0.2, 0.8]) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.arc(x + xx * (W / 4), yy * H, 4, 0, 7); ctx.fill();
      }
    }
  }
  // water stains
  for (let i = 0; i < 12; i++) {
    const x = rnd() * W;
    const g = ctx.createLinearGradient(0, 0, 0, H * (0.4 + rnd() * 0.5));
    g.addColorStop(0, 'rgba(30,26,20,0.28)');
    g.addColorStop(1, 'rgba(30,26,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 10 + rnd() * 30, H);
  }
  // street-art collage (device pixels)
  paintWall(ctx, W * 1.5, H * 1.5, rnd, {});
  ctx.setTransform(1.5, 0, 0, 1.5, 0, 0);
  // bottom grime
  const gg = ctx.createLinearGradient(0, H * 0.75, 0, H);
  gg.addColorStop(0, 'rgba(20,16,10,0)');
  gg.addColorStop(1, 'rgba(20,16,10,0.55)');
  ctx.fillStyle = gg;
  ctx.fillRect(0, H * 0.75, W, H * 0.25);
  return toTex(c, { repeat: true });
}

export function makeFenceTexture() {
  const [c, ctx] = mk(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(170,176,186,0.95)';
  ctx.lineWidth = 3;
  for (let i = -128; i < 256; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, 128); ctx.lineTo(i + 128, 0); ctx.stroke();
  }
  const t = toTex(c, { repeat: true });
  return t;
}

// ---------------------------------------------------------------- facades
export function makeFacade(style, seed) {
  const W = 512, H = 512;
  const [c, ctx] = mk(W, H);
  const [e, ectx] = mk(W, H);
  const rnd = mulberry32(seed * 131 + style * 7 + 3);
  const styles = [
    { wall: '#b5654a', trim: '#8a4a36', win: '#27364d', cols: 4, rows: 6 }, // brick
    { wall: '#9bb0c6', trim: '#6f8296', win: '#24334a', cols: 5, rows: 8 }, // glass
    { wall: '#d8cfc0', trim: '#aaa192', win: '#2b3a52', cols: 4, rows: 6 }, // plaster
    { wall: '#8d93a8', trim: '#666b80', win: '#26324a', cols: 3, rows: 5 }, // concrete
    { wall: '#e0b04a', trim: '#b98a2a', win: '#24324a', cols: 4, rows: 7 }, // yellow
  ];
  const s = styles[style % styles.length];
  ctx.fillStyle = s.wall;
  ctx.fillRect(0, 0, W, H);
  speckle(ctx, rnd, W, H, 3500, [s.trim, '#00000022', '#ffffff18'], 1, 4, 0.5);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);
  const cw = W / s.cols, ch = H / s.rows;
  for (let r = 0; r < s.rows; r++) {
    for (let col = 0; col < s.cols; col++) {
      const x = col * cw + cw * 0.18, y = r * ch + ch * 0.2;
      const w = cw * 0.64, h = ch * 0.6;
      ctx.fillStyle = s.trim;
      ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, s.win);
      g.addColorStop(1, '#0d1420');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // reflection
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(x, y + h); ctx.lineTo(x + w * 0.5, y); ctx.lineTo(x + w * 0.75, y); ctx.lineTo(x + w * 0.25, y + h); ctx.fill();
      // frame cross
      ctx.fillStyle = s.trim;
      ctx.fillRect(x + w / 2 - 2, y, 4, h);
      ctx.fillRect(x, y + h * 0.5 - 2, w, 4);
      // lit window for night
      if (rnd() > 0.52) {
        const warm = ['#ffd27a', '#ffe9b0', '#9be7ff', '#ffb36b'][Math.floor(rnd() * 4)];
        ectx.fillStyle = warm;
        ectx.fillRect(x + 3, y + 3, w / 2 - 5, h / 2 - 5);
        if (rnd() > 0.3) ectx.fillRect(x + w / 2 + 3, y + 3, w / 2 - 5, h / 2 - 5);
        if (rnd() > 0.4) ectx.fillRect(x + 3, y + h / 2 + 3, w / 2 - 5, h / 2 - 5);
        if (rnd() > 0.4) ectx.fillRect(x + w / 2 + 3, y + h / 2 + 3, w / 2 - 5, h / 2 - 5);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, r * ch + ch - 6, W, 6);
  }
  // ground floor shop band at bottom
  const grad = ctx.createLinearGradient(0, H - 60, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - 60, W, 60);
  const map = toTex(c, { repeat: true });
  const emissive = toTex(e, { repeat: true });
  return { map, emissive, cols: s.cols, rows: s.rows };
}

// ----------------------------------------------------------------- trains
export const TRAIN_SCHEMES = [
  { id: 'blue', body: '#2f6fe0', roof: '#d9e2ef', stripe: '#ffd23f', stripe2: '#ffffff', skirt: '#1c3f86', windows: true, label: 'LINE 7' },
  { id: 'red', body: '#d9453b', roof: '#e8dfd6', stripe: '#f3ead7', stripe2: '#1b1b1b', skirt: '#7c1d1a', windows: true, label: 'METRO R' },
  { id: 'green', body: '#27a36a', roof: '#dfe9e4', stripe: '#ffffff', stripe2: '#0e5234', skirt: '#14583a', windows: true, label: 'EXPRESS' },
  { id: 'yellow', body: '#f2b81c', roof: '#e9e1c8', stripe: '#1c1c1c', stripe2: '#ffffff', skirt: '#8a6a0c', windows: true, label: 'CITY Y' },
  { id: 'purple', body: '#7a46c7', roof: '#d9d0ea', stripe: '#ff7ac8', stripe2: '#ffffff', skirt: '#40236e', windows: true, label: 'NIGHT N' },
  { id: 'cargo', body: '#c4622d', roof: '#8c867e', stripe: '#f2e9d8', stripe2: '#3a2a20', skirt: '#4a2a18', windows: false, label: 'CARGO' },
  { id: 'tank', body: '#4f6678', roof: '#9aa3ab', stripe: '#ffcf33', stripe2: '#202a33', skirt: '#2a3640', windows: false, label: 'FREIGHT' },
];

export function makeTrainSide(scheme, variant) {
  const W = 1408, H = 410;
  const [c, ctx] = mk(W, H);
  const rnd = mulberry32(scheme.id.length * 211 + variant * 101 + scheme.body.charCodeAt(2));
  ctx.fillStyle = scheme.body;
  ctx.fillRect(0, 0, W, H);
  // top roof band
  ctx.fillStyle = scheme.roof;
  ctx.fillRect(0, 0, W, 26);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 26, W, 5);
  // skirt
  ctx.fillStyle = scheme.skirt;
  ctx.fillRect(0, H - 56, W, 56);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, H - 56, W, 4);

  if (scheme.windows) {
    // doors
    const doors = [W * 0.17, W * 0.5, W * 0.83];
    // windows
    const wy = 62, wh = 118;
    const winX = [];
    for (let i = 0; i < 8; i++) winX.push(70 + i * 168);
    for (const x of winX) {
      if (doors.some((d) => Math.abs(d - (x + 55)) < 125)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      rr(ctx, x - 6, wy - 6, 122, wh + 12, 14); ctx.fill();
      const g = ctx.createLinearGradient(x, wy, x + 110, wy + wh);
      g.addColorStop(0, '#34506f'); g.addColorStop(0.5, '#1d2c42'); g.addColorStop(1, '#0f1826');
      ctx.fillStyle = g;
      rr(ctx, x, wy, 110, wh, 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.moveTo(x + 8, wy + wh - 6); ctx.lineTo(x + 52, wy + 6); ctx.lineTo(x + 76, wy + 6); ctx.lineTo(x + 32, wy + wh - 6); ctx.fill();
    }
    for (const d of doors) {
      const dx = d - 62;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(dx - 4, 46, 132, H - 46 - 56 + 4);
      ctx.fillStyle = scheme.skirt;
      ctx.fillRect(dx, 50, 124, H - 56 - 50);
      for (const half of [0, 1]) {
        const x0 = dx + 6 + half * 57;
        const g = ctx.createLinearGradient(x0, 60, x0 + 52, 60 + 150);
        g.addColorStop(0, '#3b5a7d'); g.addColorStop(1, '#122033');
        ctx.fillStyle = scheme.body;
        ctx.fillRect(x0, 56, 55, H - 56 - 62);
        ctx.fillStyle = g;
        rr(ctx, x0 + 6, 64, 42, 150, 6); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x0 + 24, 230, 6, 40); // handle
      }
      // door warning stripe
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(dx + 6, 52, 112, 5);
    }
    // livery stripes
    ctx.fillStyle = scheme.stripe;
    ctx.fillRect(0, 214, W, 22);
    ctx.fillStyle = scheme.stripe2;
    ctx.fillRect(0, 240, W, 7);
    // logo + number
    ctx.fillStyle = scheme.stripe2 === '#ffffff' ? '#ffffff' : scheme.stripe;
    ctx.font = '34px "Lilita One", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(scheme.label, W * 0.335, 207);
    ctx.fillText(String(1000 + Math.floor(rnd() * 8999)), W * 0.665, 207);
  } else {
    // freight: ribs
    for (let x = 0; x < W; x += 22) {
      ctx.fillStyle = (x / 22) % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)';
      ctx.fillRect(x, 34, 11, H - 90);
    }
    // sliding door
    const dx = W * 0.5 - 150;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(dx - 8, 46, 316, H - 100 + 8);
    ctx.fillStyle = scheme.body;
    ctx.fillRect(dx, 50, 300, H - 100);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(dx, 50, 300, 8);
    ctx.fillStyle = scheme.stripe2;
    ctx.fillRect(dx + 120, 190, 60, 10);
    ctx.fillStyle = scheme.stripe;
    ctx.fillRect(0, 270, W, 14);
    ctx.font = '44px "Lilita One", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = scheme.stripe;
    ctx.fillText(scheme.label, W * 0.2, 200);
    ctx.fillText(String(10000 + Math.floor(rnd() * 89999)), W * 0.8, 200);
    // rust
    for (let i = 0; i < 30; i++) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#6b3414';
      ctx.beginPath(); ctx.ellipse(rnd() * W, rnd() * H, 10 + rnd() * 36, 6 + rnd() * 18, rnd() * 3, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // graffiti
  const tags = variant === 0 ? 1 : 2;
  for (let i = 0; i < tags; i++) {
    const pal = PALETTES[Math.floor(rnd() * PALETTES.length)];
    const word = WORDS[Math.floor(rnd() * WORDS.length)];
    drawTag(ctx, 160 + rnd() * (W - 320), 330 + rnd() * 30, word, 120 + rnd() * 50, pal, (rnd() - 0.5) * 0.18, rnd);
  }
  if (variant === 1) {
    drawStar(ctx, 200 + rnd() * 900, 120 + rnd() * 60, 26, '#ffd23f');
  }
  // dirt streaks + bottom grime
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(10,8,6,0.22)');
    g.addColorStop(0.5, 'rgba(10,8,6,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 2 + rnd() * 6, H * (0.3 + rnd() * 0.4));
  }
  const grime = ctx.createLinearGradient(0, H - 120, 0, H);
  grime.addColorStop(0, 'rgba(15,12,8,0)');
  grime.addColorStop(1, 'rgba(15,12,8,0.55)');
  ctx.fillStyle = grime;
  ctx.fillRect(0, H - 120, W, 120);
  return toTex(c, { aniso: 8 });
}

export function makeTrainFront(scheme) {
  const W = 256, H = 450;
  const [c, ctx] = mk(W, H);
  ctx.fillStyle = scheme.body;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = scheme.roof;
  ctx.fillRect(0, 0, W, 24);
  ctx.fillStyle = scheme.skirt;
  ctx.fillRect(0, H - 70, W, 70);
  if (scheme.windows) {
    // windshield
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    rr(ctx, 22, 46, W - 44, 170, 22); ctx.fill();
    const g = ctx.createLinearGradient(0, 50, 0, 210);
    g.addColorStop(0, '#4a6a8f'); g.addColorStop(1, '#101b2c');
    ctx.fillStyle = g;
    rr(ctx, 28, 52, W - 56, 158, 18); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.moveTo(40, 200); ctx.lineTo(100, 58); ctx.lineTo(128, 58); ctx.lineTo(68, 200); ctx.fill();
    ctx.fillStyle = scheme.stripe;
    ctx.fillRect(0, 232, W, 22);
    // destination board
    ctx.fillStyle = '#111';
    rr(ctx, 70, 30, 116, 18, 4); ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.font = '15px "Lilita One", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(scheme.label, W / 2, 44);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(40, 60, W - 80, 220);
    ctx.fillStyle = scheme.stripe;
    for (let i = 0; i < 6; i++) ctx.fillRect(40, 80 + i * 32, W - 80, 8);
    ctx.fillStyle = scheme.stripe;
    ctx.fillRect(0, 300, W, 16);
  }
  // headlights
  for (const x of [46, W - 46]) {
    const rg = ctx.createRadialGradient(x, 330, 2, x, 330, 26);
    rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.5, '#fff3b0'); rg.addColorStop(1, '#8a7a30');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(x, 330, 24, 0, 7); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 4; ctx.stroke();
  }
  // plate
  ctx.fillStyle = '#f4f4f4';
  rr(ctx, 86, 316, 84, 34, 5); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.font = '24px "Lilita One", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(100 + Math.floor(Math.random() * 899)), W / 2, 342);
  // hazard bumper
  for (let x = -20; x < W + 20; x += 36) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(x, H - 62); ctx.lineTo(x + 18, H - 62); ctx.lineTo(x + 36, H - 18); ctx.lineTo(x + 18, H - 18); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, H - 18, W, 18);
  return toTex(c);
}

export function makeRoofTexture() {
  const W = 128, H = 768;
  const [c, ctx] = mk(W, H);
  const rnd = mulberry32(404);
  ctx.fillStyle = '#e9e9ea';
  ctx.fillRect(0, 0, W, H);
  speckle(ctx, rnd, W, H, 900, ['#cfcfd2', '#f6f6f6', '#bdbdc2'], 1, 3, 0.6);
  for (let y = 0; y < H; y += 128) {
    ctx.fillStyle = 'rgba(40,40,50,0.35)';
    ctx.fillRect(0, y, W, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, y + 3, W, 2);
    for (let x = 10; x < W; x += 36) {
      ctx.fillStyle = 'rgba(40,40,50,0.45)';
      ctx.beginPath(); ctx.arc(x, y + 10, 2.2, 0, 7); ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(40,40,50,0.3)';
  ctx.fillRect(W / 2 - 2, 0, 4, H);
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = 'rgba(30,25,20,0.12)';
    ctx.fillRect(rnd() * W, rnd() * H, 4 + rnd() * 14, 20 + rnd() * 90);
  }
  const t = toTex(c, { repeat: false });
  return t;
}

export function makeStripeTexture(a, b, angle = 1) {
  const [c, ctx] = mk(128, 128);
  ctx.fillStyle = a; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = b;
  for (let i = -128; i < 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 128); ctx.lineTo(i + 32, 128); ctx.lineTo(i + 32 + 128 * angle, 0); ctx.lineTo(i + 128 * angle, 0);
    ctx.fill();
  }
  const t = toTex(c, { repeat: true });
  return t;
}

export function makeCoinTexture() {
  const [c, ctx] = mk(128, 128);
  ctx.fillStyle = '#ffcf33';
  ctx.fillRect(0, 0, 128, 128);
  const g = ctx.createRadialGradient(54, 50, 6, 64, 64, 64);
  g.addColorStop(0, '#fff3a6'); g.addColorStop(0.6, '#ffc61a'); g.addColorStop(1, '#d68a00');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(64, 64, 62, 0, 7); ctx.fill();
  ctx.strokeStyle = '#b86e00'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(64, 64, 48, 0, 7); ctx.stroke();
  drawStar(ctx, 64, 66, 30, '#b86e00');
  drawStar(ctx, 64, 63, 26, '#ffe27a');
  return toTex(c);
}

export function makeIconTexture(kind, color) {
  const S = 256;
  const [c, ctx] = mk(S, S);
  ctx.clearRect(0, 0, S, S);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const disc = (fill) => {
    const g = ctx.createRadialGradient(100, 90, 10, 128, 128, 124);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.15, fill); g.addColorStop(1, '#00000055');
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(128, 128, 118, 0, 7); ctx.fill();
    ctx.fillStyle = g; ctx.globalAlpha = 0.45;
    ctx.beginPath(); ctx.arc(128, 128, 118, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(128, 128, 112, 0, 7); ctx.stroke();
  };
  disc(color);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  if (kind === 'magnet') {
    ctx.lineWidth = 34; ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.arc(128, 132, 52, Math.PI, 0); ctx.lineTo(180, 184); ctx.moveTo(76, 132); ctx.lineTo(76, 184); ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(59, 168, 36, 22); ctx.fillRect(163, 168, 36, 22);
  } else if (kind === 'jetpack') {
    ctx.fillStyle = '#fff';
    rr(ctx, 76, 58, 44, 110, 20); ctx.fill();
    rr(ctx, 136, 58, 44, 110, 20); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(78, 176); ctx.lineTo(118, 176); ctx.lineTo(98, 218); ctx.fill();
    ctx.beginPath(); ctx.moveTo(138, 176); ctx.lineTo(178, 176); ctx.lineTo(158, 218); ctx.fill();
  } else if (kind === 'sneakers') {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(62, 90); ctx.lineTo(112, 90); ctx.lineTo(118, 120); ctx.lineTo(188, 140); ctx.quadraticCurveTo(204, 146, 204, 166);
    ctx.lineTo(204, 176); ctx.lineTo(62, 176); ctx.closePath(); ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(62, 168, 142, 14);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(150, 80); ctx.lineTo(196, 54); ctx.lineTo(176, 96); ctx.fill();
  } else if (kind === 'mult') {
    ctx.fillStyle = '#fff';
    ctx.font = '120px "Lilita One", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 10; ctx.strokeStyle = '#a56a00';
    ctx.strokeText('2x', 128, 166);
    ctx.fillText('2x', 128, 166);
  } else if (kind === 'board') {
    drawBoard(ctx, 128, 132, 1.9, { deck: '#ffffff', rail: color });
  }
  return toTex(c);
}

export function makeGlowTexture() {
  const [c, ctx] = mk(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTex(c);
}

export function makeSoftDot() {
  const [c, ctx] = mk(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return toTex(c);
}

export function makeSkylineTexture() {
  const W = 2048, H = 256;
  const [c, ctx] = mk(W, H);
  const rnd = mulberry32(99);
  ctx.clearRect(0, 0, W, H);
  for (let layer = 0; layer < 2; layer++) {
    const col = layer === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.95)';
    ctx.fillStyle = col;
    let x = 0;
    while (x < W) {
      const w = 30 + rnd() * 70;
      const h = (layer === 0 ? 70 : 40) + rnd() * (layer === 0 ? 150 : 90);
      ctx.fillRect(x, H - h, w, h);
      if (rnd() > 0.7) ctx.fillRect(x + w * 0.4, H - h - 24, 4, 24);
      x += w + (layer === 0 ? 4 : 10) * rnd();
    }
  }
  const t = toTex(c, { repeat: true, srgb: false });
  return t;
}

export function makeCloudTexture(seed) {
  const [c, ctx] = mk(512, 192);
  const rnd = mulberry32(seed);
  ctx.clearRect(0, 0, 512, 192);
  for (let i = 0; i < 16; i++) {
    const x = 90 + rnd() * 330, y = 70 + rnd() * 70, r = 30 + rnd() * 46;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  return toTex(c);
}

export function makeBillboardTexture(i) {
  const W = 512, H = 256;
  const [c, ctx] = mk(W, H);
  const ads = [
    { bg: '#ff3d71', fg: '#fff', t: 'FIZZ', s: 'ICE-COLD POP' },
    { bg: '#19c3d1', fg: '#0b1a33', t: 'NOVA', s: 'RUN FASTER' },
    { bg: '#ffd23f', fg: '#2b1a00', t: 'BOLT', s: 'ENERGY BARS' },
    { bg: '#7b4dff', fg: '#fff', t: 'SKY FM', s: '101.7 THE BEAT' },
  ];
  const a = ads[i % ads.length];
  ctx.fillStyle = a.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(60 + k * 70, 40 + (k % 3) * 70, 60, 0, 7); ctx.fill(); }
  ctx.fillStyle = a.fg;
  ctx.textAlign = 'center';
  ctx.font = '120px "Lilita One", Impact, sans-serif';
  ctx.fillText(a.t, W / 2, 150);
  ctx.font = '40px "Baloo 2", sans-serif';
  ctx.fillText(a.s, W / 2, 210);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 14; ctx.strokeRect(0, 0, W, H);
  return toTex(c);
}
