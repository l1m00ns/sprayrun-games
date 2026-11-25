// Hand-drawn icons: the snowboard / hoverboard. (The UI line icons come from Iconsax, see iconsax.js.)
// One outline shared by the SVG version (HUD, shop) and the canvas version (power-up texture).

// A board seen from above with a gentle side-cut: rounded nose and tail, narrower waist. 120 x 120 box, long axis horizontal.
export const BOARD_PATH = 'M30 45C20 45 8 51 8 60s12 15 22 15l14-2c8-1 24-1 32 0l14 2c10 0 22-6 22-15s-12-15-22-15l-14 2c-8 1-24 1-32 0z';

// c = { deck, rail, stripes? }. tilt in degrees.
export function boardSVG(c = {}, { tilt = -24, shadow = true } = {}) {
  const deck = c.deck || '#ffffff', rail = c.rail || '#1b9bd6', metal = '#c9ced8', dark = '#222733';
  const graphic = c.stripes
    ? [28, 40, 52, 64, 76, 88].map((x) => `<path d="M${x} 49l7 22" stroke="${rail}" stroke-width="5" stroke-linecap="round" opacity=".9"/>`).join('')
    : `<path d="M22 60h76" stroke="${rail}" stroke-width="6" stroke-linecap="round"/><circle cx="16" cy="60" r="2.6" fill="${rail}"/><circle cx="104" cy="60" r="2.6" fill="${rail}"/>`;
  const binding = (x, rot) => `<g transform="rotate(${rot} ${x} 60)"><rect x="${x - 9}" y="50" width="18" height="20" rx="5" fill="${dark}"/><rect x="${x - 9}" y="55" width="18" height="4" fill="${metal}"/><rect x="${x - 9}" y="62" width="18" height="4" fill="${metal}"/><rect x="${x - 6}" y="46" width="12" height="5" rx="2.5" fill="${dark}"/></g>`;
  return `<svg viewBox="0 0 120 120" aria-hidden="true">${shadow ? '<ellipse cx="60" cy="98" rx="42" ry="6" fill="rgba(0,0,0,.32)"/>' : ''}<g transform="rotate(${tilt} 60 60)">`
    + `<path d="${BOARD_PATH}" fill="${deck}" stroke="rgba(0,0,0,.4)" stroke-width="2.5" stroke-linejoin="round"/>`
    + `<path d="${BOARD_PATH}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.5" transform="translate(60 60) scale(.93 .8) translate(-60 -60)"/>`
    + graphic + binding(42, 14) + binding(78, -14) + '</g></svg>';
}

// Canvas drawing of the same board (used for the power-up texture). ctx is a 2D context; (cx, cy) centre, `s` = scale (1 = 120 px).
export function drawBoard(ctx, cx, cy, s, c = {}) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate((-24 * Math.PI) / 180); ctx.scale(s, s); ctx.translate(-60, -60);
  const p = new Path2D(BOARD_PATH);
  ctx.fillStyle = c.deck || '#fff'; ctx.fill(p);
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineJoin = 'round'; ctx.stroke(p);
  ctx.strokeStyle = c.rail || '#1b9bd6'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(22, 60); ctx.lineTo(98, 60); ctx.stroke();
  ctx.fillStyle = '#222733';
  for (const [x, r] of [[42, 14], [78, -14]]) { ctx.save(); ctx.translate(x, 60); ctx.rotate((r * Math.PI) / 180); ctx.beginPath(); ctx.roundRect(-9, -10, 18, 20, 5); ctx.fill(); ctx.restore(); }
  ctx.restore();
}
