// Signed tokens (HMAC-SHA256). Account tokens and one-shot run tickets share the same signer.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db.mjs';

const keyFile = path.join(DATA_DIR, 'secret.key');
let KEY;
if (process.env.AUTH_SECRET) KEY = Buffer.from(process.env.AUTH_SECRET, 'utf8');
else {
  if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(32), { mode: 0o600 });
  KEY = fs.readFileSync(keyFile);
}

const b64 = (b) => Buffer.from(b).toString('base64url');
export function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', KEY).update(body).digest('base64url');
  return `${body}.${mac}`;
}
export function verify(token) {
  if (typeof token !== 'string' || token.length > 600) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const good = crypto.createHmac('sha256', KEY).update(body).digest();
  let given;
  try { given = Buffer.from(mac, 'base64url'); } catch { return null; }
  if (given.length !== good.length || !crypto.timingSafeEqual(given, good)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
}
export const nonce = () => crypto.randomBytes(12).toString('base64url');
export const uuid = () => crypto.randomUUID();

// ---- passwords: scrypt (memory-hard) with a per-account random salt, constant-time compare
export function hashPassword(password, salt = crypto.randomBytes(16).toString('base64url')) {
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('base64url');
  return { hash, salt };
}
export function checkPassword(password, hash, salt) {
  if (!hash || !salt) return false;
  const a = Buffer.from(hashPassword(password, salt).hash), b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
