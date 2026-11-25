// Machine-translates every English UI string (dictionary, patch notes, settings, secret menu, new UI) into the extra languages.
//   node tools/translate.mjs [lang ...]          (default: every language except English)
// Output: public/lang/<code>.json = { "English string": "translation" }. Re-runnable: strings already done are skipped, so after
// adding UI text you only pay for the new strings. English and French are hand-written; French only gets its gaps filled here.
// Uses the providers of server/ai.mjs (.env): Token Harbor first, OpenRouter as the fallback.
import '../server/env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { EN_KEYS, LANGS } from '../src/i18n.js';
import { UPDATES } from '../server/updates.mjs';
import { SCHEMA } from '../src/settings.js';
import { OPTIONS, GROUPS } from '../src/secret.js';

const root = path.resolve(import.meta.dirname, '..');
const OUT = path.join(root, 'public', 'lang');
fs.mkdirSync(OUT, { recursive: true });

// ---- every English string
const keys = new Set(EN_KEYS);
const add = (s) => { if (typeof s === 'string' && s.trim() && /[A-Za-z]/.test(s) && s.length < 400) keys.add(s.trim()); };
for (const u of UPDATES) { add(u.title); (u.tags || []).forEach(add); (u.notes || []).forEach(add); }
for (const g of SCHEMA) { add(g.tab); for (const it of g.items) { add(it.label); add(it.hint); (it.opts || []).forEach(([, n]) => add(n)); } }
for (const g of GROUPS) { add(g); add(g.toUpperCase()); }
for (const o of OPTIONS) { add(o.label); add(o.hint); (o.opts || []).forEach(([, n]) => add(n)); }
try { const m = await import('../src/strings.js'); (m.UI_STRINGS || []).forEach(add); } catch { /* no strings file yet */ }
const ALL = [...keys];

const NAMES = { fr: 'French', es: 'Spanish (Spain, neutral)', de: 'German', pt: 'Portuguese (Brazil)', it: 'Italian', nl: 'Dutch', pl: 'Polish', tr: 'Turkish', ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Simplified Chinese' };
const PROVIDERS = [
  { id: 'tokenharbor', url: 'https://tokenharbor.ai/v1/chat/completions', key: process.env.TOKENHARBOR_API_KEY, model: (process.env.TOKENHARBOR_MODELS || 'deepseek-v4.1-flash:free').split(',')[0].trim(), extra: { thinking: { type: 'disabled' } } },
  { id: 'openrouter', url: 'https://openrouter.ai/api/v1/chat/completions', key: process.env.OPENROUTER_API_KEY, model: (process.env.OPENROUTER_MODELS || 'nvidia/nemotron-3-ultra-550b-a55b:free').split(',')[0].trim(), extra: { reasoning: { enabled: false } } },
].filter((p) => p.key);
if (!PROVIDERS.length) { console.error('No provider key in .env (TOKENHARBOR_API_KEY / OPENROUTER_API_KEY).'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ask(lang, batch, attempt = 0) {
  const p = PROVIDERS[attempt % PROVIDERS.length];
  const system = `You translate user-interface strings of a casual 3D endless-runner video game (Reverse Surfers: runners, trains, hoverboards, ranked matches, parties) from English into ${NAMES[lang]}. Rules: natural, short, playful game wording. Keep every number, symbol, emoji, punctuation mark, line break and key name (Space, Esc, P, M, B) exactly. Keep ALL CAPS strings in capitals where the language has them. Do not translate the product name "Reverse Surfers", "Spray", "Rio", "Gold Rush", "Gold Eagle", "Winter Fest", "Iconsax". Output ONLY a JSON array of strings with exactly the same length and order as the input.`;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 90000);
  try {
    const r = await fetch(p.url, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` }, body: JSON.stringify({ model: p.model, temperature: 0.2, max_tokens: 6000, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(batch) }], ...p.extra }) });
    if (!r.ok) throw new Error(`${p.id} HTTP ${r.status}`);
    const j = await r.json();
    const txt = String(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '');
    const a = txt.indexOf('['), b = txt.lastIndexOf(']');
    const arr = JSON.parse(txt.slice(a, b + 1));
    if (!Array.isArray(arr) || arr.length !== batch.length || arr.some((x) => typeof x !== 'string' || !x.trim())) throw new Error('shape');
    return arr;
  } finally { clearTimeout(to); }
}
async function translateBatch(lang, batch, depth = 0) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await ask(lang, batch, attempt); } catch (e) { await sleep(1500 * (attempt + 1)); }
  }
  if (batch.length === 1) return null;
  const h = batch.length >> 1; // split the batch: a long string or a bad answer must not block the others
  const [x, y] = await Promise.all([translateBatch(lang, batch.slice(0, h), depth + 1), translateBatch(lang, batch.slice(h), depth + 1)]);
  return [...(x || batch.slice(0, h).map(() => null)), ...(y || batch.slice(h).map(() => null))];
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : LANGS.map(([c]) => c).filter((c) => c !== 'en');
for (const lang of targets) {
  const file = path.join(OUT, `${lang}.json`);
  const dict = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const todo = ALL.filter((k) => dict[k] === undefined && !(lang === 'fr' && EN_KEYS.includes(k))); // French keeps its hand-written entries
  console.log(`${lang}: ${todo.length} to translate (${Object.keys(dict).length} done)`);
  const BATCH = 30, jobs = [];
  for (let i = 0; i < todo.length; i += BATCH) jobs.push(todo.slice(i, i + BATCH));
  let next = 0, done = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const batch = jobs[next++];
      const out = await translateBatch(lang, batch);
      batch.forEach((k, i) => { if (out && out[i]) dict[k] = out[i]; });
      done += batch.length;
      fs.writeFileSync(file, JSON.stringify(dict, null, 0));
      process.stdout.write(`  ${lang} ${done}/${todo.length}\r`);
      await sleep(1200);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const missing = ALL.filter((k) => dict[k] === undefined && !(lang === 'fr' && EN_KEYS.includes(k))).length;
  console.log(`\n${lang}: ${Object.keys(dict).length} strings, ${missing} missing`);
}
