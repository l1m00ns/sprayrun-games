// `npm run dev:all` : starts the backend (API + WebSocket) AND the Next.js web app together.
//   backend -> http://localhost:4000      web -> http://localhost:3000
// The web app is told where the backend lives through NEXT_PUBLIC_BACKEND.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_PORT = process.env.API_PORT || '4000';
const WEB_PORT = process.env.WEB_PORT || '3000';
const env = { ...process.env, API_PORT, NEXT_PUBLIC_BACKEND: `http://localhost:${API_PORT}` };

const procs = [];
function run(name, color, cmd, args) {
  const p = spawn(cmd, args, { cwd: root, env, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (s, out) => s.on('data', (d) => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) out.write(tag + l + '\n'); });
  pipe(p.stdout, process.stdout); pipe(p.stderr, process.stderr);
  p.on('exit', (code) => { console.log(`${tag}stopped (${code})`); stopAll(code || 0); });
  procs.push(p);
  return p;
}
let stopping = false;
function stopAll(code = 0) {
  if (stopping) return; stopping = true;
  for (const p of procs) {
    try { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(p.pid), '/t', '/f'], { stdio: 'ignore' }); else p.kill('SIGTERM'); } catch { /* already gone */ }
  }
  setTimeout(() => process.exit(code), 400);
}
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

console.log(`\n  REVERSE SURFERS - dev\n  web      http://localhost:${WEB_PORT}\n  backend  http://localhost:${API_PORT}\n`);
run('api', '36', 'node', ['server/standalone.mjs']);
run('web', '35', 'npx', ['next', 'dev', '-p', WEB_PORT]);
