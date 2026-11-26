// The game modes you can pick above the PLAY button (Fortnite-style): limited-time, ranked and normal in Solo / Duos / Trios,
// plus the offline modes. `art` is drawn here (no image files): a gradient scene, a big Iconsax emblem and one dot per teammate.
import { icon } from './iconsax.js';

export const CATS = [
  ['ltm', 'Limited-time'],
  ['ranked', 'Ranked'],
  ['normal', 'Normal'],
  ['other', 'Other modes'],
];

const SIZES = ['', 'Solo', 'Duos', 'Trios'];
const rankedBlurb = ['', 'Free for all, up to 4 runners. Rating moves with your placement.', '2 v 2. You and a partner against another pair: team score decides.', '3 v 3. Your trio against another trio: team score decides.'];
const normalBlurb = ['', 'Free for all, up to 4 runners. No rating at stake.', '2 v 2, just for fun. Queue alone or with a friend.', '3 v 3, just for fun. Bring two friends or get matched.'];

export const MODES = [
  { id: 'neonrush', cat: 'ltm', name: 'Neon Rush', tag: 'After dark, every rail glows', blurb: 'The city goes dark and the track lights up. A free Double Score at the start, a magnet at 400 m, and neon everywhere. Limited-time event.', online: false, size: 1, mode: 'classic', event: 'neon', colors: ['#16002e', '#ff2bd6'], ic: 'power', label: 'Limited time' },
  ...[1, 2, 3].map((n) => ({ id: `ranked-${n}`, cat: 'ranked', name: `Ranked ${SIZES[n]}`, tag: n === 1 ? 'Free for all' : `${n} v ${n}`, blurb: rankedBlurb[n], online: true, kind: 'ranked', size: n, colors: ['#3a1a6a', '#b04dff'], ic: 'crown', label: SIZES[n] })),
  ...[1, 2, 3].map((n) => ({ id: `normal-${n}`, cat: 'normal', name: `Normal ${SIZES[n]}`, tag: n === 1 ? 'Free for all' : `${n} v ${n}`, blurb: normalBlurb[n], online: true, kind: 'normal', size: n, colors: ['#0e4a7a', '#29d6ff'], ic: 'flag', label: SIZES[n] })),
  { id: 'solo-classic', cat: 'other', name: 'Classic Run', tag: 'Offline, just you', blurb: 'Collect coins and survive as long as you can. Works without a connection.', online: false, size: 1, mode: 'classic', colors: ['#6a3a00', '#ff9a1f'], ic: 'coin', label: 'Offline' },
  { id: 'solo-nocoin', cat: 'other', name: 'No Coin', tag: 'Offline, coins are traps', blurb: 'Touch one coin and it is over. Pure dodging.', online: false, size: 1, mode: 'nocoin', colors: ['#5a0e1a', '#ff4d6a'], ic: 'shield', label: 'Offline' },
  { id: 'fun-zigzag', cat: 'other', name: 'Zigzag Rails', tag: 'The track snakes and rolls', blurb: 'A fun mode: the rails swing left and right and roll over hills, and your runner follows the path.', online: false, size: 1, mode: 'classic', fun: 'zigzag', colors: ['#4a1a6a', '#ff3dd0'], ic: 'magic', label: 'Fun' },
  { id: 'explore', cat: 'other', name: 'Explore', tag: 'Walk the map, no obstacles', blurb: 'No trains, no crashes: stroll along the map at your own pace. Move with the arrow keys or WASD, Shift to run.', online: false, size: 1, mode: 'classic', explore: true, colors: ['#0e5a5a', '#42e0c0'], ic: 'map', label: 'Open world' },
  { id: 'daily', cat: 'other', name: 'Daily Run', tag: 'Same track for everyone', blurb: 'One seeded track per day: the same obstacles for every player, on the daily board.', online: false, size: 1, colors: ['#0e5a3a', '#42e07a'], ic: 'events', label: 'Daily' },
  { id: 'room', cat: 'other', name: 'Custom Room', tag: 'Code, friends, your rules', blurb: 'Create a room, share its code and race your friends on the map you choose.', online: true, room: true, size: 1, colors: ['#3a3a4a', '#9aa2b1'], ic: 'game', label: 'Room' },
];
export const modeById = (id) => MODES.find((m) => m.id === (id === 'goldrush' ? 'neonrush' : id)) || MODES.find((m) => m.id === 'normal-1'); // old saves picked Gold Rush
export const specOf = (m, rules) => ({ kind: m.kind === 'ranked' ? 'ranked' : 'normal', size: m.size, mode: rules === 'nocoin' ? 'nocoin' : 'classic' });
export const sizeName = (n) => SIZES[n] || 'Solo';
export function modeFromSpec(spec) { return MODES.find((m) => m.kind === spec.kind && m.size === spec.size) || modeById('normal-1'); }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// A 160 x 100 picture for a mode.
export function modeArt(m, { size = 'md' } = {}) {
  const [a, b] = m.colors;
  const id = `g${m.id.replace(/[^a-z0-9]/gi, '')}`;
  const heads = Array.from({ length: m.size }, (_, i) => `<circle cx="${(m.size === 1 ? 0 : 6 - m.size * 6) + 18 + i * 13}" cy="0" r="5" fill="#fff" opacity=".95"/><rect x="${(m.size === 1 ? 0 : 6 - m.size * 6) + 13 + i * 13}" y="6" width="10" height="9" rx="4" fill="#fff" opacity=".8"/>`).join('');
  const team = m.size > 1 ? `<g transform="translate(${100 - m.size * 6} 82)">${heads}</g>` : m.size === 1 && m.kind ? `<g transform="translate(112 82)">${heads}</g>` : '';
  const rails = `<path d="M-10 100 L70 40 M170 100 L90 40 M-10 84 L68 34 M170 84 L92 34" stroke="rgba(255,255,255,.14)" stroke-width="3" fill="none"/>`;
  const sun = m.event === 'neon' ? '<circle cx="80" cy="48" r="38" fill="rgba(255,255,255,.18)"/><circle cx="80" cy="48" r="46" fill="none" stroke="rgba(255,120,230,.55)" stroke-width="2"/>' : '';
  return `<svg class="mart ${size}" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`
    + `<rect width="160" height="100" fill="url(#${id})"/>${rails}${sun}<g transform="translate(52 12) scale(2.8)" color="#fff" opacity=".95">${(icon(m.ic, 24).match(/<svg[^>]*>([\s\S]*)<\/svg>/) || [, ''])[1]}</g>${team}</svg>`;
}
export const labelOf = (m) => esc(m.name);
