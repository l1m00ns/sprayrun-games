// Backend version. The full version is `${BACKEND_VERSION}-${commit}` (commit = the deployed git commit, short).
import { execFileSync } from 'node:child_process';
export const BACKEND_VERSION = '3.0.1';
function commit() {
  const e = process.env;
  const sha = e.RENDER_GIT_COMMIT || e.RAILWAY_GIT_COMMIT_SHA || e.VERCEL_GIT_COMMIT_SHA || e.GIT_COMMIT || e.SOURCE_VERSION;
  if (sha) return String(sha).slice(0, 7);
  try { return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 1500 }).toString().trim() || 'local'; } catch { return 'local'; }
}
export const BACKEND_COMMIT = commit();
export const BACKEND_FULL_VERSION = `${BACKEND_VERSION}-${BACKEND_COMMIT}`;
