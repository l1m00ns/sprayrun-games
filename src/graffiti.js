// Procedural graffiti: bubble letters with 3D extrusion, rims, gloss, halftone, drips and overspray,
// plus icons, comic bursts, wheat-paste stickers and roller-painted patches.
// Self-contained (no imports) so every texture generator can use it.

export const PALETTES = [
  { a: '#ff3d71', b: '#ff9a3d', out: '#2a0a2e', ext: '#8a1442', acc: '#ffe14a' },
  { a: '#29e0ff', b: '#4d7bff', out: '#071638', ext: '#1b3a9a', acc: '#ff5fd2' },
  { a: '#8dff5a', b: '#18c46a', out: '#04261a', ext: '#0c6a3c', acc: '#fff35a' },
  { a: '#ffe14a', b: '#ff8a1f', out: '#2b1204', ext: '#a8480a', acc: '#ff3d71' },
  { a: '#c78bff', b: '#ff5fd2', out: '#1a0734', ext: '#5a1d9a', acc: '#7dffe0' },
  { a: '#ffffff', b: '#bfe4ff', out: '#0a1f3d', ext: '#3d6fa8', acc: '#ff4d5e' },
  { a: '#ff5d5d', b: '#c4162e', out: '#1c0408', ext: '#6a0a1a', acc: '#ffd23f' },
  { a: '#5af2c4', b: '#2aa0ff', out: '#052428', ext: '#0f6a7a', acc: '#ff9a3d' },
  { a: '#ffb3e6', b: '#ff5fa2', out: '#2e0a24', ext: '#9a2a6a', acc: '#7dffe0' },
  { a: '#fff35a', b: '#6aff5a', out: '#10250a', ext: '#3a7a14', acc: '#ff3d71' },
];

export const WORDS = ['RUSH', 'ZIP', 'NOVA', 'YO', 'CREW', 'SPRAY', 'FLOW', 'BOLT', 'WILD', 'HYPE', 'KIT', 'REX', 'MIKA', 'DASH', 'JAM', 'VIBE',
  'POW', 'SKY', 'LOUD', 'FRESH', 'BEAT', 'GLOW', 'RAIL', 'SWAG', 'ZOOM', 'FIZZ', 'KING', 'BLAZE', 'ECHO', 'DRIP', 'FUNK', 'LUCKY', 'MOJO', 'TURBO',
  'RIOT', 'SOUL', 'WAVE', 'PIXEL', 'NEON', 'COOL', 'BOSS', 'RAD', 'SKATE', 'STORM', 'HEAT', 'OZ', 'ACE', 'JUMP', 'SPARK', 'KICK'];

const FONT = (s) => `${s}px "Lilita One", Impact, "Arial Black", sans-serif`;
const make = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(2, Math.ceil(w)); c.height = Math.max(2, Math.ceil(h)); return c; };
const pickOf = (rnd, a) => a[Math.floor(rnd() * a.length)];

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
export const paletteFromTriple = (t) => ({ a: t[0], b: t[1], out: t[2], ext: shade(t[0].length === 7 ? t[0] : '#888888', 0.45), acc: '#ffe14a' });

function overspray(ctx, rnd, cx, cy, spreadX, spreadY, n, color) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    ctx.globalAlpha = 0.08 + rnd() * 0.3;
    ctx.fillStyle = color;
    const s = 0.7 + rnd() * 1.8;
    ctx.fillRect(cx + Math.cos(a) * r * spreadX, cy + Math.sin(a) * r * spreadY, s, s);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- bubble letters
export function bubblePiece(ctx, text, cx, baseY, size, pal, rnd = Math.random, o = {}) {
  const wobble = o.wobble ?? 0.2;
  const m = make(8, 8).getContext('2d');
  m.font = FONT(size);
  const letters = [];
  let x = 0;
  for (const ch of text) {
    const w = m.measureText(ch).width, sc = 0.9 + rnd() * 0.22;
    letters.push({ ch, x: x + (w * sc) / 2, sc, rot: (rnd() - 0.5) * wobble, dy: (rnd() - 0.5) * size * 0.13 });
    x += w * sc * 0.97;
  }
  const width = x, pad = size * 0.7;
  const T = make(width + pad * 2, size * 2.1 + pad), t = T.getContext('2d');
  const ox = pad, oy = size * 1.4 + pad * 0.3;
  t.font = FONT(size); t.textAlign = 'center'; t.textBaseline = 'alphabetic'; t.lineJoin = 'round'; t.lineCap = 'round';
  const each = (fn) => { for (const l of letters) { t.save(); t.translate(ox + l.x, oy + l.dy); t.rotate(l.rot); t.scale(l.sc, l.sc); fn(l.ch); t.restore(); } };

  // 1. extrusion (3D depth, down-right)
  const depth = Math.max(2, Math.round(size * 0.1));
  t.fillStyle = pal.ext; t.strokeStyle = pal.ext; t.lineWidth = size * 0.27;
  for (let k = depth; k >= 1; k--) each((ch) => { t.save(); t.translate(k * 0.85, k * 0.85); t.strokeText(ch, 0, 0); t.fillText(ch, 0, 0); t.restore(); });
  // 2. outline (optional neon glow)
  if (o.glow) { t.shadowColor = pal.a; t.shadowBlur = size * 0.4; }
  t.strokeStyle = pal.out; t.lineWidth = size * 0.31;
  each((ch) => t.strokeText(ch, 0, 0));
  t.shadowBlur = 0;
  // 3. white rim
  t.strokeStyle = '#ffffff'; t.lineWidth = size * 0.15;
  each((ch) => t.strokeText(ch, 0, 0));
  // 4. fill layer (gradient + gloss + halftone + shade), composited only where paint exists
  const F = make(T.width, T.height), f = F.getContext('2d');
  f.font = FONT(size); f.textAlign = 'center'; f.lineJoin = 'round';
  const eachF = (fn) => { for (const l of letters) { f.save(); f.translate(ox + l.x, oy + l.dy); f.rotate(l.rot); f.scale(l.sc, l.sc); fn(l.ch); f.restore(); } };
  eachF((ch) => { const g = f.createLinearGradient(0, -size * 0.86, 0, size * 0.08); g.addColorStop(0, pal.a); g.addColorStop(1, pal.b); f.fillStyle = g; f.fillText(ch, 0, 0); });
  f.globalCompositeOperation = 'source-atop';
  eachF(() => { // diagonal gloss + lower shade
    f.fillStyle = 'rgba(255,255,255,0.42)'; f.save(); f.rotate(-0.25); f.fillRect(-size * 0.42, -size * 0.8, size * 0.5, size * 0.09); f.fillRect(-size * 0.42, -size * 0.66, size * 0.22, size * 0.05); f.restore();
    const sg = f.createLinearGradient(0, -size * 0.2, 0, size * 0.08); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.28)'); f.fillStyle = sg; f.fillRect(-size, -size * 0.2, size * 2, size * 0.3);
  });
  if (o.halftone !== false) { // halftone dots on the lower third
    f.fillStyle = 'rgba(0,0,0,0.16)';
    for (let yy = oy - size * 0.3; yy < oy + size * 0.1; yy += size * 0.07) for (let xx = ox; xx < ox + width; xx += size * 0.07) { f.beginPath(); f.arc(xx + ((yy / (size * 0.07)) % 2) * size * 0.035, yy, size * 0.016, 0, 6.3); f.fill(); }
  }
  f.globalCompositeOperation = 'source-over';
  t.drawImage(F, 0, 0);
  // 5. drips
  const drips = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < drips; i++) {
    const l = letters[Math.floor(rnd() * letters.length)];
    const dx = ox + l.x + (rnd() - 0.5) * size * 0.4, dy = oy + l.dy + size * 0.04, len = size * (0.16 + rnd() * 0.55), w = size * (0.055 + rnd() * 0.03);
    t.fillStyle = pal.out; t.fillRect(dx - w * 1.6, dy, w * 3.2, len); t.beginPath(); t.arc(dx, dy + len, w * 1.7, 0, 6.3); t.fill();
    t.fillStyle = pal.b; t.fillRect(dx - w * 0.9, dy, w * 1.8, len); t.beginPath(); t.arc(dx, dy + len, w * 1.0, 0, 6.3); t.fill();
    t.fillStyle = 'rgba(255,255,255,0.55)'; t.fillRect(dx - w * 0.5, dy, w * 0.35, len * 0.8);
  }
  // 6. overspray halo
  overspray(t, rnd, ox + width / 2, oy - size * 0.35, width * 0.62, size * 0.75, Math.round(size * 2.4), pal.a);
  overspray(t, rnd, ox + width / 2, oy - size * 0.35, width * 0.7, size * 0.85, Math.round(size * 1.2), pal.out);

  ctx.save();
  ctx.translate(cx, baseY);
  if (o.rot) ctx.rotate(o.rot);
  if (o.skew) ctx.transform(1, 0, o.skew, 1, 0, 0);
  ctx.drawImage(T, -T.width / 2, -oy);
  ctx.restore();
  return { width: T.width, height: T.height };
}

// ---------------------------------------------------------------------- icons
const ICONS = {
  star: 'M50 5 L61 38 L96 38 L68 59 L79 93 L50 72 L21 93 L32 59 L4 38 L39 38 Z',
  crown: 'M10 78 L10 30 L32 52 L50 18 L68 52 L90 30 L90 78 Z',
  bolt: 'M58 4 L18 56 L44 56 L36 96 L82 38 L54 38 Z',
  heart: 'M50 88 C10 56 6 28 28 18 C40 12 50 22 50 30 C50 22 60 12 72 18 C94 28 90 56 50 88 Z',
  flame: 'M50 4 C60 28 84 38 80 66 C77 86 62 96 50 96 C36 96 20 86 20 64 C20 48 34 42 38 28 C42 38 46 40 50 4 Z',
  ghost: 'M20 90 L20 44 C20 20 36 8 50 8 C64 8 80 20 80 44 L80 90 L68 78 L56 90 L44 78 L32 90 Z',
  cat: 'M12 14 L36 30 C44 28 56 28 64 30 L88 14 L88 60 C88 82 70 92 50 92 C30 92 12 82 12 60 Z',
  rocket: 'M50 4 C70 22 74 44 70 68 L30 68 C26 44 30 22 50 4 Z M30 56 L12 78 L30 74 Z M70 56 L88 78 L70 74 Z M40 70 L50 96 L60 70 Z',
  note: 'M40 10 L84 4 L84 66 C84 78 72 86 60 84 C48 82 44 72 52 64 C58 58 68 58 72 60 L72 22 L52 26 L52 76 C52 88 40 96 28 94 C16 92 12 80 20 70 C26 64 36 62 40 64 Z',
  sparkle: 'M50 2 L58 42 L98 50 L58 58 L50 98 L42 58 L2 50 L42 42 Z',
  can: 'M34 30 L66 30 L66 94 L34 94 Z M40 14 L60 14 L60 28 L40 28 Z M45 4 L55 4 L55 12 L45 12 Z',
  eye: 'M4 50 C24 20 76 20 96 50 C76 80 24 80 4 50 Z',
  skate: 'M6 40 L94 40 L94 56 L6 56 Z M20 62 A8 8 0 1 0 20 78 A8 8 0 1 0 20 62 Z M80 62 A8 8 0 1 0 80 78 A8 8 0 1 0 80 62 Z',
  smile: 'M50 4 A46 46 0 1 0 50 96 A46 46 0 1 0 50 4 Z',
};
export const ICON_NAMES = Object.keys(ICONS);

export function icon(ctx, kind, x, y, s, pal, rot = 0) {
  const p = new Path2D(ICONS[kind] || ICONS.star);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s / 100, s / 100); ctx.translate(-50, -50);
  ctx.lineJoin = 'round';
  ctx.save(); ctx.translate(5, 6); ctx.fillStyle = pal.ext; ctx.strokeStyle = pal.ext; ctx.lineWidth = 16; ctx.stroke(p); ctx.fill(p); ctx.restore();
  ctx.strokeStyle = pal.out; ctx.lineWidth = 16; ctx.stroke(p);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.stroke(p);
  const g = ctx.createLinearGradient(0, 0, 0, 100); g.addColorStop(0, pal.a); g.addColorStop(1, pal.b);
  ctx.fillStyle = g; ctx.fill(p);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(34, 26, 14, 6, -0.6, 0, 6.3); ctx.fill();
  if (kind === 'smile') { ctx.fillStyle = pal.out; ctx.beginPath(); ctx.arc(34, 40, 6, 0, 6.3); ctx.arc(66, 40, 6, 0, 6.3); ctx.fill(); ctx.strokeStyle = pal.out; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(50, 56, 22, 0.2, Math.PI - 0.2); ctx.stroke(); }
  if (kind === 'ghost' || kind === 'cat') { ctx.fillStyle = pal.out; ctx.beginPath(); ctx.ellipse(36, 48, 6, 9, 0, 0, 6.3); ctx.ellipse(64, 48, 6, 9, 0, 0, 6.3); ctx.fill(); }
  if (kind === 'eye') { ctx.fillStyle = pal.out; ctx.beginPath(); ctx.arc(50, 50, 14, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(45, 45, 4, 0, 6.3); ctx.fill(); }
  ctx.restore();
}

export function burst(ctx, rnd, x, y, r, color, out = '#111') {
  const n = 12 + Math.floor(rnd() * 6);
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.7 : r * (0.95 + rnd() * 0.15); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath();
  ctx.lineWidth = r * 0.12; ctx.strokeStyle = out; ctx.stroke(); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

// -------------------------------------------------------------- stickers / patches
export function sticker(ctx, rnd, x, y, w, h, title, sub, pal) {
  ctx.save(); ctx.translate(x, y); ctx.rotate((rnd() - 0.5) * 0.18);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-w / 2 + 4, -h / 2 + 5, w, h);
  ctx.fillStyle = pickOf(rnd, ['#f6efdc', '#fffaf0', '#efe4c8']); ctx.fillRect(-w / 2, -h / 2, w, h);
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, pal.a); g.addColorStop(1, pal.b);
  ctx.fillStyle = g; ctx.fillRect(-w / 2 + 6, -h / 2 + 6, w - 12, h * 0.58);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(-w / 2 + 8 + (i % 10) * (w / 10), -h / 2 + 10 + Math.floor(i / 10) * 7, 1.6, 0, 6.3); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.strokeStyle = pal.out; ctx.lineWidth = h * 0.1; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  ctx.font = FONT(h * 0.42); ctx.strokeText(title, 0, -h * 0.06); ctx.fillText(title, 0, -h * 0.06);
  ctx.fillStyle = '#2a2a33'; ctx.font = FONT(h * 0.17); ctx.fillText(sub, 0, h * 0.36);
  ctx.fillStyle = 'rgba(240,230,190,0.7)'; ctx.fillRect(-w / 2 - 4, -h / 2 - 2, 16, 8); ctx.fillRect(w / 2 - 12, h / 2 - 6, 16, 8); // tape
  // torn corner
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 - 18, h / 2); ctx.lineTo(w / 2, h / 2 - 18); ctx.fill();
  ctx.restore();
}
const STICKERS = [['SKATE NIGHT', 'SAT 9PM'], ['DJ RAVE', 'LIVE'], ['LOST CAT', 'CALL ME'], ['FIZZ COLA', 'ICE COLD'], ['WILD STYLE', 'CREW 7'], ['FREE RIDE', 'TONIGHT'], ['MOJO', 'TOUR 26'], ['NO PARKING', 'REALLY'], ['LOUD', 'ZONE 5'], ['PIZZA', 'SLICE 2']];

export function patch(ctx, rnd, x, y, w, h, color) {
  ctx.save();
  ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 0.14; ctx.fillStyle = '#000';
  for (let i = 0; i < 14; i++) ctx.fillRect(x + rnd() * w, y, 2 + rnd() * 3, h);
  ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x + w - 3, y, 3, h);
  ctx.restore();
}

export function handTag(ctx, rnd, text, x, y, size, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate((rnd() - 0.5) * 0.3); ctx.transform(1, 0, -0.25, 1, 0, 0);
  ctx.font = FONT(size); ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, size * 0.075);
  for (let k = 0; k < 2; k++) { ctx.save(); ctx.translate((rnd() - 0.5) * 2.4, (rnd() - 0.5) * 2.4); ctx.strokeText(text, 0, 0); ctx.restore(); }
  ctx.beginPath(); ctx.moveTo(-size * 0.9, size * 0.18); ctx.bezierCurveTo(-size * 0.2, size * 0.4, size * 0.5, size * 0.05, size * 1.0, size * 0.26); ctx.stroke(); // underline swoosh
  ctx.restore();
}

// -------------------------------------------------------------- compositions
// A single big piece (letters + decorations) centred at (cx, baseY).
export function piece(ctx, rnd, cx, baseY, size, o = {}) {
  const pal = o.pal || pickOf(rnd, PALETTES), word = o.word || pickOf(rnd, WORDS);
  const kind = o.kind || pickOf(rnd, ['bubble', 'bubble', 'burst', 'icon', 'throwup']);
  const w = word.length * size * 0.62;
  if (kind === 'burst') burst(ctx, rnd, cx, baseY - size * 0.3, Math.max(w * 0.62, size * 1.1), pal.acc, pal.out);
  const r = bubblePiece(ctx, word, cx, baseY, size, pal, rnd, { wobble: kind === 'throwup' ? 0.1 : 0.24, glow: o.glow, rot: (rnd() - 0.5) * 0.1, skew: (rnd() - 0.5) * 0.14, halftone: kind !== 'throwup' });
  const deco = Math.floor(rnd() * 3);
  for (let i = 0; i < deco; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    icon(ctx, pickOf(rnd, ICON_NAMES), cx + side * (w / 2 + size * (0.15 + rnd() * 0.5)), baseY - size * (0.4 + rnd() * 0.7), size * (0.32 + rnd() * 0.3), o.pal || pickOf(rnd, PALETTES), (rnd() - 0.5) * 0.7);
  }
  if (kind === 'icon') icon(ctx, pickOf(rnd, ICON_NAMES), cx, baseY - size * 1.4, size * 0.55, pal, (rnd() - 0.5) * 0.3);
  return r;
}

// Fill a wall-like canvas (W x H, device pixels) with a layered collage of street art.
export function paintWall(ctx, W, H, rnd, o = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pals = o.neon ? PALETTES.slice(1, 5).concat([PALETTES[4], PALETTES[7]]) : PALETTES;
  // 1. repainted rectangles (what a city does to a wall)
  const patches = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < patches; i++) patch(ctx, rnd, rnd() * W * 0.8, H * (0.05 + rnd() * 0.25), W * (0.12 + rnd() * 0.25), H * (0.5 + rnd() * 0.45), pickOf(rnd, o.patchColors || ['rgba(120,120,128,0.55)', 'rgba(150,140,130,0.5)', 'rgba(70,80,96,0.5)', 'rgba(190,175,150,0.45)']));
  // 2. stickers
  const stickers = 2 + Math.floor(rnd() * 4);
  for (let i = 0; i < stickers; i++) { const s = pickOf(rnd, STICKERS); sticker(ctx, rnd, W * (0.05 + rnd() * 0.9), H * (0.18 + rnd() * 0.3), H * (0.28 + rnd() * 0.12), H * (0.2 + rnd() * 0.08), s[0], s[1], pickOf(rnd, pals)); }
  // 3. big pieces across the wall
  const n = Math.max(2, Math.round(W / (H * 2.6)));
  const slot = W / n;
  for (let i = 0; i < n; i++) {
    const size = H * (0.38 + rnd() * 0.22);
    piece(ctx, rnd, slot * (i + 0.5) + (rnd() - 0.5) * slot * 0.2, H * (0.7 + rnd() * 0.18), size, { pal: pickOf(rnd, pals), glow: o.neon, word: o.words ? pickOf(rnd, o.words) : undefined });
  }
  // 4. hand-style tags and loose icons
  const tags = 3 + Math.floor(rnd() * 5);
  for (let i = 0; i < tags; i++) handTag(ctx, rnd, pickOf(rnd, WORDS), W * rnd(), H * (0.2 + rnd() * 0.6), H * (0.1 + rnd() * 0.08), pickOf(rnd, ['#111', '#f4f4f4', pickOf(rnd, pals).a, '#ff3d71']));
  for (let i = 0; i < 4; i++) icon(ctx, pickOf(rnd, ICON_NAMES), W * rnd(), H * (0.2 + rnd() * 0.65), H * (0.12 + rnd() * 0.1), pickOf(rnd, pals), (rnd() - 0.5) * 0.8);
  // 5. splatter
  for (let i = 0; i < 90; i++) { ctx.globalAlpha = 0.5 + rnd() * 0.5; ctx.fillStyle = pickOf(rnd, pals).a; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 0.8 + rnd() * 2.2, 0, 6.3); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// A tag for the side of a train (the lower body below the windows).
export function paintTrainSide(ctx, W, H, rnd, o = {}) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const n = rnd() < 0.5 ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const size = H * (0.26 + rnd() * 0.12);
    piece(ctx, rnd, W * (0.18 + rnd() * 0.64), H * (0.9 + rnd() * 0.04), size, { kind: rnd() < 0.6 ? 'bubble' : 'throwup', glow: o.glow });
  }
  if (rnd() < 0.7) handTag(ctx, rnd, pickOf(rnd, WORDS), W * (0.1 + rnd() * 0.8), H * (0.6 + rnd() * 0.2), H * 0.12, '#f4f4f4');
  ctx.restore();
}
