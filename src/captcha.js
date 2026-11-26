// A small, self-contained "metro check" shown once per browser session before the game starts.
// It is a polite gate for casual scraping/automation, not a security boundary: everything runs in the browser,
// and automated tests (navigator.webdriver) skip it. No third-party service, no tracking.
import { t } from './i18n.js';

const KEY = 'rs.captcha.v1';

const SYMBOLS = {
  train: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="8" width="40" height="44" rx="9" fill="#42a5ff"/><rect x="17" y="14" width="12" height="12" rx="3" fill="#dff3ff"/><rect x="35" y="14" width="12" height="12" rx="3" fill="#dff3ff"/><rect x="17" y="31" width="30" height="8" rx="3" fill="#0b3c78"/><circle cx="22" cy="47" r="4" fill="#ffd23f"/><circle cx="42" cy="47" r="4" fill="#ffd23f"/><rect x="8" y="53" width="48" height="4" rx="2" fill="#9fb6ce"/></svg>`,
  coin: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="23" fill="#ffd23f" stroke="#e0a800" stroke-width="4"/><circle cx="32" cy="32" r="15" fill="#ffe98a"/><path d="M32 20l3.6 7.6 8.4 1.1-6.1 5.8 1.5 8.3-7.4-4-7.4 4 1.5-8.3-6.1-5.8 8.4-1.1z" fill="#e0a800"/></svg>`,
  cone: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 9l16 40H16z" fill="#ff8a1f"/><rect x="20" y="35" width="24" height="7" fill="#fff3e0"/><rect x="10" y="49" width="44" height="7" rx="3" fill="#e06414"/></svg>`,
  barrier: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="18" width="52" height="18" rx="3" fill="#fff"/><path d="M10 18h10l-8 18H6zM28 18h10l-8 18H22zM46 18h8l-8 18h-8z" fill="#e0344a"/><rect x="12" y="36" width="6" height="20" fill="#9aa2b1"/><rect x="46" y="36" width="6" height="20" fill="#9aa2b1"/></svg>`,
  spray: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="20" width="20" height="34" rx="5" fill="#9b5cff"/><rect x="26" y="13" width="12" height="7" fill="#cfd3da"/><rect x="30" y="7" width="5" height="6" fill="#ff3d7f"/><path d="M24 28h16v6H24z" fill="#ffd23f"/></svg>`,
  star: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 7l7.4 15.6 17 2.3-12.4 11.8 3.1 17-15.1-8.2-15.1 8.2 3.1-17L8.6 24.9l17-2.3z" fill="#29f0ff" stroke="#0e1117" stroke-width="3"/></svg>`,
};

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

// Board: exactly 3 trains + 2 coins to find, 4 harmless distractors. Returns { tiles, targets }.
export function makeBoard() {
  const targets = shuffle(['train', 'train', 'train', 'coin', 'coin']);
  const others = shuffle(['cone', 'barrier', 'spray', 'star']);
  const tiles = shuffle([...targets, ...others]);
  return { tiles, targets: new Set(tiles.map((x, i) => (x === 'train' || x === 'coin' ? i : -1)).filter((i) => i >= 0)) };
}

export function isSolved(tiles, selected) {
  const target = new Set(tiles.map((x, i) => (x === 'train' || x === 'coin' ? i : -1)).filter((i) => i >= 0));
  if (target.size !== selected.size) return false;
  for (const i of target) if (!selected.has(i)) return false;
  return true;
}

export function captchaGate() {
  let done = false;
  try { done = sessionStorage.getItem(KEY) === '1'; } catch { /* storage blocked: show it */ }
  const skip = done || navigator.webdriver || /[?&]nocaptcha\b/.test(location.search);
  if (skip) return Promise.resolve();

  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.id = 'captcha';
    root.className = 'screen';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    document.getElementById('ui').appendChild(root);

    let tiles = [], selected = new Set(), tries = 0;
    const render = () => {
      const board = makeBoard();
      tiles = board.tiles; selected = new Set();
      root.innerHTML = `<div class="cap-panel">
        <div class="cap-head"><span class="cap-line"></span><b>${t('METRO CHECK')}</b><span class="cap-line"></span></div>
        <p class="cap-sub">${t('Select every train and every coin.')}</p>
        <div class="cap-grid">${tiles.map((s, i) => `<button class="cap-tile" data-i="${i}" aria-label="${t(s)}">${SYMBOLS[s]}<i class="cap-ok">✓</i></button>`).join('')}</div>
        <div class="cap-err" id="capErr">${tries ? t('Not quite. Try again.') : ''}</div>
        <div class="cap-foot"><small>${t('A quick check to keep bots off the track.')}</small><button class="btn go" id="capGo">${t('VERIFY')}</button></div>
      </div>`;
      for (const b of root.querySelectorAll('.cap-tile')) {
        b.onclick = () => {
          const i = Number(b.dataset.i);
          if (selected.has(i)) selected.delete(i); else selected.add(i);
          b.classList.toggle('sel', selected.has(i));
        };
      }
      const go = root.querySelector('#capGo');
      go.onclick = () => {
        if (isSolved(tiles, selected)) {
          try { sessionStorage.setItem(KEY, '1'); } catch { /* no storage: this tab only */ }
          root.classList.add('ok');
          setTimeout(() => { root.remove(); resolve(); }, 260);
        } else {
          tries++;
          root.querySelector('.cap-panel').classList.remove('shake');
          void root.querySelector('.cap-panel').offsetWidth;
          root.querySelector('.cap-panel').classList.add('shake');
          const err = root.querySelector('#capErr');
          if (err) err.textContent = t('Not quite. Try again.');
        }
      };
      go.focus();
    };
    render();
  });
}
