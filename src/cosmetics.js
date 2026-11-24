// Cosmetic definitions shared by the shop (previews) and the engine (what actually gets drawn).
// Ids match server/catalog.mjs. Everything here is original art direction.

// Outfits override parts of a runner's palette (and optionally the hat). `puffer` keeps the quilted jacket silhouette.
export const OUTFITS = {
  o_street:    { top: '#1b1f3a', accent: '#2bdcff', pants: '#2a2f4a', shoes: '#2bdcff', sole: '#ffffff', jacket: 'puffer' },
  o_gold:      { top: '#f2b51d', accent: '#fff2b0', pants: '#3a2a10', shoes: '#fff2b0', sole: '#f2b51d', jacket: 'puffer', shine: true },
  o_shadow:    { top: '#15151f', accent: '#a366ff', pants: '#0d0d14', shoes: '#1a1a26', sole: '#a366ff', jacket: 'puffer' },
  o_santa:     { top: '#d6212e', accent: '#ffffff', pants: '#8f1420', shoes: '#2a1a12', sole: '#ffffff', hat: 'santa', hatColor: '#d6212e', jacket: 'puffer' },
  o_elf:       { top: '#1f9b4d', accent: '#ffd23f', pants: '#c8242f', shoes: '#ffd23f', sole: '#1f9b4d', hat: 'elf', hatColor: '#1f9b4d' },
  o_frostking: { top: '#7ec8ff', accent: '#ffffff', pants: '#2a4a78', shoes: '#ffffff', sole: '#7ec8ff', hat: 'crown', hatColor: '#cfeaff', jacket: 'puffer', shine: true },
};
// Hoverboard skins: deck + rail colours (+ emissive glow).
export const BOARDS = {
  default:   { deck: '#ffffff', rail: '#1b9bd6', glow: 0x29d6ff },
  b_sunset:  { deck: '#ff9f5a', rail: '#ff3d7f', glow: 0xff7a5a },
  b_neon:    { deck: '#101830', rail: '#29f0ff', glow: 0x29f0ff },
  b_gold:    { deck: '#ffe27a', rail: '#d9a021', glow: 0xffc933 },
  b_candy:   { deck: '#ffffff', rail: '#e0344a', glow: 0xff5a6a, stripes: true },
  b_aurora:  { deck: '#2bffb0', rail: '#9b5cff', glow: 0x6affc8 },
};
// Trails: colour(s) of the particles left behind while running / boarding.
export const TRAILS = {
  t_sparks: { color: 0xffd23f, kind: 'spark' },
  t_stars:  { color: 0xfff6c0, kind: 'star' },
  t_snow:   { color: 0xcfe9ff, kind: 'snow' },
};

// The runner definition actually built for the player: base character + equipped outfit.
export function dressed(def, outfitId) {
  const o = outfitId && OUTFITS[outfitId];
  return o ? { ...def, ...o, id: def.id } : def;
}
