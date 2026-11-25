// Client side of the play flow: the mode card above PLAY, the mode picker, the party strip, the friends panel, party invites and
// the "looking for runners" overlay. The server side is server/social.mjs + the team queues in server/core.mjs.
import { MODES, CATS, modeById, specOf, modeArt, modeFromSpec, sizeName } from './modes.js';
import { icon } from './iconsax.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`;

export function initSocial(ctx) {
  const { $, api, net, online, save, persist, audio, dialog, toast, show, CHARACTERS, charId, ensureOnline, startDuel, startOffline, tainted } = ctx;
  const S = { party: null, fr: null, search: null, frTimer: null, soTimer: null, busy: false, matched: false };
  const meId = () => (online.player ? online.player.id : null);
  const rules = () => (save.settings.mode === 'nocoin' ? 'nocoin' : 'classic');
  const isLeader = () => !S.party || S.party.leader === meId();
  const partySize = () => (S.party ? S.party.members.length : 1);
  const followsLeader = () => !!S.party && S.party.members.length > 1 && !isLeader();
  const current = () => (followsLeader() ? modeFromSpec(S.party.spec) : modeById(save.playMode));
  const rankedLock = () => { const r = online.player && online.player.ranked; return r && !r.unlocked ? r : null; };
  const colorOf = (id) => (CHARACTERS.find((c) => c.id === id) || CHARACTERS[0]).top;
  const catName = (m) => (CATS.find((c) => c[0] === m.cat) || ['', ''])[1];
  const rulesName = () => (rules() === 'nocoin' ? 'No Coin' : 'Classic');

  // ------------------------------------------------------------------------------------------------- mode card
  function renderModeCard() {
    const m = current(), el = $('modeCard');
    el.innerHTML = `${modeArt(m)}<span class="mc-txt"><small>${esc(catName(m))}</small><b>${esc(m.name)}</b><em>${esc(m.tag)}${m.online && m.id !== 'room' ? ` · ${esc(rulesName())}` : ''}</em></span>${followsLeader() ? `<span class="mc-lock">${icon('lock', 20)}</span>` : '<i class="mc-chev"></i>'}`;
    el.classList.toggle('follow', followsLeader());
    const play = $('playBtn');
    if (S.busy || S.search) play.textContent = 'SEARCHING';
    else if (followsLeader()) play.textContent = 'WAITING FOR LEADER';
    else play.textContent = 'PLAY';
    play.classList.toggle('waiting', followsLeader() || S.busy || !!S.search);
  }

  // ----------------------------------------------------------------------------------------------- mode picker
  function pickDisabled(m) {
    if (m.id === 'ranked-1' || m.kind === 'ranked') { const r = rankedLock(); if (r) return `Ranked unlocks after ${Math.ceil(r.minSeconds / 60)} min of play (${Math.floor(r.played / 60)}/${Math.ceil(r.minSeconds / 60)})`; }
    if (partySize() > 1) {
      if (!m.online || m.ltm || m.room) return 'Leave the party to play this mode';
      if (m.size < partySize()) return `Too many players for ${sizeName(m.size)}`;
    }
    return '';
  }
  function renderPicker() {
    const body = $('mpBody');
    const card = (m) => {
      const off = pickDisabled(m);
      return `<button class="mp-card${m.id === current().id ? ' sel' : ''}${off ? ' off' : ''}" data-id="${m.id}" ${off ? `title="${esc(off)}"` : ''}>${modeArt(m)}<b>${esc(m.name)}</b><small>${esc(m.tag)}</small>${off ? `<span class="mp-lock">${icon('lock', 16)}<i>${esc(off)}</i></span>` : `<span class="chip">${esc(m.label)}</span>`}</button>`;
    };
    body.innerHTML = `<div class="mp-rules"><span>Rules</span><div class="seg"><button data-r="classic" class="${rules() === 'classic' ? 'sel' : ''}">Classic</button><button data-r="nocoin" class="${rules() === 'nocoin' ? 'sel' : ''}">No Coin</button></div><small>${esc(current().blurb)}</small></div>`
      + CATS.map(([cat, label]) => `<h4>${esc(label)}</h4><div class="mp-grid">${MODES.filter((m) => m.cat === cat).map(card).join('')}</div>`).join('');
    for (const b of body.querySelectorAll('.mp-card')) b.onclick = () => {
      const m = modeById(b.dataset.id);
      if (pickDisabled(m)) { audio.sfx.deny(); toast(pickDisabled(m)); return; }
      audio.sfx.click(); save.playMode = m.id; persist();
      if (m.kind && net.connected && isLeader()) net.send({ t: 'p_spec', spec: specOf(m, rules()) });
      show('modePick', false); renderModeCard();
    };
    for (const b of body.querySelectorAll('[data-r]')) b.onclick = () => {
      audio.sfx.click(); save.settings.mode = b.dataset.r; persist(); renderPicker(); renderModeCard();
      const m = modeById(save.playMode); if (m.kind && net.connected && isLeader()) net.send({ t: 'p_spec', spec: specOf(m, rules()) });
    };
  }
  $('modeCard').onclick = () => { if (followsLeader()) { toast('The party leader picks the mode'); return; } if (S.search) return; audio.sfx.click(); renderPicker(); show('modePick', true); };
  $('mpClose').onclick = () => { audio.sfx.click(); show('modePick', false); };

  // -------------------------------------------------------------------------------------------------- playing
  async function onPlay() {
    if (S.busy || S.search) return;
    if (followsLeader()) { toast('Waiting for the party leader'); return; }
    const m = modeById(save.playMode);
    audio.initAudio(); audio.resumeAudio();
    if (!m.online) { if (m.id === 'daily') $('btnDaily').click(); else { save.settings.mode = m.mode || 'classic'; persist(); startOffline(); } return; }
    if (m.room) { $('btnOnline').click(); return; }
    if (m.ltm) { startDuel(); return; }
    const lock = rankedLock();
    if (m.kind === 'ranked' && lock) { audio.sfx.deny(); toast(pickDisabled(m)); return; }
    S.busy = true; renderModeCard();
    try {
      await ensureOnline();
      net.send({ t: 'p_char', char: charId() });
      net.send({ t: 'p_spec', spec: specOf(m, rules()) });
      net.send({ t: 'p_play' });
      setTimeout(() => { if (S.busy && !S.search) { S.busy = false; renderModeCard(); } }, 3000); // the server answered nothing: unlock the button
    } catch (e) {
      S.busy = false; renderModeCard();
      toast(String(e.message || e));
      if (!tainted()) { const go = await dialog({ title: 'SERVER UNREACHABLE', message: 'Online modes need a connection. Play an offline run instead?', yes: 'PLAY OFFLINE', no: 'CLOSE' }); if (go) { save.settings.mode = rules(); persist(); startOffline(); } }
    }
  }

  // --------------------------------------------------------------------------------------------- search overlay
  function openSearch(spec, info = {}) {
    S.busy = false; S.matched = false;
    S.search = { t0: performance.now(), spec, ...info };
    clearInterval(S.soTimer);
    show('searchOv', true); renderSearch(); renderModeCard();
    S.soTimer = setInterval(() => { const el = $('soTime'); if (el && S.search) { el.textContent = mmss((performance.now() - S.search.t0) / 1000); if (!S.matched && performance.now() - S.search.t0 > 15000) $('soOffline').style.display = ''; } }, 250);
  }
  function closeSearch() { S.search = null; S.busy = false; clearInterval(S.soTimer); show('searchOv', false); renderModeCard(); }
  function renderSearch() {
    const s = S.search; if (!s) return;
    const m = s.spec ? modeFromSpec(s.spec) : current();
    const members = S.party ? S.party.members : [];
    $('soBody').innerHTML = `<div class="so-art">${modeArt(m, { size: 'lg' })}</div><h3>${esc(m.name)}</h3><p class="so-sub">${esc(rulesName())}${s.tier ? ` · ${esc(s.tier)} ${esc(s.rating)}` : ''}</p>`
      + `<div class="so-time" id="soTime">${mmss((performance.now() - s.t0) / 1000)}</div><p class="so-note" id="soNote">${esc(s.note || 'Looking for runners')}</p>`
      + `<div class="so-party">${members.map((p) => `<span class="so-chip" style="--c:${colorOf(p.char)}"><i>${esc((p.name || '?')[0].toUpperCase())}</i>${esc(p.name)}</span>`).join('')}</div>`
      + (s.teams ? `<div class="so-teams">${s.teams.map((t, i) => `<div class="${i === s.mine ? 'mine' : ''}"><small>${i === s.mine ? 'Your team' : 'Rivals'}</small>${t.map((p) => `<span>${esc(p.name)}${p.tier ? ` <em>${esc(p.tier)}</em>` : ''}</span>`).join('')}</div>`).join('')}</div>` : '');
    $('soCancel').style.display = isLeader() && !S.matched ? '' : 'none';
    $('soOffline').style.display = !S.matched && performance.now() - s.t0 > 15000 ? '' : 'none';
  }
  $('soCancel').onclick = () => { audio.sfx.click(); net.send({ t: 'p_cancel' }); };
  $('soOffline').onclick = () => { audio.sfx.click(); net.send({ t: 'p_cancel' }); closeSearch(); save.settings.mode = rules(); persist(); startOffline(); };

  // ------------------------------------------------------------------------------------------------ party strip
  function renderParty() {
    const strip = $('partyStrip');
    if (!online.player) { strip.classList.add('hidden'); return; }
    strip.classList.remove('hidden');
    const list = S.party ? S.party.members : [{ id: meId(), name: online.player.name, char: charId() }];
    const lead = S.party ? S.party.leader : meId();
    const slots = [0, 1, 2].map((i) => {
      const p = list[i];
      if (!p) return `<button class="pslot add" data-add="1" title="Invite a friend"><span>${icon('user', 22)}</span><i>+</i></button>`;
      const kick = S.party && lead === meId() && p.id !== meId() ? `<u data-kick="${esc(p.id)}" title="Remove">×</u>` : '';
      return `<div class="pslot${p.id === meId() ? ' me' : ''}${p.online === false ? ' off' : ''}" style="--c:${colorOf(p.char)}" title="${esc(p.name)}"><span class="av">${esc((p.name || '?')[0].toUpperCase())}</span>${p.id === lead && list.length > 1 ? `<s>${icon('crown', 14)}</s>` : ''}<b>${esc(p.name)}</b>${kick}</div>`;
    });
    strip.innerHTML = slots.join('') + (S.party ? '<button class="pleave" id="pLeave">Leave</button>' : '');
    for (const b of strip.querySelectorAll('[data-add]')) b.onclick = () => openFriends();
    for (const b of strip.querySelectorAll('[data-kick]')) b.onclick = (e) => { e.stopPropagation(); net.send({ t: 'p_kick', id: b.dataset.kick }); };
    const lv = $('pLeave'); if (lv) lv.onclick = () => { net.send({ t: 'p_leave' }); };
  }

  // ----------------------------------------------------------------------------------------------- friends panel
  const PRES = { lobby: 'Online', queue: 'In queue', match: 'In a match', offline: 'Offline' };
  async function loadFriends() {
    if (!online.token) return;
    const r = await api.call('GET', '/api/friends');
    if (r && r.status === 200) { S.fr = r.json; renderFriends(); badge(); }
  }
  function badge() { const n = S.fr ? S.fr.incoming.length : 0; const b = $('tbFrBadge'); if (b) { b.textContent = n || ''; b.classList.toggle('on', n > 0); } }
  function renderFriends() {
    const box = $('frBody'), d = S.fr;
    if (!online.token) { box.innerHTML = '<p class="stage-note">Sign in (or start an online game once) to use friends.</p>'; return; }
    if (!d) { box.innerHTML = '<p class="stage-note">Loading...</p>'; return; }
    const canInvite = isLeader() && partySize() < 3 && !S.search;
    const row = (f, kind) => {
      const pres = f.presence || 'offline';
      let btns = '';
      if (kind === 'friend') {
        if (pres !== 'offline' && canInvite && !(S.party && S.party.members.some((m) => m.id === f.id))) btns += `<button class="btn sm" data-inv="${esc(f.id)}">INVITE</button>`;
        if (f.joinable && !S.party) btns += `<button class="btn sm green" data-join="${esc(f.id)}">JOIN</button>`;
        btns += `<button class="icon-btn" data-rm="${esc(f.id)}" title="Remove friend">${icon('close', 18)}</button>`;
      } else if (kind === 'in') btns = `<button class="btn sm green" data-acc="${esc(f.id)}">ACCEPT</button><button class="btn sm red" data-dec="${esc(f.id)}">DECLINE</button>`;
      else btns = `<button class="icon-btn" data-rm="${esc(f.id)}" title="Cancel request">${icon('close', 18)}</button>`;
      return `<div class="fr-row ${pres}"><i class="dot"></i><b>${esc(f.name)}</b><span class="tier">${esc(f.tier)}</span><span class="pres">${kind === 'friend' ? esc(PRES[pres]) : kind === 'in' ? 'wants to be your friend' : 'request sent'}</span><span class="fr-btns">${btns}</span></div>`;
    };
    box.innerHTML = `<div class="fr-top"><div class="fr-code"><small>Your friend code</small><b id="frCode">${esc(d.code)}</b><button class="btn sm" id="frCopy">COPY</button></div>`
      + `<form class="fr-add" id="frForm"><input id="frAdd" placeholder="Username or friend code" maxlength="20" autocomplete="off" spellcheck="false"><button class="btn sm go" type="submit">ADD</button></form></div><p class="fr-msg ${S.msg ? S.msg.cls : ''}" id="frMsg">${esc(S.msg ? S.msg.text : '')}</p>`
      + (d.incoming.length ? `<h4>Requests (${d.incoming.length})</h4>${d.incoming.map((f) => row(f, 'in')).join('')}` : '')
      + `<h4>Friends (${d.friends.filter((f) => f.presence !== 'offline').length} online)</h4>${d.friends.length ? d.friends.map((f) => row(f, 'friend')).join('') : '<p class="stage-note">No friends yet. Share your code or add a username.</p>'}`
      + (d.outgoing.length ? `<h4>Sent</h4>${d.outgoing.map((f) => row(f, 'out')).join('')}` : '');
    $('frCopy').onclick = async () => { try { await navigator.clipboard.writeText(d.code); toast('Friend code copied'); } catch { toast(d.code); } };
    $('frForm').onsubmit = async (e) => {
      e.preventDefault();
      const v = $('frAdd').value.trim(); if (!v) return;
      const r = await api.call('POST', '/api/friends/request', { name: v });
      const j = r ? r.json : {};
      const good = !!r && r.status === 200;
      S.msg = { text: good ? (j.status === 'accepted' ? 'You are now friends' : 'Request sent') : (j.message || 'Could not reach the server'), cls: good ? 'ok' : 'bad' };
      $('frMsg').textContent = S.msg.text; $('frMsg').className = `fr-msg ${S.msg.cls}`;
      if (good) { $('frAdd').value = ''; loadFriends(); }
    };
    for (const b of box.querySelectorAll('[data-inv]')) b.onclick = async () => { audio.sfx.click(); await ensureOnline().catch(() => {}); net.send({ t: 'p_invite', id: b.dataset.inv }); };
    for (const b of box.querySelectorAll('[data-join]')) b.onclick = () => { audio.sfx.click(); const f = d.friends.find((x) => x.id === b.dataset.join); toast(`Ask ${f ? f.name : 'your friend'} to invite you`); };
    for (const b of box.querySelectorAll('[data-acc]')) b.onclick = async () => { audio.sfx.click(); await api.call('POST', '/api/friends/respond', { id: b.dataset.acc, accept: true }); loadFriends(); };
    for (const b of box.querySelectorAll('[data-dec]')) b.onclick = async () => { audio.sfx.click(); await api.call('POST', '/api/friends/respond', { id: b.dataset.dec, accept: false }); loadFriends(); };
    for (const b of box.querySelectorAll('[data-rm]')) b.onclick = async () => {
      const f = [...d.friends, ...d.outgoing].find((x) => x.id === b.dataset.rm);
      if (f && d.friends.includes(f) && !(await dialog({ title: 'REMOVE FRIEND', message: `Remove ${f.name} from your friends?`, yes: 'REMOVE', no: 'KEEP', danger: true }))) return;
      await api.call('POST', '/api/friends/remove', { id: b.dataset.rm }); loadFriends();
    };
  }
  async function openFriends() {
    audio.sfx.click();
    if (!online.token || !net.connected) { try { await ensureOnline(); } catch (e) { toast(String(e.message || e)); } }
    renderFriends(); show('friends', true); loadFriends();
    clearInterval(S.frTimer); S.frTimer = setInterval(() => { if (!$('friends').classList.contains('hidden')) loadFriends(); else clearInterval(S.frTimer); }, 12000);
  }
  $('tbFriends').onclick = openFriends;
  $('frClose').onclick = () => { audio.sfx.click(); show('friends', false); clearInterval(S.frTimer); };

  // ---------------------------------------------------------------------------------------------- net events
  const also = (type, fn) => net.also(type, fn);
  net.on('party', (m) => {
    const was = S.party;
    S.party = m; renderParty(); renderModeCard();
    if (m.spec && m.members.length > 1 && m.leader !== meId()) { const mm = modeFromSpec(m.spec); save.settings.mode = m.spec.mode; save.playMode = mm.id; }
    if (S.search && m.state === 'idle' && !S.matched) closeSearch();
    if (S.search) renderSearch();
    if (was && was.members.length !== m.members.length && !$('friends').classList.contains('hidden')) renderFriends();
  });
  net.on('party_gone', (m) => { S.party = null; if (S.search && !S.matched) closeSearch(); renderParty(); renderModeCard(); if (m.reason === 'kicked') toast('You were removed from the party'); else if (m.reason === 'disconnected') toast('Party closed'); });
  net.on('party_note', (m) => toast(m.msg));
  net.on('party_err', (m) => { toast(m.msg); S.busy = false; renderModeCard(); });
  net.on('party_invite', async (m) => {
    audio.sfx.power();
    const yes = await dialog({ title: 'PARTY INVITE', message: `${m.from.name} invites you to their party.`, yes: 'JOIN', no: 'LATER' });
    if (yes) { if (S.party) net.send({ t: 'p_leave' }); setTimeout(() => net.send({ t: 'p_join', id: m.id }), 80); } else net.send({ t: 'p_decline', id: m.id });
  });
  net.on('friend_req', (m) => { audio.sfx.power(); toast(`${m.from.name} sent you a friend request`); loadFriends(); });
  net.on('friend_ok', (m) => { toast(`${m.who.name} accepted your friend request`); loadFriends(); });
  net.on('friend_presence', (m) => { if (S.fr) { const f = S.fr.friends.find((x) => x.id === m.id); if (f) { f.presence = m.presence; if (!$('friends').classList.contains('hidden')) renderFriends(); } } });
  net.on('tq_queued', (m) => openSearch(m.spec, { rating: m.rating, tier: m.tier, note: m.size > 1 ? 'Looking for opponents' : 'Looking for runners' }));
  net.on('tq_searching', (m) => { if (S.search) { S.search.note = `${m.found} of ${m.need} runners found`; const n = $('soNote'); if (n) n.textContent = S.search.note; } });
  net.on('tq_cancelled', () => closeSearch());
  also('queued', (m) => { if (S.busy) openSearch({ kind: 'ranked', size: 1, mode: m.mode }, { rating: m.rating, tier: m.tier, note: 'Looking for runners near your rating' }); });
  also('searching', (m) => { if (S.search) { S.search.note = `Range ±${m.range} · ${m.found} runner${m.found > 1 ? 's' : ''} in range`; const n = $('soNote'); if (n) n.textContent = S.search.note; } });
  also('queue_cancelled', () => { if (S.search) closeSearch(); });
  also('match', (m) => {
    if (!S.search) return;
    S.matched = true;
    S.search.note = 'MATCH FOUND';
    if (m.teams) { S.search.teams = m.teams; S.search.mine = m.teams.findIndex((t) => t.some((p) => online.player && p.name === online.player.name)); }
    renderSearch(); const n = $('soNote'); if (n) { n.textContent = 'MATCH FOUND'; n.classList.add('found'); }
    audio.sfx.power();
  });
  also('start', () => closeSearch());
  also('authed', () => { renderParty(); loadFriends(); });
  let retry = 0;
  also('close', () => {
    S.party = null; if (S.search) closeSearch(); renderParty(); renderModeCard();
    if (!online.player || tainted()) return;
    const wait = Math.min(30000, 3000 * 2 ** retry++); // reconnect with back-off (server restart, sleeping host, wifi)
    setTimeout(() => { if (!net.connected && !ctx.inRace()) ensureOnline().then(() => { retry = 0; }).catch(() => {}); }, wait);
  });
  also('authed', () => { retry = 0; });

  // ------------------------------------------------------------------------------------------------- public
  if (!save.playMode) save.playMode = 'solo-classic'; // a new player can always start at once; online modes are one pick away
  renderModeCard(); renderParty();
  return {
    onPlay, openFriends, renderModeCard, renderParty,
    get party() { return S.party; },
    refresh() { renderParty(); renderModeCard(); },
  };
}
