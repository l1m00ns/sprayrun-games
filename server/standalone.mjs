// Backend only (REST /api + realtime /ws), no web UI. Used by `npm run dev:all` next to `next dev`.
//   PORT / API_PORT (default 4000)   DATA_DIR   OPENROUTER_API_KEY, TOKENHARBOR_API_KEY (optional: AI support + judge)
import http from 'node:http';
import { handleApi, attachWs } from './core.mjs';

// The full-stack server (server.mjs) runs inside Next.js, which already logs and survives stray errors. A standalone
// backend has no such net, so one unexpected error in a timer or socket handler would stop every match: log it instead.
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e && e.stack ? e.stack : e));
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e && e.stack ? e.stack : e));

const port = Number(process.env.API_PORT || process.env.PORT) || 4000;
const server = http.createServer(async (req, res) => {
  if (await handleApi(req, res)) return;
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end('{"error":"not_found"}');
});
attachWs(server);
server.listen(port, '0.0.0.0', () => console.log(`Reverse Surfers backend on http://localhost:${port}  (API /api, realtime /ws)`));
