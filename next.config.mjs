import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const root = path.dirname(fileURLToPath(import.meta.url));

// Game version = 1.3.1-<commit>: the commit comes from the host (Vercel / Render) or from git; "dev" when neither exists.
const base = (/GAME_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'src', 'version.js'), 'utf8')) || [])[1] || '0.0.0';
let sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || '';
if (!sha) { try { sha = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }).toString().trim(); } catch { sha = ''; } }
const NEXT_PUBLIC_VERSION = `${base}-${sha ? sha.slice(0, 7) : 'dev'}`;

/** @type {import('next').NextConfig} */
export default {
  env: { NEXT_PUBLIC_VERSION },
  reactStrictMode: false, // the engine boots once on mount; double-invoked effects would be pointless
  turbopack: { root },
  poweredByHeader: false,
};
