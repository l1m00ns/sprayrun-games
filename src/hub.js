// The hub: Fortnite-style top bar + pages (Shop, Career, Leaderboard, Events/Advent, Updates, Support, Account).
// Vanilla DOM like the rest of the engine UI. Everything it needs from the engine comes in through `ctx`.
import * as C from './consts.js';
import { OUTFITS, BOARDS, TRAILS, SKINS, BAGS, AURAS } from './cosmetics.js';
import { boardSVG } from './icons.js';
import { fillIcons } from './iconsax.js';
import { trackEvent } from './analytics.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`; };
const dur = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60, x = s % 60; return d ? `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };

// ------------------------------------------------------------------------------------------ art
const art = {
  runner(def, size = 120) {
    const top = def.top, acc = def.accent;
    const puff = def.jacket === 'puffer';
    const varsity = def.jacket === 'varsity';
    const hat = {
      cap: `<path d="M36 40a24 22 0 0 1 48 0z" fill="${def.hatColor}"/><path d="M62 38h30a6 5 0 0 1 0 9H62z" fill="${def.hatColor}" opacity=".9"/>`,
      bucket: `<path d="M36 40a24 20 0 0 1 48 0z" fill="${def.hatColor}"/><ellipse cx="60" cy="40" rx="34" ry="7" fill="${def.hatColor}"/><rect x="38" y="33" width="44" height="6" rx="3" fill="${acc}"/><circle cx="76" cy="36" r="2" fill="#ffd23f"/>`,
      beanie: `<path d="M36 42a24 24 0 0 1 48 0z" fill="${def.hatColor}"/><circle cx="60" cy="16" r="6" fill="${acc}"/>`,
      santa: `<path d="M36 42a24 24 0 0 1 48 0z" fill="#d6212e"/><rect x="34" y="38" width="52" height="9" rx="4" fill="#fff"/><circle cx="86" cy="26" r="6" fill="#fff"/>`,
      elf: `<path d="M38 42Q60 -6 90 8Q70 28 84 42z" fill="${def.hatColor}"/><circle cx="90" cy="8" r="5" fill="#ffd23f"/>`,
      crown: `<path d="M38 42l4-18 10 10 8-16 8 16 10-10 4 18z" fill="#cfeaff" stroke="#fff" stroke-width="2"/>`,
      tophat: `<rect x="40" y="6" width="40" height="32" fill="${def.hatColor}"/><rect x="32" y="36" width="56" height="7" rx="3" fill="${def.hatColor}"/>`,
      cat: `<path d="M38 40l2-22 14 12zM82 40l-2-22-14 12z" fill="${def.hatColor}"/>`, bunny: `<rect x="42" y="-4" width="10" height="38" rx="5" fill="${def.hatColor}"/><rect x="68" y="-4" width="10" height="38" rx="5" fill="${def.hatColor}"/>`,
      mohawk: `<path d="M52 38l4-24 4 20 4-24 4 28z" fill="${def.hatColor}"/>`, phones: `<path d="M36 50a24 26 0 0 1 48 0" fill="none" stroke="${def.hatColor}" stroke-width="7"/><rect x="31" y="48" width="9" height="16" rx="4" fill="${def.hatColor}"/><rect x="80" y="48" width="9" height="16" rx="4" fill="${def.hatColor}"/>`,
      sunhat: `<ellipse cx="60" cy="40" rx="40" ry="8" fill="${def.hatColor}"/><path d="M42 40a18 20 0 0 1 36 0z" fill="${def.hatColor}"/>`, goggles: `<rect x="40" y="38" width="40" height="14" rx="7" fill="${def.hatColor}"/>`,
      bandana: `<path d="M36 40a24 22 0 0 1 48 0z" fill="${def.hatColor}"/>`, visor: `<path d="M36 40a24 22 0 0 1 48 0z" fill="${def.hatColor}"/><rect x="40" y="38" width="48" height="6" rx="3" fill="${acc}"/>`, band: `<rect x="36" y="34" width="48" height="8" rx="4" fill="${def.hatColor}"/>`,
    }[def.hat] || '';
    const body = puff
      ? `<rect x="26" y="70" width="68" height="62" rx="22" fill="${top}"/>${[84, 98, 112].map((y) => `<path d="M28 ${y}Q60 ${y + 7} 92 ${y}" stroke="rgba(0,0,0,.28)" stroke-width="3" fill="none"/>`).join('')}<rect x="52" y="70" width="16" height="62" fill="${acc}" opacity=".55"/><rect x="20" y="78" width="18" height="38" rx="9" fill="${top}"/><rect x="82" y="78" width="18" height="38" rx="9" fill="${top}"/>`
      : varsity
        ? `<rect x="30" y="72" width="60" height="58" rx="18" fill="${top}"/><rect x="22" y="76" width="16" height="38" rx="8" fill="${def.sleeve || '#f1e6d2'}"/><rect x="82" y="76" width="16" height="38" rx="8" fill="${def.sleeve || '#f1e6d2'}"/><rect x="41" y="76" width="38" height="7" rx="3" fill="${acc}"/><rect x="57" y="72" width="6" height="58" fill="${def.sleeve || '#f1e6d2'}"/><rect x="34" y="116" width="52" height="7" rx="3" fill="${acc}"/><rect x="38" y="84" width="10" height="10" rx="2" fill="${def.sleeve || '#f1e6d2'}"/><circle cx="43" cy="89" r="2" fill="${acc}"/>`
        : `<rect x="30" y="72" width="60" height="58" rx="18" fill="${top}"/><rect x="24" y="78" width="14" height="34" rx="7" fill="${top}"/><rect x="82" y="78" width="14" height="34" rx="7" fill="${top}"/><rect x="40" y="78" width="40" height="8" rx="4" fill="${acc}"/>`;
    return `<svg viewBox="0 -8 120 150" width="${size}" height="${size * 1.2}" aria-hidden="true">${body}<circle cx="60" cy="52" r="24" fill="${def.skin}"/>${hat}<circle cx="51" cy="54" r="2.6" fill="#1a1a1a"/><circle cx="69" cy="54" r="2.6" fill="#1a1a1a"/><path d="M52 63q8 6 16 0" stroke="#7a3b22" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
  },
  board(c) { return boardSVG(c); },
  bag(c) { return `<svg viewBox="0 0 140 90" aria-hidden="true"><ellipse cx="70" cy="80" rx="34" ry="6" fill="rgba(0,0,0,.3)"/><rect x="44" y="14" width="52" height="62" rx="16" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="2"/><rect x="54" y="44" width="32" height="22" rx="7" fill="rgba(0,0,0,.22)"/><path d="M54 20q16 8 32 0" stroke="rgba(255,255,255,.6)" stroke-width="3" fill="none"/></svg>`; },
  aura(c) { return `<svg viewBox="0 0 140 90" aria-hidden="true"><ellipse cx="70" cy="60" rx="46" ry="14" fill="none" stroke="${c}" stroke-width="5" opacity=".9"/><ellipse cx="70" cy="60" rx="30" ry="9" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>${[28, 46, 70, 92, 110].map((x, i) => `<circle cx="${x}" cy="${44 - (i % 3) * 12}" r="${3 - (i % 2)}" fill="${c}"/>`).join('')}</svg>`; },
  trail(hex) {
    const col = '#' + hex.toString(16).padStart(6, '0');
    return `<svg viewBox="0 0 140 90" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<circle cx="${14 + i * 7.4}" cy="${46 + Math.sin(i * 1.7) * 18}" r="${2 + (i % 4)}" fill="${col}" opacity="${0.35 + i / 24}"/>`).join('')}</svg>`;
  },
  icon(label, color) { return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="34" fill="${color}" stroke="#fff" stroke-width="4"/><text x="50" y="62" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="34" fill="#fff">${label}</text></svg>`; },
  gift() { return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="18" y="42" width="64" height="44" rx="6" fill="#e0344a"/><rect x="12" y="32" width="76" height="16" rx="5" fill="#ff5a6a"/><rect x="45" y="32" width="10" height="54" fill="#ffd23f"/><path d="M50 32Q30 6 24 22Q22 34 50 32ZM50 32Q70 6 76 22Q78 34 50 32Z" fill="#ffd23f"/></svg>`; },
};

export function initHub(ctx) {
  const { api, save, persist, audio, dialog, notify, CHARACTERS, BIOMES } = ctx;
  const body = $('hubBody'), page = $('hubpage'), bar = $('topbar');
  fillIcons(bar); // Iconsax line icons in the top bar
  // On a portrait phone the tabs become a bottom navigation bar. A fixed element inside the (transformed) top bar would be anchored to it,
  // so the nav is moved out of the bar into #ui on small screens and back on large ones.
  { const nav = $('tbTabs'), mq = window.matchMedia('(max-width: 760px) and (min-height: 521px)');
    const place = () => { if (mq.matches) { if (nav.parentElement !== $('ui')) { nav.classList.add('bottom'); $('ui').appendChild(nav); } } else if (nav.parentElement !== bar) { nav.classList.remove('bottom'); bar.insertBefore(nav, bar.querySelector('.tb-right')); } };
    place(); mq.addEventListener('change', place); }
  let tab = 'play', timers = [], seq = 0;
  const clearTimers = () => { timers.forEach(clearInterval); timers = []; };
  const click = () => { try { audio.initAudio(); audio.sfx.click(); } catch (e) { /* audio not ready */ } };
  const toastBar = (msg) => { const t = document.createElement('div'); t.className = 'toastbar'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); };
  const serverNow = () => api.serverNow();
  const isOnline = () => !!(api.online.player && api.online.inv);
  const premBadge = (on, small = false) => (on ? `<span class="prem-badge${small ? ' sm' : ''}" title="Premium account">PREMIUM</span>` : '');
  const defOf = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

  // ---------------------------------------------------------------------------- top bar
  function refreshChrome() {
    const p = api.online.player;
    $('mCoins').textContent = fmt(save.coins);
    $('tbLv').textContent = p ? `LV ${p.level}` : 'LV 1';
    $('tbXp').style.width = p ? `${Math.min(100, (p.xpInto / Math.max(1, p.xpNeed)) * 100)}%` : '0%';
    $('tbName').innerHTML = p ? `${esc(p.name)}${premBadge(p.premium, true)}` : 'Sign in';
    $('tbAvatar').textContent = p ? (p.name[0] || '?').toUpperCase() : '?';
    $('tbAcct').title = p ? (p.hasAccount ? `Signed in as ${p.username}` : 'Guest - create an account to sync your progress') : 'Offline';
    const ev = api.online.events;
    const wf = ev && ev.winterfest, ltm = ev && ev.ltm;
    const seasonActive = !!(ev && ['easter', 'halloween', 'winterfest'].some((id) => ev[id] && ev[id].active));
    $('tbEvBadge').classList.toggle('on', seasonActive);
    $('tbEvBadge').textContent = seasonActive ? '!' : '';
    const d = $('btnNeon');
    if (d) d.classList.remove('off'); // the Neon Rush event is playable offline, even when the server is unreachable
    const seasonal = save.settings.seasonal !== false;
    document.documentElement.classList.toggle('winter', !!(wf && wf.active && seasonal));
    document.documentElement.classList.toggle('easter', !!(ev && ev.easter && ev.easter.active && seasonal));
    document.documentElement.classList.toggle('halloween', !!(ev && ev.halloween && ev.halloween.active && seasonal));
  }
  function setTab(t) {
    tab = t;
    for (const b of document.querySelectorAll('.tb-tab')) b.classList.toggle('sel', b.dataset.tab === t);
  }
  function setBarVisible(on) { bar.classList.toggle('hidden', !on); $('tbTabs').classList.toggle('navhidden', !on); if (!on) { page.classList.add('hidden'); clearTimers(); } }
  function open(t) {
    clearTimers();
    const my = ++seq;
    setTab(t);
    if (t === 'play') { page.classList.add('hidden'); ctx.onPlayTab(); return; }
    page.classList.remove('hidden');
    ctx.onHubOpen();
    if (t === 'shop' && Date.now() - (open.lastShop || 0) > 60000) { open.lastShop = Date.now(); trackEvent('shop_view'); }
    body.innerHTML = '<div class="empty">Loading…</div>';
    const fn = { shop: pageShop, career: pageCareer, leaderboard: pageBoard, events: pageEvents, updates: pageUpdates, support: pageSupport, account: pageAccount }[t];
    Promise.resolve(fn(my)).catch((e) => { if (my === seq) body.innerHTML = `<div class="empty">Something went wrong (${esc(e.message)}).<br><br><button class="btn sm" id="retry">TRY AGAIN</button></div>`; const r = $('retry'); if (r) r.onclick = () => open(t); });
  }
  const live = (my) => my === seq; // a page render is stale once the user switched tab

  for (const b of document.querySelectorAll('.tb-tab')) b.onclick = () => { click(); open(b.dataset.tab); };
  $('tbLogo').onclick = () => { click(); open('play'); };
  $('tbAcct').onclick = () => { click(); open('account'); };
  $('tbLevel').onclick = () => { click(); open('career'); };

  const head = (title, sub, extra = '') => `<div class="hp-head"><h1>${title}</h1><p>${sub || ''}</p><span class="sp"></span>${extra}</div>`;
  const needOnline = (what) => (api.online.vpn ? `<div class="empty">${what} is unavailable: a VPN, proxy or datacenter connection was detected.<br>Turn it off and reconnect. Offline play still works.<br><br><button class="btn sm" id="retry">RECONNECT</button></div>` : `<div class="empty">${what} needs the server.<br>The game is in offline mode right now - your local progress is safe.<br><br><button class="btn sm" id="retry">RECONNECT</button></div>`);
  const bindRetry = (t) => { const r = $('retry'); if (r) r.onclick = async () => { await ctx.reconnect(); open(t); }; };

  // ----------------------------------------------------------------------------------- SHOP
  const SHOP_TABS = [['featured', 'Featured'], ['runners', 'Runners'], ['outfits', 'Outfits'], ['boardskins', 'Boards'], ['trails', 'Trails'], ['bags', 'Backpacks'], ['auras', 'Auras'], ['styles', 'Styles'], ['skins', 'Skins'], ['boards', 'Hoverboards'], ['upgrades', 'Upgrades'], ['bundles', 'Bundles']];
  let shopTab = 'featured';
  const RARITY = { common: '', rare: 'r-rare', epic: 'r-epic', legendary: 'r-legendary' };
  const UP_ART = { magnet: ['M', '#e0344a'], jetpack: ['J', '#ff9f1c'], sneakers: ['S', '#2ec4b6'], mult: ['2x', '#e3a21a'] };

  function itemArt(it) {
    if (it.kind === 'runner') { const id = it.id.split(':')[1]; return art.runner({ ...defOf(id) }); }
    if (it.kind === 'cosmetic') {
      const id = it.id.split(':')[1];
      if (it.slot === 'outfit') return art.runner({ ...defOf(save.character), ...OUTFITS[id] });
      if (it.slot === 'board') return art.board(BOARDS[id]);
      if (it.slot === 'bag') return art.bag(BAGS[id]);
      if (it.slot === 'aura') return art.aura('#' + AURAS[id].color.toString(16).padStart(6, '0'));
      if (it.slot === 'style') return art.icon(String(itemName(it)).slice(0, 2).toUpperCase(), '#29a8e6');
      if (it.slot === 'skin') return art.runner({ ...defOf(save.character), ...SKINS[id] });
      return art.trail(TRAILS[id].color);
    }
    if (it.kind === 'upgrade') { const k = it.id.split(':')[1]; return art.icon(UP_ART[k][0], UP_ART[k][1]); }
    if (it.kind === 'bundle') return art.gift();
    return art.board(BOARDS.default);
  }
  function itemName(it) {
    if (it.kind === 'runner') return defOf(it.id.split(':')[1]).name;
    if (it.kind === 'upgrade') return C.POWERUPS[it.id.split(':')[1]].name;
    if (it.id === 'board:5') return 'Hoverboard x5';
    return it.name.charAt(0).toUpperCase() + it.name.slice(1);
  }
  function itemDesc(it) {
    if (it.kind === 'runner') return defOf(it.id.split(':')[1]).tag;
    if (it.kind === 'upgrade') { const k = it.id.split(':')[1], P = C.POWERUPS[k]; return `Lasts ${(P.base + P.perLevel * it.level).toFixed(1)} s now, +${P.perLevel} s per level.`; }
    return it.desc || '';
  }
  const equippedOf = (it, inv) => it.kind === 'runner' ? inv.equip.char === it.id.split(':')[1] : it.kind === 'cosmetic' ? inv.equip[it.slot] === it.id.split(':')[1] : false;
  const visibleIn = (it, t) => t === 'featured' ? (it.limited && it.can) || it.kind === 'bundle' && it.can || (it.kind === 'cosmetic' && it.rarity === 'epic' && it.can) : (t === 'runners' ? it.cat === 'runners' : it.cat === t);

  async function pageShop(my) {
    if (!isOnline()) { body.innerHTML = head('SHOP', '') + needOnline('The shop'); bindRetry('shop'); return; }
    const data = await api.shop();
    if (!live(my)) return;
    if (!data) { body.innerHTML = head('SHOP', '') + needOnline('The shop'); bindRetry('shop'); return; }
    ctx.syncEconomy();
    refreshChrome();
    const inv = data.inv, wf = data.events && data.events.winterfest;
    // Current loadout strip: what the runner is wearing right now, so the shop always shows the equipped set.
    const eqChip = (slot, label, it) => `<div class="eqchip"><span class="eqart">${it ? itemArt(it) : ''}</span><span><small>${esc(label)}</small><b>${esc(it ? itemName(it) : '-')}</b></span></div>`;
    const runnerDef = defOf(save.character);
    const eqChips = [eqChip('char', 'Runner', { kind: 'runner', id: `runner:${save.character}`, cat: 'runners', name: runnerDef.name, desc: runnerDef.tag, rarity: 'common', price: 0 })];
    for (const [slot, label] of [['outfit', 'Outfit'], ['board', 'Board'], ['bag', 'Backpack'], ['aura', 'Aura'], ['style', 'Style'], ['skin', 'Skin']]) {
      const id = inv.equip && inv.equip[slot];
      if (!id) continue;
      const it = data.items.find((x) => x.slot === slot && x.id.split(':')[1] === id);
      if (it) eqChips.push(eqChip(slot, label, it));
    }
    const loadout = `<div class="loadout" aria-label="Equipped items">${eqChips.join('')}</div>`;
    let items = data.items.filter((it) => visibleIn(it, shopTab));
    if (shopTab === 'runners') items.sort((a, b) => a.price - b.price);
    const cards = items.map((it) => {
      const eq = equippedOf(it, inv);
      const owned = it.owned && it.kind !== 'consumable' && it.kind !== 'upgrade';
      let action;
      if (eq) action = '<button class="btn sm green" disabled>EQUIPPED</button>';
      else if (owned && (it.kind === 'runner' || it.kind === 'cosmetic')) action = '<button class="btn sm" data-act="equip">EQUIP</button>';
      else if (it.kind === 'upgrade' && !it.can) action = '<button class="btn sm" disabled>MAX</button>';
      else if (!it.can) action = `<button class="btn sm" disabled>${esc(it.lockedReason || (owned ? 'OWNED' : 'MAX'))}</button>`;
      else action = `<button class="btn sm ${save.coins >= it.price ? 'go' : ''}" data-act="buy" ${save.coins < it.price ? 'data-poor="1"' : ''}>${fmt(it.price)} <span class="coin-i sm"></span></button>`;
      const pips = it.kind === 'upgrade' ? `<div class="pips2">${Array.from({ length: 5 }, (_, i) => `<i class="${i < it.level ? 'on' : ''}"></i>`).join('')}</div>` : '';
      const extra = it.kind === 'consumable' && it.id === 'board' ? `<p>${esc(it.desc)} You own <b>${it.owned}</b>.</p>` : `<p>${esc(itemDesc(it))}</p>`;
      return `<div class="c2 ${RARITY[it.rarity] || ''} ${eq ? 'equipped' : ''} ${owned ? 'owned' : ''}" data-id="${esc(it.id)}">${it.rarity && it.rarity !== 'common' ? `<span class="rar">${it.rarity.toUpperCase()}</span>` : ''}${it.limited ? '<span class="lim">LIMITED</span>' : ''}<div class="art">${itemArt(it)}</div><h4>${esc(itemName(it))}</h4>${extra}${pips}${action}</div>`;
    }).join('');
    const banner = shopTab === 'featured' && wf && wf.active ? `<div class="banner xmas"><div><h2>Winter Fest is on!</h2><p>Limited holiday cosmetics are in the shop until <b>${new Date(wf.endsAt - 1).toUTCString().slice(5, 16)}</b>. Open a door of the advent calendar every day.</p></div><button class="btn go" data-goto="events">OPEN CALENDAR</button></div>` : '';
    body.innerHTML = head('SHOP', 'Prices are set by the server. Everything you buy follows your account.', `<div class="pill"><span class="coin-i"></span><span>${fmt(save.coins)}</span></div>`)
      + loadout + `<div class="subtabs">${SHOP_TABS.map(([id, n]) => `<button class="subtab ${id === shopTab ? 'sel' : ''}" data-st="${id}">${n}</button>`).join('')}</div>${banner}`
      + (cards ? `<div class="sgrid">${cards}</div>` : '<div class="empty">Nothing here right now.</div>');
    for (const b of body.querySelectorAll('.subtab')) b.onclick = () => { click(); shopTab = b.dataset.st; open('shop'); };
    for (const b of body.querySelectorAll('[data-goto]')) b.onclick = () => { click(); open(b.dataset.goto); };
    for (const b of body.querySelectorAll('.c2 [data-act]')) b.onclick = async () => {
      const id = b.closest('.c2').dataset.id, it = data.items.find((x) => x.id === id);
      if (b.dataset.act === 'buy') {
        if (b.dataset.poor) { audio.sfx.deny(); toastBar(`Not enough coins - you need ${fmt(it.price - save.coins)} more`); return; }
        if (it.price >= 5000 && !(await ctx.confirm(`Buy ${itemName(it)} for ${fmt(it.price)} coins?`, { yes: 'BUY', no: 'CANCEL' }))) return;
        b.disabled = true;
        const r = await api.buy(id);
        if (r && r.json && r.json.ok) { audio.sfx.buy(); trackEvent('purchase', { meta: { item: id, price: it.price, kind: it.kind, slot: it.slot || null } }); ctx.syncEconomy(); toastBar(`${itemName(it)} unlocked!`); if (it.kind === 'cosmetic') await api.equip(it.slot, id.split(':')[1]); ctx.syncEconomy(); }
        else { audio.sfx.deny(); toastBar(({ not_enough_coins: 'Not enough coins', max_reached: 'Already at the maximum', already_owned: 'You already own this', not_available: 'Not available right now' })[r && r.json && r.json.error] || 'Purchase failed'); }
        ctx.refresh(); open('shop');
      } else {
        const [slot, val] = it.kind === 'runner' ? ['char', id.split(':')[1]] : [it.slot, id.split(':')[1]];
        const r = await api.equip(slot, val);
        if (r && r.json && r.json.ok) { audio.sfx.buy(); ctx.syncEconomy(); ctx.refresh(); toastBar('Equipped'); } else audio.sfx.deny();
        open('shop');
      }
    };
  }

  // --------------------------------------------------------------------------------- CAREER
  const MODE_NAMES = { classic: 'Classic', nocoin: 'No Coin' };
  let careerTab = 'overview';
  const careerSubtabs = () => `<div class="subtabs">${[['overview', 'Overview'], ['stats', 'Stats']].map(([id, n]) => `<button class="subtab ${careerTab === id ? 'sel' : ''}" data-ct="${id}">${n}</button>`).join('')}</div>`;
  const bindCareerSub = () => { for (const b of body.querySelectorAll('[data-ct]')) b.onclick = () => { click(); careerTab = b.dataset.ct; open('career'); }; };
  async function pageCareer(my) {
    if (!isOnline()) { body.innerHTML = head('CAREER', '') + needOnline('Your career'); bindRetry('career'); return; }
    const d = await api.career();
    if (!live(my)) return;
    if (!d) { body.innerHTML = head('CAREER', '') + needOnline('Your career'); bindRetry('career'); return; }
    const p = d.player, c = d.career, lv = d.level;
    const best = (n) => (n ? fmt(n) : '-');
    const rankedRows = d.matches.map((m) => { const dl = m.after - m.before; return `<div class="rowx"><span class="pos num">#${m.place}</span><b>${esc((BIOMES[m.map] || { name: m.map }).name)}</b><span class="dim">${m.players} players</span><span class="sp"></span><span class="num">${fmt(m.score)}</span><span class="${dl >= 0 ? 'up' : 'down'}">${dl >= 0 ? '+' : ''}${dl}</span></div>`; }).join('');
    const runs = d.recentRuns.map((r) => `<div class="rowx"><b>${MODE_NAMES[r.mode] || r.mode}</b><span class="dim">${esc((BIOMES[r.map] || { name: r.map || '' }).name)}</span><span class="sp"></span><span class="num">${fmt(r.score)}</span><span class="dim">${fmt(r.dist)} m</span>${r.flagged ? '<span class="tag2" style="background:#e0344a">REJECTED</span>' : r.revived ? '<span class="tag2">REVIVED</span>' : ''}</div>`).join('');
    const ach = d.achievements.map((a) => `<div class="ach ${a.done ? 'done' : ''}"><span class="ic">${a.done ? '✓' : '★'}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div><span class="rw">+${a.reward}</span></div>`).join('');
    if (careerTab === 'stats') return pageStats(my, d);
    body.innerHTML = careerSubtabs() + head('CAREER', `${esc(p.name)} - ${esc(d.title)}`, `<button class="btn sm" id="goAcct">${p.hasAccount ? 'ACCOUNT' : 'CREATE ACCOUNT'}</button>`)
      + `<div class="banner"><div style="min-width:240px"><h2>Level ${lv.level}</h2><p>${fmt(lv.into)} / ${fmt(lv.need)} XP to level ${lv.level + 1}</p><div class="xpbar" style="margin-top:8px;width:min(360px,70vw)"><i style="width:${Math.min(100, (lv.into / lv.need) * 100)}%"></i></div></div><div><h2 style="color:var(--yellow)">${p.tier}</h2><p>${fmt(p.rating)} rating${p.rank ? ` - ranked #${p.rank}` : ''}</p></div><div class="cd"><small>RECORD</small><b>${best(c.bestScore)}</b></div></div>`
      + `<div class="stats4"><div class="stat4"><small>Runs</small><b>${fmt(c.runs)}</b></div><div class="stat4"><small>Distance</small><b>${fmt(c.dist)} m</b></div><div class="stat4"><small>Coins earned</small><b>${fmt(c.coins)}</b></div><div class="stat4"><small>Time played</small><b>${Math.floor(c.time / 3600)}h ${Math.floor(c.time / 60) % 60}m</b></div><div class="stat4"><small>Ranked wins</small><b>${c.rankedWins}/${c.rankedGames}</b></div><div class="stat4"><small>Duel wins</small><b>${c.duelWins}</b></div><div class="stat4"><small>Best No Coin</small><b>${best(c.bestNoCoin)}</b></div><div class="stat4"><small>Best distance</small><b>${best(c.bestDist)} m</b></div></div>`
      + badgesHtml(d) + rankedProgress(d)
      + `<div class="cols2"><div><h3 class="ink" style="margin:0 0 6px;color:var(--yellow)">Recent runs</h3>${runs || '<div class="empty">No runs yet.</div>'}<h3 class="ink" style="margin:18px 0 6px;color:var(--yellow)">Ranked history</h3>${rankedRows || '<div class="empty">No ranked matches yet.</div>'}</div><div><h3 class="ink" style="margin:0 0 6px;color:var(--yellow)">Achievements ${c.ach.length}/${d.achievements.length}</h3>${ach}</div></div>`;
    $('goAcct').onclick = () => { click(); open('account'); };
    bindCareerSub();
  }
  const badgesHtml = (d) => (d.badges && d.badges.length ? `<div class="hp-head" style="margin:0 0 12px"><h3 class="ink" style="margin:0;color:var(--yellow)">BADGES</h3>${d.badges.map((b) => `<span class="badge2" title="${esc(b.desc || '')}"><i>★</i>${esc(b.name)}</span>`).join('')}</div>` : '');
  const rankedProgress = (d) => { const r = d.ranked || (d.player && d.player.ranked); if (!r) return ''; const min = Math.round(r.minSeconds / 60), have = Math.min(min, Math.floor((r.played || 0) / 60)); return r.played >= r.minSeconds ? '<div class="stage-note">Ranked unlocked</div>' : `<div class="chartbox" style="margin-bottom:14px"><h4>Ranked</h4><div>Ranked unlocks after ${min} min of play - ${have}/${min} min</div><div class="progress"><i style="width:${Math.min(100, (have / Math.max(1, min)) * 100)}%"></i></div></div>`; };

  // ---- statistics (SVG charts, no library)
  const W = 520, Hh = 130;
  function barChart(vals, labels, { color = '#29d6ff', unit = '' } = {}) {
    const max = Math.max(1, ...vals), bw = (W - 20) / vals.length;
    const bars = vals.map((v, i) => { const h = (v / max) * (Hh - 28); return `<rect x="${10 + i * bw + 1}" y="${Hh - 18 - h}" width="${Math.max(2, bw - 3)}" height="${Math.max(0, h)}" rx="3" fill="${color}" opacity="${v ? 0.95 : 0.18}"><title>${esc(labels[i])}: ${fmt(v)}${unit}</title></rect>`; }).join('');
    const ticks = [0, Math.floor(vals.length / 2), vals.length - 1].map((i) => `<text x="${10 + i * bw}" y="${Hh - 4}">${esc(labels[i])}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img">${bars}<line x1="10" x2="${W - 10}" y1="${Hh - 18}" y2="${Hh - 18}" stroke="rgba(255,255,255,.25)"/>${ticks}<text x="${W - 10}" y="10" text-anchor="end">max ${fmt(max)}${unit}</text></svg>`;
  }
  function lineChart(pts, { color = '#ffd23f' } = {}) {
    if (pts.length < 2) return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img"><line x1="12" x2="${W - 12}" y1="${Hh - 22}" y2="${Hh - 22}" stroke="rgba(255,255,255,.25)"/><text x="${W / 2}" y="${Hh / 2}" text-anchor="middle">Not enough data yet</text></svg>`;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), dy = Math.max(1, y1 - y0);
    const X = (x) => 12 + ((x - x0) / Math.max(1, x1 - x0)) * (W - 24), Y = (y) => Hh - 22 - ((y - y0) / dy) * (Hh - 40);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
    return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img"><path d="${d} L${X(x1)},${Hh - 22} L${X(x0)},${Hh - 22} Z" fill="${color}" opacity=".13"/><path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>${pts.map((p) => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.2" fill="${color}"><title>${fmt(p.y)}</title></circle>`).join('')}<text x="12" y="${Hh - 6}">${fmt(y0)}</text><text x="${W - 12}" y="12" text-anchor="end">${fmt(y1)}</text></svg>`;
  }
  async function pageStats(my, career) {
    const st = await api.stats();
    if (!live(my)) return;
    if (!st) { body.innerHTML = careerSubtabs() + head('CAREER', '') + needOnline('Statistics'); bindRetry('career'); bindCareerSub(); return; }
    const T = st.totals, mapNames = Object.keys(st.byMap);
    const mapRows = mapNames.map((m) => { const x = st.byMap[m]; return `<div class="rowx"><b>${esc((BIOMES[m] || { name: m }).name)}</b><span class="dim">${x.runs} runs</span><span class="sp"></span><span class="dim">avg ${fmt(x.avg)}</span><span class="num">${fmt(x.best)}</span></div>`; }).join('');
    const modeRows = Object.keys(st.byMode).map((m) => { const x = st.byMode[m]; return `<div class="rowx"><b>${esc(MODE_NAMES[m] || m)}</b><span class="dim">${x.runs} runs - ${x.minutes} min</span><span class="sp"></span><span class="dim">avg ${fmt(x.avg)}</span><span class="num">${fmt(x.best)}</span></div>`; }).join('');
    body.innerHTML = careerSubtabs() + head('STATS', 'Your last 30 days, in numbers.')
      + `<div class="stats4"><div class="stat4"><small>Total play time</small><b>${Math.floor(T.minutes / 60)}h ${T.minutes % 60}m</b></div><div class="stat4"><small>Average score</small><b>${fmt(T.avgScore)}</b></div><div class="stat4"><small>Average distance</small><b>${fmt(T.avgDist)} m</b></div><div class="stat4"><small>Average run</small><b>${Math.floor(T.avgRunSec / 60)}:${String(T.avgRunSec % 60).padStart(2, '0')}</b></div><div class="stat4"><small>Active-day streak</small><b>${st.streak}</b></div><div class="stat4"><small>Ranked record</small><b>${st.ranked.wins}/${st.ranked.games}</b></div><div class="stat4"><small>Duels W / L / D</small><b>${st.duel.wins}/${st.duel.losses}/${st.duel.draws}</b></div><div class="stat4"><small>Duel kills</small><b>${st.duel.kills}</b></div></div>`
      + `<div class="cols2"><div class="chartbox"><h4>Minutes played per day</h4>${barChart(st.days.map((d) => d.minutes), st.days.map((d) => d.d.slice(5)), { color: '#29d6ff', unit: ' min' })}</div><div class="chartbox"><h4>Best score per day</h4>${lineChart(st.days.map((d, i) => ({ x: i, y: d.best })).filter((p) => p.y > 0))}</div></div>`
      + `<div class="cols2" style="margin-top:14px"><div class="chartbox"><h4>Ranked rating</h4>${lineChart(st.rating.map((r, i) => ({ x: i, y: r.r })), { color: '#42e07a' })}</div><div class="chartbox"><h4>When you play (hour, UTC)</h4>${barChart(st.hours, st.hours.map((_, i) => `${i}h`), { color: '#ff3d7f', unit: ' runs' })}</div></div>`
      + `<div class="cols2" style="margin-top:14px"><div><h3 class="ink" style="margin:0 0 6px;color:var(--yellow)">By map</h3>${mapRows || '<div class="empty">No runs yet.</div>'}</div><div><h3 class="ink" style="margin:0 0 6px;color:var(--yellow)">By mode</h3>${modeRows || '<div class="empty">No runs yet.</div>'}</div></div>`;
    bindCareerSub();
  }


  // ----------------------------------------------------------------------------- LEADERBOARD
  const BOARDS_L = [['classic', 'Classic'], ['nocoin', 'No Coin'], ['daily', 'Daily'], ['guest', 'No account'], ['ranked', 'Ranked']];
  const PERIODS = [['all', 'All time'], ['week', 'This week'], ['day', 'Today']];
  const sel = { board: 'ranked', period: 'all' };
  async function pageBoard(my) {
    const d = await api.leaderboard(sel.board, sel.period);
    if (!live(my)) return;
    const you = api.online.player ? api.online.player.name : '';
    const rows = d ? d.rows.map((r) => `<div class="rowx click ${r.name === you ? 'me' : ''}" data-name="${esc(r.name)}"><b class="pos">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : '#' + r.rank}</b><b>${esc(r.name)}${premBadge(r.premium)}${r.tag ? `<span class="ptag">#${esc(r.tag)}</span>` : ''}</b>${r.tier ? `<span class="tag2">${r.tier}</span>` : ''}<span class="sp"></span><span class="num">${fmt(r.score)}</span>${r.dist != null ? `<span class="dim">${fmt(r.dist)} m</span>` : `<span class="dim">${r.wins}W / ${r.games}</span>`}</div>`).join('') : '';
    const yours = d && d.you ? `<div class="banner" style="padding:12px 18px"><div><h2 style="font-size:24px">Your best</h2><p>${fmt(d.you.score)}${d.you.rank ? ` - rank #${d.you.rank}` : ''}</p></div></div>` : '';
    body.innerHTML = head('LEADERBOARD', 'Click a player to see their profile.')
      + `<div class="subtabs">${BOARDS_L.map(([id, n]) => `<button class="subtab ${sel.board === id ? 'sel' : ''}" data-k="board" data-v="${id}">${n}</button>`).join('')}</div>`
      + (sel.board === 'classic' || sel.board === 'nocoin' ? `<div class="subtabs">${PERIODS.map(([id, n]) => `<button class="subtab ${sel.period === id ? 'sel' : ''}" data-k="period" data-v="${id}">${n}</button>`).join('')}</div>` : '')
      + (d ? yours + (rows || '<div class="empty">No scores yet - be the first!</div>') : needOnline('Leaderboards'));
    bindRetry('leaderboard');
    for (const b of body.querySelectorAll('.subtab')) b.onclick = () => { click(); sel[b.dataset.k] = b.dataset.v; open('leaderboard'); };
    for (const r of body.querySelectorAll('.rowx.click')) r.onclick = async () => {
      click();
      const pr = await api.profileByName(r.dataset.name);
      if (!pr) return;
      notify(`${pr.premium ? 'PREMIUM · ' : ''}${pr.name.toUpperCase()}`, `${pr.title} - level ${pr.level}\n${pr.tier} ${fmt(pr.rating)} (${pr.wins} wins / ${pr.games} ranked games)\n${(pr.badges || []).length ? 'Badges: ' + pr.badges.map((b) => b.name).join(', ') + '\n' : ''}Best score ${fmt(pr.stats.bestScore)} - ${fmt(pr.stats.runs)} runs - ${fmt(pr.stats.dist)} m\n${pr.stats.achievements} achievements - ${pr.stats.duelWins} duel wins`);
    };
  }

  // -------------------------------------------------------------------------- EVENTS + ADVENT
  const COS_NAMES = { au_dawn: 'Dawn Light', bg_cup: 'Cup Champion', au_royal: 'Royal Glow', sk_crown: 'Champion Gold' };
  const cosName = (id) => COS_NAMES[id] || id;
  async function pageEvents(my) {
    const [ev, adv, tour] = await Promise.all([api.events(), isOnline() ? api.advent() : null, api.tournaments()]);
    if (!live(my)) return;
    if (!ev) { body.innerHTML = head('EVENTS', '') + needOnline('Events'); bindRetry('events'); return; }
    if (tour && tour.rewards && tour.rewards.length) for (const r of tour.rewards) ctx.notify(`${r.name}: #${r.rank}`, `You finished #${r.rank} with ${fmt(r.score)} points.${r.coins ? ` +${fmt(r.coins)} coins.` : ''}${r.items.length ? ' Exclusive cosmetics were added to your inventory.' : ''}`);
    refreshChrome();
    const wf = ev.winterfest, ltm = ev.ltm;
    const cdTarget = wf.active ? wf.endsAt : wf.startsAt;
    const giftBtn = (e) => (e.active ? (e.claimed ? '<span class="tag2" style="background:#1fa85a;vertical-align:middle">GIFT CLAIMED</span>' : `<button class="btn go" data-gift="${esc(e.id)}">CLAIM GIFT</button>`) : '');
    const bannerWinter = `<div class="banner xmas"><div><h2>${esc(wf.name)}</h2><p>${esc(wf.blurb)}</p>${wf.gift ? `<p class="small">Free gift: <b>${esc(wf.gift.label)}</b></p>` : ''}</div><div class="cd"><small>${wf.active ? 'ENDS IN' : 'STARTS IN'}</small><b data-cd="${cdTarget}">--</b></div>${giftBtn(wf)}</div>`;
    const seasonal = ['easter', 'halloween'].map((id) => ev[id]).filter(Boolean);
    const bannerSeasonal = seasonal.map((e) => `<div class="banner season ${esc(e.id)}"><div><h2>${esc(e.name)} <span class="tag2" style="background:${e.active ? '#1fa85a' : '#555'};vertical-align:middle">${e.active ? 'LIVE' : 'UPCOMING'}</span></h2><p>${esc(e.blurb)}</p>${e.gift ? `<p class="small">Free gift: <b>${esc(e.gift.label)}</b></p>` : ''}</div><div class="cd"><small>${e.active ? 'ENDS IN' : 'STARTS IN'}</small><b data-cd="${e.active ? e.endsAt : e.startsAt}">--</b></div>${giftBtn(e)}</div>`).join('');
    const bannerLtm = `<div class="banner neon"><div><h2>${esc(ltm.name)} <span class="tag2" style="background:#e0344a;vertical-align:middle">LIMITED TIME</span></h2><p>${esc(ltm.desc)}</p></div>${ltm.active ? `<div class="cd"><small>${ltm.endsAt ? 'ROTATES IN' : ''}</small><b ${ltm.endsAt ? `data-cd="${ltm.endsAt}"` : ''}>${ltm.endsAt ? '--' : 'LIVE'}</b></div><button class="btn neon" id="playNeon">PLAY NOW</button>` : '<div class="cd"><small>NEXT WINDOW</small><b>Fri 18:00 UTC</b></div>'}</div>`;
    let doors = '';
    if (adv && adv.active) {
      doors = `<div class="hp-head" style="margin-top:6px"><h1 style="font-size:34px">Advent calendar</h1><p>One door per day, opening at 00:00 UTC for everyone at once. Missed doors stay open until the event ends.</p><span class="sp"></span>${adv.nextDoorAt ? `<div class="pill"><span>Next door in <b data-cd="${adv.nextDoorAt}">--</b></span></div>` : ''}</div><div class="doors">${adv.doors.map((d) => `<div class="door ${d.state} ${d.day >= 24 ? 'big' : ''}" data-day="${d.day}" title="${esc(d.reward.label)}"><div><b>${d.day}</b><small>${d.state === 'locked' ? 'Opens Dec ' + d.day : esc(d.reward.label)}</small></div></div>`).join('')}</div>`;
    } else if (adv && !adv.active) doors = `<div class="empty">The advent calendar opens on <b>${new Date(adv.opensAt).toUTCString().slice(5, 16)}</b> at 00:00 UTC.</div>`;
    else doors = '<div class="empty">Sign in to the server to open advent doors.</div>';
    const prize = (r) => `${r.cos.length ? r.cos.map((c) => `<b>${esc(cosName(c))}</b>`).join(', ') : ''}${r.cos.length && r.coins ? ' + ' : ''}${r.coins ? `${fmt(r.coins)} coins` : ''}`;
    const tcards = (tour ? tour.tournaments.filter((t) => t.state !== 'ended').map((t) => {
      const top = t.rewards[0];
      return `<div class="banner tourn ${t.kind}"><div><h2>${esc(t.name)} <span class="tag2" style="background:${t.state === 'live' ? '#1fa85a' : '#555'};vertical-align:middle">${t.state === 'live' ? 'LIVE' : 'UPCOMING'}</span></h2><p>${esc(t.blurb)}</p><p class="small">Winner: ${prize(top)}</p>${t.mine ? `<p class="small">Your best: <b>${fmt(t.mine.score)}</b> (rank #${t.mine.rank})</p>` : ''}</div><div class="cd"><small>${t.state === 'live' ? 'ENDS IN' : 'STARTS IN'}</small><b data-cd="${t.state === 'live' ? t.end : t.start}">--</b>${t.state === 'live' ? `<button class="btn sm" data-tb="${esc(t.id)}">RANKING</button>` : ''}</div></div>`;
    }).join('') : '');
    body.innerHTML = head('EVENTS', 'Limited-time content, same clock for every player.') + bannerSeasonal + bannerWinter + bannerLtm + tcards + doors; // seasons first: tournaments used to hide them below the fold
    for (const b of body.querySelectorAll('[data-tb]')) b.onclick = async () => {
      click(); const d = await api.tournament(b.dataset.tb);
      if (!d) { toastBar('Could not load the ranking'); return; }
      ctx.notify(`${d.name} - ${d.entrants} runner${d.entrants === 1 ? '' : 's'}`, d.rows.length ? d.rows.slice(0, 12).map((r) => `#${r.rank} ${r.name} - ${fmt(r.score)}${r.me ? '  (you)' : ''}`).join('\n') : 'No scores yet: play a Classic run to enter.');
    };
    const tick = () => { for (const el of body.querySelectorAll('[data-cd]')) el.textContent = dur(Number(el.dataset.cd) - serverNow()); };
    tick(); timers.push(setInterval(tick, 1000));
    const pd = $('playNeon'); if (pd) pd.onclick = () => { click(); ctx.startNeon(); };
    for (const b of body.querySelectorAll('[data-gift]')) b.onclick = async () => {
      click(); b.disabled = true;
      const r = await api.claimEventGift(b.dataset.gift);
      b.disabled = false;
      if (r && r.json && r.json.ok) { audio.sfx.mission(); ctx.syncEconomy(); toastBar(`Gift: ${r.json.reward.label}`); open('events'); }
      else { audio.sfx.deny(); toastBar(({ already_claimed: 'Gift already claimed', event_not_active: 'This event is not live yet' })[r && r.json && r.json.error] || 'Could not claim the gift'); }
    };
    for (const d of body.querySelectorAll('.door.open')) d.onclick = async () => {
      const r = await api.claimAdvent(Number(d.dataset.day));
      if (r && r.json && r.json.ok) { audio.sfx.mission(); ctx.syncEconomy(); ctx.refresh(); toastBar(`Door ${d.dataset.day}: ${r.json.reward.label}`); if (r.json.achievements.length) toastBar(`Achievement: ${r.json.achievements[0].name}`); open('events'); }
      else { audio.sfx.deny(); toastBar(({ door_locked: 'Not yet - this door is still locked', already_claimed: 'Already opened' })[r && r.json && r.json.error] || 'Could not open the door'); }
    };
  }

  // ------------------------------------------------------------------------------------ UPDATES
  async function pageUpdates(my) {
    const list = await api.updates();
    if (!live(my)) return;
    if (!list) { body.innerHTML = head('UPDATES', '') + needOnline('The update history'); bindRetry('updates'); return; }
    save.seenUpdate = list[0] && list[0].version; persist(); $('tbUpBadge').classList.remove('on');
    body.innerHTML = head('UPDATES', 'What changed, newest first.') + list.map((u, i) => `<div class="upd"><h3>v${esc(u.version)} - ${esc(u.title)}${i === 0 ? '<span class="tag2" style="background:var(--pink)">NEW</span>' : ''}<small>${esc(u.date)}</small></h3><ul>${u.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`).join('');
  }
  async function checkUpdates() {
    const list = await api.updates();
    if (list && list[0] && save.seenUpdate !== list[0].version) { $('tbUpBadge').textContent = 'NEW'; $('tbUpBadge').classList.add('on'); }
  }

  // ------------------------------------------------------------------------------------ SUPPORT
  let openTicket = null;
  let supView = 'requests', appealView = null;
  const supSub = () => `<div class="subtabs">${[['requests', 'Requests'], ['appeals', 'Appeals']].map(([id, n]) => `<button class="subtab ${supView === id ? 'sel' : ''}" data-sv="${id}">${n}</button>`).join('')}</div>`;
  const bindSup = () => { for (const b of body.querySelectorAll('[data-sv]')) b.onclick = () => { click(); supView = b.dataset.sv; appealView = null; openTicket = null; open('support'); }; };
  async function pageSupport(my) {
    if (supView === 'appeals') return pageAppeals(my);
    return pageRequests(my);
  }
  async function pageRequests(my) {
    if (!isOnline()) { body.innerHTML = head('SUPPORT', '') + needOnline('Support'); bindRetry('support'); return; }
    const tickets = await api.supportTickets();
    if (!live(my)) return;
    if (!tickets) { body.innerHTML = head('SUPPORT', '') + needOnline('Support'); bindRetry('support'); return; }
    if (openTicket) return renderTicket(my, openTicket);
    const list = tickets.map((t) => `<div class="rowx click st-${t.status}" data-id="${t.id}"><span class="status-dot"></span><b>${esc(t.subject)}</b><span class="tag2">${esc(t.category.replace('_', ' '))}</span><span class="sp"></span><span class="dim">${t.status === 'escalated' ? 'with the team' : t.status}</span><span class="dim">${ago(t.updated)}</span></div>`).join('');
    const sanction = api.online.sanction || (api.online.player && (api.online.player.banned ? { error: 'banned', reason: api.online.player.banReason } : api.online.player.kickedUntil ? { error: 'kicked', until: api.online.player.kickedUntil } : null));
    body.innerHTML = head('SUPPORT', 'Questions, bugs, purchases or a fair-play appeal. Surf, the assistant, answers instantly and passes anything that needs a human to the team.', '<button class="btn go" id="newTicket">NEW REQUEST</button>')
      + (sanction ? `<div class="banner" style="border-color:#e0344a"><div><h2>${sanction.error === 'banned' ? 'Your account is suspended' : 'You were removed from online play'}</h2><p>${esc(sanction.reason || 'Fair-play violation')}${sanction.until ? ` Back at ${new Date(sanction.until).toLocaleTimeString()}.` : ''} If you think this is a mistake, open a request and choose "Fair-play appeal".</p></div></div>` : '')
      + (list || '<div class="empty">No requests yet. Ask Surf anything!</div>');
    body.insertAdjacentHTML('afterbegin', supSub()); bindSup();
    $('newTicket').onclick = () => { click(); newTicketForm(my); };
    for (const r of body.querySelectorAll('.rowx.click')) r.onclick = () => { click(); openTicket = Number(r.dataset.id); open('support'); };
  }
  function newTicketForm(my) {
    const cats = [['gameplay', 'Gameplay question'], ['bug', 'Bug report'], ['purchase', 'Purchase / balance'], ['account', 'Account'], ['fairplay_appeal', 'Fair-play appeal'], ['ranking', 'Ranking'], ['feedback', 'Feedback'], ['other', 'Other']];
    body.innerHTML = head('NEW REQUEST', '', '<button class="btn sm" id="back">BACK</button>')
      + `<div class="formbox" style="max-width:620px;margin-top:0"><label>Topic</label><select id="tkCat" style="width:100%">${cats.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select><label>Subject</label><input class="txt" id="tkSub" maxlength="80" placeholder="Short summary"><label>What happened?</label><textarea class="txt" id="tkMsg" rows="5" maxlength="1200" placeholder="Tell us in your own words (any language)."></textarea><div class="err" id="tkErr"></div><div class="row"><button class="btn go" id="tkSend">SEND</button></div></div>`;
    $('back').onclick = () => { click(); open('support'); };
    $('tkSend').onclick = async () => {
      const message = $('tkMsg').value.trim();
      if (message.length < 3) { $('tkErr').textContent = 'Please describe the problem'; return; }
      $('tkSend').disabled = true; $('tkSend').textContent = 'SENDING…';
      const r = await api.supportOpen($('tkSub').value.trim() || 'Support request', message, $('tkCat').value);
      if (r && r.json && r.json.ok) { openTicket = r.json.id; open('support'); }
      else { $('tkErr').textContent = ({ too_many_open_tickets: 'You already have 5 open requests - close one first.', rate_limited: 'Slow down a little and try again.' })[r && r.json && r.json.error] || 'Could not send. Try again.'; $('tkSend').disabled = false; $('tkSend').textContent = 'SEND'; }
    };
  }
  async function renderTicket(my, id) {
    const t = await api.supportTicket(id);
    if (!live(my)) return;
    if (!t) { openTicket = null; return open('support'); }
    const msgs = t.messages.map((m) => `<div class="msg ${m.role}"><small>${m.role === 'user' ? 'YOU' : m.role === 'ai' ? 'SURF - ASSISTANT' : 'TEAM'}</small>${esc(m.text)}</div>`).join('');
    body.innerHTML = head(esc(t.subject), `${t.status === 'escalated' ? 'A human on the team will review this.' : t.status === 'closed' ? 'Closed' : 'Surf is on it.'}`, '<button class="btn sm" id="back">ALL REQUESTS</button>')
      + `<div class="chat" id="chat">${msgs}</div>`
      + (t.status === 'closed' ? '<div class="empty">This request is closed.</div>' : `<div class="composer"><input class="txt" id="tkLine" maxlength="1200" placeholder="Write a message…" autocomplete="off"><button class="btn go" id="tkSend">SEND</button></div><div class="row" style="margin-top:8px"><button class="btn sm" id="tkHuman">ASK A HUMAN</button><button class="btn sm red" id="tkClose">CLOSE REQUEST</button></div>`);
    const chat = $('chat'); chat.scrollTop = chat.scrollHeight;
    $('back').onclick = () => { click(); openTicket = null; open('support'); };
    if (t.status === 'closed') return;
    const send = async () => {
      const text = $('tkLine').value.trim();
      if (!text) return;
      $('tkLine').value = ''; $('tkSend').disabled = true;
      chat.insertAdjacentHTML('beforeend', `<div class="msg user"><small>YOU</small>${esc(text)}</div><div class="typing" id="typing"><i></i><i></i><i></i></div>`);
      chat.scrollTop = chat.scrollHeight;
      const r = await api.supportSend(id, text);
      if (r && r.json && !r.json.ok) { const ty = $('typing'); if (ty) ty.outerHTML = `<div class="msg ai"><small>SURF</small>${({ rate_limited: 'You are sending messages very fast - give me a moment.', ticket_closed: 'This request is closed.' })[r.json.error] || 'Something went wrong, please try again.'}</div>`; $('tkSend').disabled = false; return; }
      renderTicket(my, id);
    };
    $('tkSend').onclick = send;
    $('tkLine').onkeydown = (e) => { if (e.key === 'Enter') send(); e.stopPropagation(); };
    $('tkHuman').onclick = async () => { click(); await api.supportEscalate(id); toastBar('The team has been notified'); renderTicket(my, id); };
    $('tkClose').onclick = async () => { click(); await api.supportClose(id); openTicket = null; open('support'); };
  }

  // ------------------------------------------------------------------------------------ APPEALS
  const STATUS = { reviewing: ['In progress', 'var(--cyan)'], queued: ['Waiting for a moderator', 'var(--yellow)'] };
  const chip = (a) => { if (a.status === 'decided') return a.decision === 'overturned' ? ['Overturned', 'var(--green)'] : ['Upheld', '#ff8a8a']; return STATUS[a.status] || [a.status, '#fff']; };
  const when = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  async function pageAppeals(my) {
    if (!isOnline()) { body.innerHTML = head('SUPPORT', '') + needOnline('Appeals'); bindRetry('support'); return; }
    const d = await api.appeals();
    if (!live(my)) return;
    if (!d) { body.innerHTML = head('SUPPORT', '') + needOnline('Appeals'); bindRetry('support'); return; }
    if (typeof appealView === 'number') return appealDetail(my, appealView);
    if (appealView === 'form') return appealForm(my, d);
    const c = d.case, sanction = c.banned ? `Your account is suspended${c.banReason ? ': ' + esc(c.banReason) : ''}` : c.kickedUntil ? 'You were removed from online play for a while' : c.strikes > 0 ? `You have ${c.strikes} fair-play strike${c.strikes > 1 ? 's' : ''} on record` : '';
    const rows = d.appeals.map((a) => { const [t, col] = chip(a); return `<div class="rowx click" data-id="${a.id}"><b>#${a.id}</b><span class="tag2">${a.type === 'ai' ? 'AI Review' : 'Human Review'}</span><span class="sp"></span><span style="color:${col};font-family:var(--font)">${t}</span><span class="dim">${when(a.updated)}</span></div>`; }).join('');
    body.innerHTML = supSub() + head('APPEALS', 'Contest a kick, a ban or a strike. Maximum 3 appeals per account.', `<div class="pill"><span>${d.used}/${d.limit} used</span></div>`)
      + (sanction ? `<div class="banner" style="border-color:#e0344a"><div><h2>${sanction}</h2><p>${d.eligibility.ok ? 'If you think this is a mistake, you can contest it. Choose how it is reviewed when you submit.' : esc(d.eligibility.message || '')}</p></div>${d.eligibility.ok ? '<button class="btn go" id="appealNew">CONTEST THIS SANCTION</button>' : ''}</div>` : '<div class="empty">Nothing to contest: your account is in good standing.</div>')
      + (rows ? `<h3 class="ink" style="margin:14px 0 6px;color:var(--yellow)">Your appeals</h3>${rows}` : '');
    bindSup();
    const nb = $('appealNew'); if (nb) nb.onclick = () => { click(); appealView = 'form'; open('support'); };
    for (const r of body.querySelectorAll('.rowx.click')) r.onclick = () => { click(); appealView = Number(r.dataset.id); open('support'); };
  }
  function appealForm(my, d) {
    let type = 'ai';
    body.innerHTML = supSub() + head('CONTEST THIS SANCTION', '', '<button class="btn sm" id="back">BACK</button>')
      + `<div class="formbox" style="max-width:720px;margin-top:0"><label>How should it be reviewed?</label><div class="choice2"><button class="obcard sel" data-type="ai"><b>AI Review</b><small>Takes under 15 minutes. Two independent AI reviewers examine the recorded evidence.</small></button><button class="obcard" data-type="human"><b>Human Review</b><small>Takes 1 to 7 days. A moderator reads your case.</small></button></div><label>Tell us what happened</label><textarea class="txt" id="apMsg" rows="5" maxlength="1000" placeholder="What were you doing? Anything unusual with your connection or device?"></textarea><div class="err" id="apErr"></div><div class="stage-note">${d.left} appeal${d.left === 1 ? '' : 's'} left on this account.</div><div class="row"><button class="btn go" id="apGo">SUBMIT APPEAL</button></div></div>`;
    bindSup();
    $('back').onclick = () => { click(); appealView = null; open('support'); };
    for (const b of body.querySelectorAll('[data-type]')) b.onclick = () => { click(); type = b.dataset.type; for (const x of body.querySelectorAll('[data-type]')) x.classList.toggle('sel', x === b); };
    $('apGo').onclick = async () => {
      const msg = $('apMsg').value.trim();
      if (msg.length < 10) { $('apErr').textContent = 'Please describe what happened (10 characters minimum).'; return; }
      $('apGo').disabled = true;
      const r = await api.fileAppeal(type, msg);
      if (r && r.json && r.json.ok) { appealView = r.json.appeal.id; open('support'); }
      else { $('apErr').textContent = (r && r.json && (r.json.message || r.json.error)) || 'Could not send. Try again.'; $('apGo').disabled = false; }
    };
  }
  async function appealDetail(my, id) {
    const a = await api.appealDetail(id);
    if (!live(my)) return;
    if (!a) { appealView = null; return open('support'); }
    const [t, col] = chip(a);
    body.innerHTML = supSub() + head(`APPEAL #${a.id}`, a.sla, '<button class="btn sm" id="back">ALL APPEALS</button>')
      + `<div class="banner"><div><h2 style="color:${col}">${t}</h2><p>${a.status === 'reviewing' ? 'Two AI reviewers are on it - this page updates by itself.' : a.status === 'queued' ? 'A moderator will review your case. You can leave this page: you will be notified in game.' : a.decision === 'overturned' ? 'Your access is restored.' : 'The sanction stands. You can contest again if you have appeals left and new elements.'}</p></div><div class="cd"><small>${a.type === 'ai' ? 'AI REVIEW' : 'HUMAN REVIEW'}</small><b>${a.status === 'decided' ? '✓' : '…'}</b></div></div>`
      + `<div class="chartbox"><h4>Timeline</h4>${a.timeline.map((e) => `<div class="tlrow ${esc(e.kind)}"><div>${esc(e.text)}<small>${when(e.ts)}</small></div></div>`).join('')}</div>`
      + `<div class="chartbox" style="margin-top:14px"><h4>Your statement</h4><div style="white-space:pre-wrap">${esc(a.message)}</div></div>`;
    bindSup();
    $('back').onclick = () => { click(); appealView = null; open('support'); };
    if (a.status !== 'decided') timers.push(setInterval(async () => { const n = await api.appealDetail(id); if (n && (n.status !== a.status || n.timeline.length !== a.timeline.length)) { clearTimers(); if (live(my)) appealDetail(my, id); } }, a.type === 'ai' ? 2500 : 20000));
  }

  // ------------------------------------------------------------------------------------ ACCOUNT
  async function pageAccount(my) {
    const p = api.online.player;
    if (!isOnline()) { body.innerHTML = head('ACCOUNT', '') + needOnline('Accounts'); bindRetry('account'); return; }
    if (!p.hasAccount) { accountForms('register'); return; }
    const cloud = ctx.cloudStatus();
    body.innerHTML = head('ACCOUNT', 'Signed in - your progress is saved on the server.')
      + `<div class="stats4"><div class="stat4"><small>Username</small><b style="font-size:22px">${esc(p.username)}</b></div><div class="stat4"><small>Display name</small><b style="font-size:22px">${esc(p.name)}${premBadge(p.premium)}</b></div><div class="stat4"><small>Cloud sync</small><b style="font-size:22px">${esc(cloud)}</b></div><div class="stat4"><small>Rank</small><b style="font-size:22px">${p.tier} ${fmt(p.rating)}</b></div></div>`
      + (p.premium
        ? `<div class="banner prem-banner"><div><h2>${premBadge(true)} Premium unlocked</h2><p>Every cosmetic in the game is in your inventory, including event and tournament exclusives. Your badge follows your name on leaderboards.</p></div></div>`
        : `<div class="formbox" style="max-width:720px;margin-top:14px"><h2>REDEEM A CODE</h2><p class="stage-note">Premium codes unlock every cosmetic in the game and the PREMIUM badge. One code per account.</p><div class="row" style="justify-content:flex-start"><input class="txt" id="codeInput" maxlength="24" placeholder="RS2-XXXX-XXXX" autocomplete="off" spellcheck="false"><button class="btn go" id="codeGo">REDEEM</button></div><div class="err" id="codeErr"></div></div>`)
      + '<div class="row" style="justify-content:flex-start"><button class="btn sm" id="acName">CHANGE NAME</button><button class="btn sm" id="acPw">CHANGE PASSWORD</button><button class="btn sm" id="acSync">SYNC NOW</button><button class="btn sm" id="acAll">SIGN OUT EVERYWHERE</button><button class="btn sm red" id="acOut">SIGN OUT</button></div>';
    const codeGo = $('codeGo');
    if (codeGo) {
      const submit = async () => {
        const input = $('codeInput'), err = $('codeErr');
        const code = input.value.trim();
        if (!code) { err.textContent = 'Enter a code first'; input.focus(); return; }
        codeGo.disabled = true; err.textContent = '';
        const r = await api.redeemCode(code);
        codeGo.disabled = false;
        if (r && r.status === 200) { audio.sfx.mission(); toastBar('Premium unlocked - every cosmetic is now yours'); ctx.syncEconomy(); open('account'); }
        else { audio.sfx.deny(); err.textContent = (r && r.json && (r.json.message || r.json.error)) || 'Could not reach the server'; }
      };
      codeGo.onclick = submit;
      $('codeInput').onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') submit(); };
    }
    $('acName').onclick = () => ctx.rename().then(() => open('account'));
    $('acPw').onclick = async () => {
      const old = await dialog({ title: 'CURRENT PASSWORD', input: { password: true, max: 72, placeholder: 'Current password' }, yes: 'NEXT' }); if (!old) return;
      const nw = await dialog({ title: 'NEW PASSWORD', message: '8 to 72 characters. Other devices will be signed out.', input: { password: true, max: 72, placeholder: 'New password' }, yes: 'CHANGE', validate: (v) => (v.length < 8 ? 'At least 8 characters' : '') }); if (!nw) return;
      const r = await api.changePassword(old, nw);
      notify(r && r.status === 200 ? 'DONE' : 'ERROR', r && r.status === 200 ? 'Your password was changed.' : (r && r.json && r.json.message) || 'Could not change the password.');
    };
    $('acSync').onclick = async () => { await ctx.cloudPush(true); toastBar('Synced'); open('account'); };
    $('acAll').onclick = async () => { if (await ctx.confirm('Every other device will be signed out.', { yes: 'SIGN OUT' })) { await api.signOutEverywhere(); toastBar('Other devices signed out'); } };
    $('acOut').onclick = async () => { if (await ctx.confirm('You can sign back in any time. Local progress on this device is kept.', { yes: 'SIGN OUT' })) { await ctx.signOut(); open('account'); } };
  }
  function accountForms(mode) {
    const reg = mode === 'register';
    body.innerHTML = `<div class="formbox"><h2>${reg ? 'CREATE ACCOUNT' : 'SIGN IN'}</h2><p class="stage-note">${reg ? 'Keep your coins, runners and rank on every device. Your guest progress is carried over.' : 'Welcome back.'}</p><label>Username</label><input class="txt" id="auUser" maxlength="16" autocomplete="username" placeholder="3-16 letters, digits, _">${reg ? '<label>Display name</label><input class="txt" id="auName" maxlength="14" placeholder="Shown in races (optional)">' : ''}<label>Password</label><input class="txt" id="auPass" type="password" maxlength="72" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="8 characters minimum"><div class="err" id="auErr"></div><div class="row"><button class="btn go" id="auGo">${reg ? 'CREATE' : 'SIGN IN'}</button><button class="btn sm" id="auSwap">${reg ? 'I HAVE AN ACCOUNT' : 'CREATE ACCOUNT'}</button></div></div>`;
    for (const id of ['auUser', 'auName', 'auPass']) { const el = $(id); if (el) el.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') $('auGo').click(); }; }
    $('auSwap').onclick = () => { click(); accountForms(reg ? 'login' : 'register'); };
    $('auGo').onclick = async () => {
      $('auGo').disabled = true;
      const r = reg ? await api.register($('auUser').value, $('auPass').value, $('auName') && $('auName').value) : await api.login($('auUser').value, $('auPass').value);
      $('auGo').disabled = false;
      if (r && r.status === 200) { audio.sfx.mission(); await ctx.onSignedIn(reg && r.json.imported); toastBar(reg ? 'Account created' : 'Welcome back!'); open('account'); }
      else $('auErr').textContent = (r && r.json && (r.json.message || r.json.error)) || 'Could not reach the server';
    };
  }

  return { open, setBarVisible, refreshChrome, checkUpdates, get tab() { return tab; }, accountForms: () => { open('account'); }, toast: toastBar, openAppeals: () => { supView = 'appeals'; appealView = null; setBarVisible(true); open('support'); } };
}
