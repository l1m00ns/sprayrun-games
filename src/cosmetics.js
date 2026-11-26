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
  o_bunny:     { top: '#f7e8f0', accent: '#ff9fc8', pants: '#f4f0ff', shoes: '#ffd1e8', sole: '#8a5a7a', hat: 'bunny', hatColor: '#f7e8f0', jacket: 'puffer', shine: true },
  o_pumpkin:   { top: '#2a1420', accent: '#ff7a1a', pants: '#1a0f18', shoes: '#ff9f1c', sole: '#1a0f18', hat: 'bucket', hatColor: '#ff7a1a', jacket: 'puffer' },
};
// Hoverboard skins: deck + rail colours (+ emissive glow).
export const BOARDS = {
  default:   { deck: '#ffffff', rail: '#1b9bd6', glow: 0x29d6ff },
  b_sunset:  { deck: '#ff9f5a', rail: '#ff3d7f', glow: 0xff7a5a },
  b_neon:    { deck: '#101830', rail: '#29f0ff', glow: 0x29f0ff },
  b_gold:    { deck: '#ffe27a', rail: '#d9a021', glow: 0xffc933 },
  b_candy:   { deck: '#ffffff', rail: '#e0344a', glow: 0xff5a6a, stripes: true },
  b_aurora:  { deck: '#2bffb0', rail: '#9b5cff', glow: 0x6affc8 },
  b_egg:     { deck: '#ffe9f2', rail: '#ff9fc8', glow: 0xffb8d4, stripes: true },
  b_broom:   { deck: '#5a3a22', rail: '#ffb347', glow: 0xff8a2a, stripes: true },
};
// Trails: colour(s) of the particles left behind while running / boarding.
export const TRAILS = {
  t_sparks: { color: 0xffd23f, kind: 'spark' },
  t_stars:  { color: 0xfff6c0, kind: 'star' },
  t_snow:   { color: 0xcfe9ff, kind: 'snow' },
  t_petals: { color: 0xffb8d4, kind: 'star' },
  t_embers: { color: 0xff7a1a, kind: 'spark' },
};

// Skins: a different look (skin tone, hair, eyes) applied on top of any runner.
export const SKINS = {
  sk_ocean: { skin: '#5fb4e6', hair: '#d9f0ff', eyes: '#0b3a6a' },
  sk_ghost: { skin: '#d9ecff', hair: '#8aa6ff', eyes: '#6a5cff' },
  sk_lava:  { skin: '#3a2a2a', hair: '#ff6a1a', eyes: '#ffb347' },
  sk_crown: { skin: '#f2c14a', hair: '#fff2b0', eyes: '#7a4a00' },
};
// Backpacks are drawn by characters.js (buildBagVariant); this list gives the shop its colours.
export const BAGS = { bg_cat: '#f5efe6', bg_rocket: '#e8e8ee', bg_guitar: '#7a4a2a', bg_wings: '#ffffff', bg_cube: '#29f0ff', bg_cup: '#ffd23f', bg_basket: '#b98a55', bg_bat: '#2a2038', bg_boombox: '#20242e' };
// Auras: two colours (rings + rising sparks) and a feel.
export const AURAS = {
  au_ember: { color: 0xff7a1a, color2: 0xffd23f, kind: 'ember' },
  au_frost: { color: 0x7ec8ff, color2: 0xffffff, kind: 'frost' },
  au_volt:  { color: 0x29d6ff, color2: 0xffffff, kind: 'volt' },
  au_royal: { color: 0xffd23f, color2: 0xff3d7f, kind: 'royal' },
  au_dawn:  { color: 0xff9f5a, color2: 0xff3d7f, kind: 'dawn' },
  au_bloom: { color: 0xff9fc8, color2: 0xfff0f6, kind: 'frost' },
  au_spirit: { color: 0x9b5cff, color2: 0xd8c8ff, kind: 'volt' },
};
// Run styles: how the runner moves (stride rate/size, forward lean, arms swept back, bounce, pumping arms).
export const STYLES = {
  st_chill:    { rate: 0.8, amp: 0.7, lean: -0.05, armsBack: 0, bounce: 0.3, pump: 0 },
  st_ninja:    { rate: 1.1, amp: 1.0, lean: 0.35, armsBack: 2.1, bounce: 0.1, pump: 0 },
  st_bounce:   { rate: 0.95, amp: 1.0, lean: 0, armsBack: 0, bounce: 2.4, pump: 0 },
  st_sprinter: { rate: 1.2, amp: 1.3, lean: 0.22, armsBack: 0, bounce: 0.8, pump: 1 },
};

// The runner definition actually built for the player: base character + everything equipped. `equip` is the inventory's equip
// object ({ outfit, skin, bag, aura, style }); a plain outfit id is still accepted.
export function dressed(def, equip) {
  const e = typeof equip === 'string' ? { outfit: equip } : (equip || {});
  let out = def;
  if (e.outfit && OUTFITS[e.outfit]) out = { ...out, ...OUTFITS[e.outfit], id: def.id };
  if (e.skin && SKINS[e.skin]) out = { ...out, ...SKINS[e.skin], id: def.id };
  if (e.bag && BAGS[e.bag]) out = { ...out, bagId: e.bag };
  if (e.aura && AURAS[e.aura]) out = { ...out, auraId: e.aura };
  if (e.style && STYLES[e.style]) out = { ...out, styleId: e.style };
  return out;
}
