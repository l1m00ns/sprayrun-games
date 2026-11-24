// Backend only (REST /api + realtime /ws), no web UI. Used by `npm run dev:all` next to `next dev`.
//   PORT (default 4000)   DATA_DIR   ANTHROPIC_API_KEY (optional: AI support + judge)
import http from 'node:http';
import { handleApi, attachWs } from './core.mjs';

const port = Number(process.env.API_PORT || process.env.PORT) || 4000;
const server = http.createServer(async (req, res) => {
  if (await handleApi(req, res)) return;
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end('{"error":"not_found"}');
});
attachWs(server);
server.listen(port, '0.0.0.0', () => console.log(`Reverse Surfers backend on http://localhost:${port}  (API /api, realtime /ws)`));
