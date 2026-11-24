// Production/dev server: Next.js (UI) + REST API + realtime WebSocket, all on one port.
//   npm run dev      -> next dev behind this server (HMR works)
//   npm run build && npm start
import http from 'node:http';
import next from 'next';
import { handleApi, attachWs } from './server/core.mjs';

const dev = !process.argv.includes('--prod');
const port = Number(process.env.PORT) || 3000;
const app = next({ dev, hostname: '0.0.0.0', port });
const handle = app.getRequestHandler();
await app.prepare();
const upgrade = app.getUpgradeHandler();

const server = http.createServer(async (req, res) => {
  if (await handleApi(req, res)) return; // /api/*
  handle(req, res);
});
attachWs(server); // handles /ws
server.on('upgrade', (req, socket, head) => { if (!(req.url || '').startsWith('/ws')) upgrade(req, socket, head); }); // Next dev HMR

server.listen(port, '0.0.0.0', () => console.log(`Reverse Surfers (${dev ? 'dev' : 'production'}) on http://localhost:${port}  - API /api, realtime /ws`));
