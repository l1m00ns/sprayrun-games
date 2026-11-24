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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER || 'l1m00ns';
const GAME = process.env.GAME_REPO || 'sprayrun-games', BACK = process.env.BACKEND_REPO || 'sprayrun-backends';
const message = process.argv[2] || 'Update Reverse Surfers';
if (!TOKEN) { console.error('Set GITHUB_TOKEN in the environment.'); process.exit(1); }

const scrub = (s) => String(s).split(TOKEN).join('***');
function git(cwd, args, { allowFail = false } = {}) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (e) { if (allowFail) return ''; throw new Error(scrub(`git ${args[0]} failed: ${e.stderr || e.message}`).slice(0, 600)); }
}

// ---- secret scan: refuse to commit anything that looks like a credential
const PATTERNS = [/sk-or-v1-[a-f0-9]{24,}/, /thk_live_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{30,}/, /ghp_[A-Za-z0-9]{30,}/, /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, /sk-ant-[A-Za-z0-9_-]{20,}/];
function scan(dir) {
  const bad = [];
  for (const f of git(dir, ['ls-files', '--cached', '--others', '--exclude-standard']).split('\n').filter(Boolean)) {
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
}

// ---- 1. the whole game
publish(root, GAME);

// ---- 2. the backend, staged in its own folder (server/ + the two shared rule files + tests)
const stage = path.join(os.tmpdir(), 'rs-backend-stage');
fs.mkdirSync(stage, { recursive: true });
for (const e of fs.readdirSync(stage)) if (e !== '.git') fs.rmSync(path.join(stage, e), { recursive: true, force: true });
const copy = (from, to = from) => { const dst = path.join(stage, to); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.cpSync(path.join(root, from), dst, { recursive: true }); };
for (const f of fs.readdirSync(path.join(root, 'server'))) if (f.endsWith('.mjs') && f !== 'standalone.mjs') copy(`server/${f}`);
copy('server/standalone.mjs', 'server.mjs'); // the backend's own entry point
copy('src/consts.js'); copy('src/arena.js'); // movement / speed rules shared with the client (the server validates with them)
for (const t of ['backend.mjs', 'duel-net.mjs', 'ai-probe.mjs', 'ai-panel.mjs', 'ai-tune.mjs']) if (fs.existsSync(path.join(root, 'tools', t))) copy(`tools/${t}`);
copy('.env.example');
fs.writeFileSync(path.join(stage, '.gitignore'), 'node_modules\ndata\n.env\n*.log\n');
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
  name: 'sprayrun-backends', version: '2.0.0', private: true, type: 'module', description: 'Reverse Surfers backend: accounts, economy, ranked, duels, anti-cheat, AI review',
  engines: { node: '>=22.5' }, scripts: { start: 'node server.mjs', test: 'node tools/backend.mjs && node tools/duel-net.mjs' }, dependencies: { ws: '^8.23.0' },
}, null, 2) + '\n');
fs.writeFileSync(path.join(stage, 'README.md'), fs.readFileSync(path.join(root, 'server', 'README.md'), 'utf8'));
publish(stage, BACK);
