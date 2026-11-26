// Premium redemption codes (Roblox-style). The list lives in codes.json: 100 random-looking, single-use codes.
// A code unlocks every cosmetic in the catalogue (event and tournament exclusives included), forever, and the
// PREMIUM badge on the account. One code per account, one account per code. Everything is decided here: the
// client only displays the result.
import fs from 'node:fs';
import { q, tx } from './db.mjs';
import { COSMETICS, nowMs } from './catalog.mjs';
import { invOf } from './economy.mjs';

const RAW = JSON.parse(fs.readFileSync(new URL('./codes.json', import.meta.url), 'utf8'));
export const CODE_COUNT = RAW.length;
// Players may type spaces, lower case or omit the dashes: compare on letters/digits only.
export const normalizeCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const VALID = new Set(RAW.map(normalizeCode));

const ERRORS = {
  bad_code: 'That code is not valid.',
  used_code: 'That code has already been used.',
  already_redeemed: 'This account already redeemed a code.',
  account_required: 'Create an account before redeeming a code.',
  unavailable: 'The code service is unavailable.',
};

export function redeem(pid, raw) {
  const code = normalizeCode(raw);
  if (!VALID.has(code)) return { ok: false, error: 'bad_code', message: ERRORS.bad_code };
  return tx(() => {
    const p = q.getPlayer.get(pid);
    if (!p) return { ok: false, error: 'unavailable', message: ERRORS.unavailable };
    if (!p.username) return { ok: false, error: 'account_required', message: ERRORS.account_required };
    if (q.codeByPid.get(pid)) return { ok: false, error: 'already_redeemed', message: ERRORS.already_redeemed };
    if (q.codeByCode.get(code)) return { ok: false, error: 'used_code', message: ERRORS.used_code };
    const inv = invOf(p);
    const granted = [];
    for (const id of Object.keys(COSMETICS)) {
      if (!inv.cos.includes(id)) { inv.cos.push(id); granted.push(id); }
    }
    q.claimCode.run(code, pid, nowMs());
    q.setPremium.run(nowMs(), pid);
    q.setInv.run(JSON.stringify(inv), p.wallet, p.imported, pid);
    return { ok: true, code, premium: true, granted: granted.length, cosmetics: granted };
  });
}

// Used by tests and the admin docs page; never exposed by a REST route.
export const codeList = () => RAW.slice();
