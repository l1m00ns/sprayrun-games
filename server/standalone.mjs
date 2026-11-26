// Backend only (REST /api + realtime /ws), no web UI. Used by `npm run dev:all` next to `next dev`.
//   PORT / API_PORT (default 4000)   DATA_DIR   OPENROUTER_API_KEY, TOKENHARBOR_API_KEY (optional: AI support + judge)
import http from 'node:http';
import { handleApi, attachWs, wsClients } from './core.mjs';
import { landing, notFound } from './landing.mjs';
import { hardenServer, installShutdown, log } from './ops.mjs';

// The full-stack server (server.mjs) runs inside Next.js, which already logs and survives stray errors. A standalone
// backend has no such net, so one unexpected error in a timer or socket handler would stop every match: log it instead.
process.on('uncaughtException', (e) => log('error', 'uncaughtException', { err: String(e && e.stack ? e.stack : e).slice(0, 1200) }));
process.on('unhandledRejection', (e) => log('error', 'unhandledRejection', { err: String(e && e.stack ? e.stack : e).slice(0, 1200) }));

const port = Number(process.env.API_PORT || process.env.PORT) || 4000;
const server = http.createServer(async (req, res) => {
  if (await handleApi(req, res)) return;
  if (landing(req, res)) return; // "/", "/health", "/api" (info page) instead of a bare 404
  notFound(req, res);
});
hardenServer(server);
attachWs(server);
installShutdown(server, wsClients); // SIGTERM (deploys, restarts): tell players, flush the database, exit
server.listen(port, '0.0.0.0', () => console.log(`Reverse Surfers backend on http://localhost:${port}  (API /api, realtime /ws)`));
