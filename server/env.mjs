// Loads the project's .env (server secrets) once. Import this first.
// The project .env WINS over variables inherited from the machine (a stale global OPENROUTER_API_KEY must not shadow it).
// On a real host without a .env file nothing changes: ordinary environment variables are used.
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of [path.join(root, '.env'), path.join(process.cwd(), '.env')]) {
  try {
    if (!fs.existsSync(f)) continue;
    for (const [k, v] of Object.entries(parseEnv(fs.readFileSync(f, 'utf8')))) if (v !== '') process.env[k] = v;
    break;
  } catch { /* unreadable .env: fall back to the real environment */ }
}
