// First-visit welcome flow (language, look & feel, controls & camera, fair play & privacy, account) + the language picker.
import { LANGS, getLang, setLang, detectLang, t, flagUrl } from './i18n.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Option cards: [value, title, description]
const CARDS = {
  quality: [['low', 'Performance', 'Smooth on any computer.'], ['medium', 'Balanced', 'Shadows on, no post-processing.'], ['high', 'High (bloom + shadows)', 'Best looking, needs a decent GPU.']],
  controls: [['snappy', 'Snappy (instant)', 'Near-instant lane switches. Recommended.'], ['classic', 'Classic (authentic)', 'The original, slower lane change.']],
  camera: [['close', 'Close', 'Tight behind the runner.'], ['normal', 'Normal', 'Balanced view.'], ['far', 'Far', 'See more of the track.']],
};

export function createOnboarding(ctx) {
  const { save, persist, applySettings } = ctx;
  let step = 0;
  // One screen, one decision: language then PLAY. Everything else lives in the menu drawer and Settings.
  // This keeps the first visit on the "open the site, play" path instead of a five-step questionnaire.
  const STEPS = ['welcome'];

  const cards = (key, list, cur) => `<div class="obcards" data-key="${key}">${list.map(([v, title, d]) => `<button class="obcard${String(cur) === String(v) ? ' sel' : ''}" data-v="${esc(v)}"><b>${esc(t(title))}</b><small>${esc(t(d))}</small></button>`).join('')}</div>`;
  const toggle = (key, label, cur) => `<div class="set-row"><span>${esc(label)}</span><div class="set-ctl"><label class="sw"><input type="checkbox" data-t="${key}" ${cur ? 'checked' : ''}><i></i></label></div></div>`;

  function render() {
    const s = save.settings, name = STEPS[step];
    $('obDots').innerHTML = '';
    let h = '';
    if (name === 'welcome') h = `<h2 class="ink">${esc(t('WELCOME'))}</h2><p class="stage-note">${esc(t('Choose your language'))}</p><div class="obcards big langs" data-key="lang">${LANGS.map(([c, n]) => `<button class="obcard${getLang() === c ? ' sel' : ''}" data-v="${c}"><img class="flag" src="${flagUrl(c)}" alt=""><b>${n}</b></button>`).join('')}</div><p class="stage-note">${esc(t('Start right now.'))}</p><p class="stage-note">${esc(t('By continuing you accept the'))} <a href="/terms" target="_blank" rel="noopener">${esc(t('Terms of Service'))}</a> ${esc(t('and the'))} <a href="/privacy" target="_blank" rel="noopener">${esc(t('Privacy Policy'))}</a>.</p>`;
    else if (name === 'look') h = `<h2 class="ink">Look &amp; feel</h2>${cards('quality', CARDS.quality, s.quality)}<div class="set-row"><span>Music</span><div class="set-ctl"><input type="range" data-r="music" min="0" max="1" step="0.05" value="${s.music}"></div></div><div class="set-row"><span>Effects</span><div class="set-ctl"><input type="range" data-r="sfx" min="0" max="1" step="0.05" value="${s.sfx}"></div></div>${toggle('seasonal', 'Seasonal themes (Winter Fest)', s.seasonal !== false)}${toggle('weather', 'Weather effects', s.weather !== false)}<p class="stage-note">You can change all of this later in Settings.</p>`;
    else if (name === 'controls') h = `<h2 class="ink">Controls &amp; camera</h2><p class="stage-note">Control feel</p>${cards('controls', CARDS.controls, s.controls || 'snappy')}<p class="stage-note">Camera distance</p>${cards('camera', CARDS.camera, s.camera || 'normal')}${toggle('keyHints', 'Show key hints in the menu', s.keyHints !== false)}${toggle('reduceMotion', 'Reduce motion', !!s.reduceMotion)}`;
    else if (name === 'privacy') h = `<h2 class="ink">Fair play &amp; privacy</h2><div class="obtext"><p>${esc(t('To keep ranked fair, the server runs fair-play checks when you play online:'))}</p><ul>${[['Network check', 'VPN, proxy and datacenter connections cannot play online (offline play always works).'], ['Device signals', 'screen, graphics card, timezone, language and a random device id, stored as irreversible hashes, only to detect duplicate accounts and ban evasion.'], ['Gameplay validation', 'scores, speed and movement are checked by the server. Impossible values lead to a kick or a ban, which you can contest from the Support tab.']].map(([a, b]) => `<li><b>${esc(t(a))}</b> - ${esc(t(b))}</li>`).join('')}</ul><p>${esc(t('Ranked unlocks after a minimum amount of play time. Nothing here is sold or shared for advertising.'))}</p><p class="stage-note">${esc(t('By continuing you accept the'))} <a href="/terms" target="_blank" rel="noopener">${esc(t('Terms of Service'))}</a> ${esc(t('and the'))} <a href="/privacy" target="_blank" rel="noopener">${esc(t('Privacy Policy'))}</a>.</p></div>`;
    else h = `<h2 class="ink">Your account</h2><p class="stage-note">${esc(t('Keep your coins, runners and rank on every device. You can also play as a guest and create an account later.'))}</p><div class="obcards big"><button class="obcard" data-act="register"><b>${esc(t('CREATE ACCOUNT'))}</b><small>${esc(t('Username + password, cloud save.'))}</small></button><button class="obcard sel" data-act="guest"><b>${esc(t('CONTINUE AS GUEST'))}</b><small>${esc(t('Start right now.'))}</small></button></div>`;
    $('obBody').innerHTML = h;
    $('obBack').style.visibility = 'hidden';
    $('obNext').textContent = t('PLAY NOW');
    $('obNext').style.display = '';
    for (const grp of $('obBody').querySelectorAll('.obcards[data-key]')) {
      for (const b of grp.querySelectorAll('.obcard')) b.onclick = () => {
        const key = grp.dataset.key, v = b.dataset.v;
        if (key === 'lang') { setLang(v); save.settings.lang = v; persist(); render(); return; }
        save.settings[key] = v; applySettings(key); persist(); render();
      };
    }
    for (const el of $('obBody').querySelectorAll('[data-t]')) el.onchange = () => { save.settings[el.dataset.t] = el.checked; applySettings(el.dataset.t); persist(); };
    for (const el of $('obBody').querySelectorAll('[data-r]')) el.oninput = () => { save.settings[el.dataset.r] = Number(el.value); applySettings(el.dataset.r); };
    for (const b of $('obBody').querySelectorAll('[data-act]')) b.onclick = () => finish(b.dataset.act === 'register');
  }
  function finish(openAccount) {
    save.onboarded = true; save.legal = '2026-11-25'; persist(); // the welcome screen shows the Terms and the Privacy Policy
    $('onboard').classList.add('hidden');
    if (openAccount && ctx.openAccount) { ctx.openAccount(); return; }
    if (ctx.done) ctx.done();
    if (ctx.start) ctx.start(); // one tap from first visit to the track
  }
  $('obNext').onclick = () => { ctx.click && ctx.click(); if (step < STEPS.length - 1) { step++; render(); } else finish(false); };
  $('obBack').onclick = () => { ctx.click && ctx.click(); if (step > 0) { step--; render(); } };
  return {
    start() { if (!save.settings.lang) { const d = detectLang(); save.settings.lang = d; setLang(d); } step = 0; render(); $('onboard').classList.remove('hidden'); },
  };
}

// Small language picker (top bar globe button).
export function openLanguagePicker(ctx) {
  const el = $('langModal');
  $('langList').innerHTML = LANGS.map(([c, n]) => `<button class="obcard${getLang() === c ? ' sel' : ''}" data-v="${c}"><img class="flag" src="${flagUrl(c)}" alt=""><b>${n}</b></button>`).join('');
  for (const b of $('langList').querySelectorAll('.obcard')) b.onclick = () => { setLang(b.dataset.v); ctx.save.settings.lang = b.dataset.v; ctx.persist(); el.classList.add('hidden'); if (ctx.onChange) ctx.onChange(); };
  $('langClose').onclick = () => el.classList.add('hidden');
  el.classList.remove('hidden');
}
