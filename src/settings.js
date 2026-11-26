// Data-driven settings: one schema renders the whole settings modal and defines every default.
// Values live in save.settings (and are therefore part of the cloud save).
export const SCHEMA = [
  { tab: 'Gameplay', items: [
    { k: 'lang', label: 'Language', type: 'select', def: 'en', opts: [['en', 'English'], ['fr', 'Français']] },
    { k: 'controls', label: 'Control feel', type: 'select', def: 'snappy', opts: [['snappy', 'Snappy (instant)'], ['classic', 'Classic (authentic)']], hint: 'Snappy: near-instant lane switches, inputs applied the moment you press.' },
    { k: 'showTimer', label: 'Show run timer', type: 'toggle', def: true },
    { k: 'autoPause', label: 'Pause when the tab is hidden', type: 'toggle', def: true },
    { k: 'seasonal', label: 'Seasonal themes (Winter Fest)', type: 'toggle', def: true },
    { k: 'tips', label: 'Gameplay hints', type: 'toggle', def: true },
    { k: 'telemetry', label: 'Usage analytics', type: 'toggle', def: true, hint: 'Sessions, runs and performance samples help find bugs and balance the game. IP addresses are kept 30 days, then erased. Turn it off to send nothing.' },
    { k: 'rivalGhost', label: 'Practice ghost', type: 'toggle', def: false, hint: 'Adds a translucent bot ghost that runs the same track and dodges walls. It never collides, scores or counts as a player. Off by default.' },
  ] },
  { tab: 'Graphics', items: [
    { k: 'quality', label: 'Graphics preset', type: 'select', def: 'high', opts: [['high', 'High (bloom, outlines, shadows)'], ['medium', 'Balanced (shadows, no post-processing)'], ['low', 'Performance (fastest)'], ['potato', 'Potato (old computers)']], hint: 'Picked for your graphics card on first launch. Performance and Potato also start without anti-aliasing after a reload.' },
    { k: 'autoQuality', label: 'Automatic graphics', type: 'toggle', def: true, hint: 'Measures the first frames at every launch and moves the preset up or down to keep the game smooth. Turn it off after picking a preset yourself.' },
    { k: 'renderScale', label: 'Resolution scale', type: 'range', def: 1, min: 0.4, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
    { k: 'shadowQuality', label: 'Shadow quality', type: 'select', def: 'auto', opts: [['auto', 'Automatic (from preset)'], ['low', 'Low'], ['high', 'High']], hint: 'Does nothing while the preset has shadows off.' },
    { k: 'particles', label: 'Particle density', type: 'range', def: 1, min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, hint: 'Sparks, dust, smoke, coin bursts. Lower it on a slow machine.' },
    { k: 'speedFx', label: 'Speed blur and zoom', type: 'toggle', def: true, hint: 'The radial blur and the field-of-view punch at high speed.' },
    { k: 'autoRes', label: 'Adaptive resolution', type: 'toggle', def: true, hint: 'Lowers the resolution when the frame rate drops and raises it back when there is room. Never goes above the scale you chose.' },
    { k: 'outline', label: 'Cartoon outlines', type: 'toggle', def: true },
    { k: 'bloom', label: 'Bloom glow', type: 'toggle', def: true },
    { k: 'shadows', label: 'Shadows', type: 'toggle', def: true },
    { k: 'weather', label: 'Weather effects', type: 'toggle', def: true },
    { k: 'fpsCap', label: 'Frame rate limit', type: 'select', def: '0', opts: [['0', 'Unlimited (display rate)'], ['60', '60 FPS'], ['30', '30 FPS']] },
    { k: 'showFps', label: 'Show FPS counter', type: 'toggle', def: false },
  ] },
  { tab: 'Camera', items: [
    { k: 'camera', label: 'Camera distance', type: 'select', def: 'normal', opts: [['close', 'Close'], ['normal', 'Normal'], ['far', 'Far']] },
    { k: 'fov', label: 'Field of view', type: 'range', def: 58, min: 50, max: 80, step: 1, fmt: (v) => `${v}°` },
    { k: 'dynFov', label: 'Speed FOV effect', type: 'toggle', def: true },
    { k: 'tilt', label: 'Camera tilt in turns', type: 'toggle', def: true },
    { k: 'shake', label: 'Screen shake', type: 'toggle', def: true },
  ] },
  { tab: 'Audio', items: [
    { k: 'music', label: 'Music', type: 'range', def: 0.55, min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
    { k: 'sfx', label: 'Effects', type: 'range', def: 0.9, min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
    { k: 'muteBlur', label: 'Mute when the tab is hidden', type: 'toggle', def: true },
  ] },
  { tab: 'Controls', items: [
    { k: 'swipe', label: 'Swipe distance (touch)', type: 'range', def: 34, min: 16, max: 70, step: 2, fmt: (v) => `${v}px`, hint: 'Smaller = more sensitive.' },
    { k: 'keyHints', label: 'Show key hints in the menu', type: 'toggle', def: true },
    { k: 'mouseSens', label: 'Duel: mouse sensitivity', type: 'range', def: 1, min: 0.2, max: 3, step: 0.05, fmt: (v) => `${v.toFixed(2)}x` },
    { k: 'duelFov', label: 'Duel: field of view', type: 'range', def: 90, min: 70, max: 110, step: 1, fmt: (v) => `${v}°` },
    { k: 'invertY', label: 'Duel: invert vertical look', type: 'toggle', def: false },
    { k: 'crosshair', label: 'Duel: crosshair', type: 'select', def: 'cross', opts: [['cross', 'Cross'], ['dot', 'Dot'], ['circle', 'Circle'], ['none', 'None']] },
    { k: 'crossColor', label: 'Duel: crosshair colour', type: 'select', def: '#42e07a', opts: [['#42e07a', 'Green'], ['#ffffff', 'White'], ['#ffd23f', 'Yellow'], ['#29d6ff', 'Cyan'], ['#ff3d7f', 'Pink']] },
    { k: 'duelBot', label: 'Gold Rush: practice bot', type: 'select', def: 'easy', opts: [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['pro', 'Pro']], hint: 'Only used offline, in a practice duel.' },
  ] },
  { tab: 'Access', items: [
    { k: 'reduceMotion', label: 'Reduce motion', type: 'toggle', def: false, hint: 'No screen shake, bloom pulses or FOV effects; calmer menus.' },
    { k: 'uiScale', label: 'Interface size', type: 'range', def: 1, min: 0.85, max: 1.3, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
    { k: 'highContrast', label: 'High-contrast HUD', type: 'toggle', def: false },
    { k: 'colorBlind', label: 'Colour-blind warnings', type: 'toggle', def: false, hint: 'Warning triangles use blue/orange and shapes instead of red/green.' },
  ] },
];

export const defaults = () => { const o = {}; for (const g of SCHEMA) for (const it of g.items) o[it.k] = it.def; return o; };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Renders one tab into `body`. `onChange(key, value)` is called after each edit.
export function renderTab(body, tabName, settings, onChange) {
  const group = SCHEMA.find((g) => g.tab === tabName) || SCHEMA[0];
  body.innerHTML = group.items.map((it) => {
    const v = settings[it.k] ?? it.def;
    let ctl = '';
    if (it.type === 'toggle') ctl = `<label class="sw"><input type="checkbox" data-k="${it.k}" ${v !== false ? 'checked' : ''}><i></i></label>`;
    else if (it.type === 'select') ctl = `<select data-k="${it.k}">${it.opts.map(([val, name]) => `<option value="${esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select>`;
    else ctl = `<input type="range" data-k="${it.k}" min="${it.min}" max="${it.max}" step="${it.step}" value="${v}"><output data-o="${it.k}">${it.fmt(Number(v))}</output>`;
    return `<div class="set-row"><span>${esc(it.label)}${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</span><div class="set-ctl">${ctl}</div></div>`;
  }).join('');
  for (const el of body.querySelectorAll('[data-k]')) {
    const it = group.items.find((x) => x.k === el.dataset.k);
    const read = () => (it.type === 'toggle' ? el.checked : it.type === 'range' ? Number(el.value) : (['fpsCap'].includes(it.k) ? el.value : el.value));
    el.addEventListener(it.type === 'range' ? 'input' : 'change', () => {
      const val = read();
      if (it.type === 'range') { const o = body.querySelector(`[data-o="${it.k}"]`); if (o) o.textContent = it.fmt(val); }
      onChange(it.k, val);
    });
  }
}
