// Publish to GitHub:   GITHUB_TOKEN=... node scripts/publish.mjs ["commit message"]
//   game repo    (whole project)            -> OWNER/sprayrun-games
//   backend repo (server + shared rules)    -> OWNER/sprayrun-backends
// Safety: the token is read from the environment only and is NEVER written to disk or to git config (the push URL is
// passed on the command line, output is scrubbed). Every file is scanned for secrets before it is committed.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BACKEND_VERSION } from '../server/version.mjs';
import { GAME_VERSION } from '../src/version.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = process.env.GITHUB_TOKEN;
const DRY = !!process.env.DRY_RUN; // DRY_RUN=1: stage the backend and check its imports, push nothing (no token needed)
const OWNER = process.env.GITHUB_OWNER || 'l1m00ns';
const GAME = process.env.GAME_REPO || 'sprayrun-games', BACK = process.env.BACKEND_REPO || 'sprayrun-backends';
const message = process.argv[2] || 'Update Reverse Surfers';
if (!TOKEN && !DRY) { console.error('Set GITHUB_TOKEN in the environment (or DRY_RUN=1 for a check without pushing).'); process.exit(1); }

const scrub = (s) => (TOKEN ? String(s).split(TOKEN).join('***') : String(s));
function git(cwd, args, { allowFail = false } = {}) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (e) { if (allowFail) return ''; throw new Error(scrub(`git ${args[0]} failed: ${e.stderr || e.message}`).slice(0, 600)); }
}

// ---- secret scan: refuse to commit anything that looks like a credential
const PATTERNS = [/sk-or-v1-[a-f0-9]{24,}/, /thk_live_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{30,}/, /ghp_[A-Za-z0-9]{30,}/, /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, /sk-ant-[A-Za-z0-9_-]{20,}/];
function scan(dir) {
  const bad = [];
  for (const f of git(dir, ['ls-files', '--cached', '--others', '--exclude-standard']).split('\n').filter(Boolean)) {
    if (/(^|\/)Rio\.glb$/i.test(f)) { bad.push(f + ' (extracted from the commercial game: never published)'); continue; }
    if (/\.(png|jpg|jpeg|glb|woff2?|ico|gif|db|key)$/i.test(f)) { if (/(secret\.key|\.db)$/.test(f)) bad.push(f + ' (data file)'); continue; }
    let text; try { text = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
    if (f === '.env' || path.basename(f) === '.env') bad.push(f + ' (.env must never be committed)');
    for (const re of PATTERNS) if (re.test(text)) bad.push(`${f} (matches ${re.source.slice(0, 18)}...)`);
  }
  if (bad.length) { console.error('Refusing to publish, secrets found:\n  ' + bad.join('\n  ')); process.exit(2); }
}

function publish(dir, repo) {
  if (!fs.existsSync(path.join(dir, '.git'))) git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.name', OWNER]);
  git(dir, ['config', 'user.email', `${OWNER}@users.noreply.github.com`]); // public noreply address, never a private email
  git(dir, ['add', '-A']);
  scan(dir);
  const dirty = git(dir, ['status', '--porcelain']);
  if (dirty) git(dir, ['commit', '-m', `${message}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`]);
  const url = `https://x-access-token:${TOKEN}@github.com/${OWNER}/${repo}.git`;
  const out = git(dir, ['push', url, 'HEAD:main']);
  console.log(`${repo}: ${dirty ? 'committed + ' : 'nothing new, '}pushed (${git(dir, ['rev-parse', '--short', 'HEAD'])}) ${scrub(out)}`.trim());
  return git(dir, ['rev-parse', '--short=7', 'HEAD']);
}

// Version = <number>-<commit>: tag the pushed commit and publish a GitHub release with that name.
async function release(dir, repo, number, short) {
  const version = `${number}-${short}`, tag = `v${version}`;
  const url = `https://x-access-token:${TOKEN}@github.com/${OWNER}/${repo}.git`;
  git(dir, ['tag', '-f', tag]);
  git(dir, ['push', url, `refs/tags/${tag}`, '--force']);
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/releases`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'reverse-surfers-publish' },
    body: JSON.stringify({ tag_name: tag, name: version, body: message, target_commitish: 'main', make_latest: 'true' }),
  });
  console.log(`${repo}: version ${version} (tag ${tag}, release ${r.status === 201 ? 'created' : r.status === 422 ? 'already exists' : 'HTTP ' + r.status})`);
}

// ---- 1. the whole game
let gameShort = '';
if (!DRY) gameShort = publish(root, GAME);

// ---- 2. the backend, staged in its own folder (server/ + the two shared rule files + tests)
const stage = path.join(os.tmpdir(), 'rs-backend-stage');
fs.mkdirSync(stage, { recursive: true });
for (const e of fs.readdirSync(stage)) if (e !== '.git' && e !== 'node_modules') fs.rmSync(path.join(stage, e), { recursive: true, force: true });
const copy = (from, to = from) => { const dst = path.join(stage, to); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.cpSync(path.join(root, from), dst, { recursive: true }); };
for (const f of fs.readdirSync(path.join(root, 'server'))) if ((f.endsWith('.mjs') && f !== 'standalone.mjs') || f === 'codes.json') copy(`server/${f}`); // codes.json is imported by codes.mjs
// The backend's own entry point: the same file as server/standalone.mjs, but it now lives at the repository ROOT, so its
// import must point into ./server/ (a plain copy kept `from './core.mjs'`, which does not exist there and broke the build).
const entry = fs.readFileSync(path.join(root, 'server', 'standalone.mjs'), 'utf8');
if (!entry.includes("from './core.mjs'")) throw new Error("server/standalone.mjs no longer imports './core.mjs': update scripts/publish.mjs");
fs.writeFileSync(path.join(stage, 'server.mjs'), entry.replace(/from '\.\/([a-z]+\.mjs)'/g, "from './server/$1'")); // every sibling import now points into ./server/
copy('src/consts.js'); copy('src/arena.js'); // movement / speed rules shared with the client (the server validates with them)
for (const t of ['backend.mjs', 'duel-net.mjs', 'social.mjs', 'analytics.mjs', 'tournaments.mjs', 'ai-probe.mjs', 'ai-panel.mjs', 'ai-tune.mjs']) if (fs.existsSync(path.join(root, 'tools', t))) copy(`tools/${t}`);
copy('.env.example');
fs.writeFileSync(path.join(stage, '.gitignore'), 'node_modules\ndata\n.env\n*.log\n');
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
  name: 'sprayrun-backends', version: BACKEND_VERSION, private: true, type: 'module', description: 'Reverse Surfers backend: accounts, economy, ranked, duels, anti-cheat, AI review',
  engines: { node: '>=22.13' }, scripts: { start: 'node server.mjs', test: 'node tools/backend.mjs && node tools/duel-net.mjs && node tools/social.mjs && node tools/analytics.mjs && node tools/tournaments.mjs' }, dependencies: { ws: '^8.23.0' },
}, null, 2) + '\n');
fs.writeFileSync(path.join(stage, 'README.md'), fs.readFileSync(path.join(root, 'server', 'README.md'), 'utf8'));
// Render / Railway / Fly: one-click settings. Node 24 so that node:sqlite works without flags; TRUST_PROXY because the platform
// puts a reverse proxy in front (real client IPs for VPN detection and rate limits).
fs.writeFileSync(path.join(stage, '.node-version'), '24\n');
fs.writeFileSync(path.join(stage, 'render.yaml'), `services:
  - type: web
    name: reverse-surfers-backend
    runtime: node
    plan: free
    buildCommand: npm install
    startCommand: node server.mjs
    healthCheckPath: /health
    envVars:
      - key: NODE_VERSION
        value: "24"
      - key: TRUST_PROXY
        value: "1"
      - key: CORS_ORIGIN # the address of your front-end, e.g. https://my-game.vercel.app (empty = any site)
        sync: false
      - key: ADMIN_KEY
        generateValue: true
      - key: OPENROUTER_API_KEY
        sync: false
      - key: TOKENHARBOR_API_KEY
        sync: false
      # DATA_DIR: add a persistent disk (paid plans) mounted at /var/data and set DATA_DIR=/var/data, otherwise the
      # database lives on the instance's ephemeral disk and is reset on every deploy.
`);
// Safety net: every relative import in the staged backend must resolve to a real file (this is what broke `vercel build`).
function checkImports(dir) {
  const broken = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) { walk(f); continue; }
      if (!/\.(mjs|js)$/.test(e.name)) continue;
      const text = fs.readFileSync(f, 'utf8');
      for (const m of text.matchAll(/(?:from\s+|import\s+|import\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
        if (!fs.existsSync(path.resolve(path.dirname(f), m[1]))) broken.push(`${path.relative(dir, f)}: ${m[1]}`);
      }
    }
  };
  walk(dir);
  if (broken.length) { console.error('Refusing to publish the backend, unresolved imports:\n  ' + broken.join('\n  ')); process.exit(3); }
}
checkImports(stage);
if (DRY) { console.log(`dry run: backend staged in ${stage}, all relative imports resolve, nothing was committed or pushed`); process.exit(0); }
const backShort = publish(stage, BACK);
await release(root, GAME, GAME_VERSION, gameShort);
await release(stage, BACK, BACKEND_VERSION, backShort);
