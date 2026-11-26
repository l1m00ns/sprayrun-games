# Reverse Surfers - backend

REST API + WebSocket server for Reverse Surfers: accounts, cloud save, server-side economy, ranked (Elo), the arena prototype,
fair play (anti-cheat), support and an AI review panel. Node >= 22.5 (uses the built-in `node:sqlite`), one dependency (`ws`).

```
npm install
cp .env.example .env      # fill in the keys you want (all optional)
npm start                 # http://localhost:4000   (API_PORT / PORT to change)
npm test                  # backend.mjs (REST + ranked + anti-cheat) and duel-net.mjs (duel server)
```

## Environment (`.env`, never commit it)
| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY`, `TOKENHARBOR_API_KEY` | the two AI seats (free models). Without keys everything falls back to deterministic rules |
| `OPENROUTER_MODELS`, `TOKENHARBOR_MODELS` | comma lists, first = preferred, the rest = fallbacks |
| `ADMIN_KEY` | enables `/api/admin/*` (header `X-Admin-Key`) |
| `DATA_DIR`, `PORT`/`API_PORT` | database folder, port |
| `TRUST_PROXY=1` | read the real client IP from `X-Forwarded-For` (set it behind a reverse proxy) |
| `CORS_ORIGIN` | the front-end's address(es), comma separated (`https://my-game.vercel.app`). Restricts both the REST API and `/ws`. Empty = any site |
| `AI_DISABLED=1`, `TEST_NOW`, `DUEL_WARP_MS`, `DUEL_SECONDS` | test switches - never set in production |

## Deploying (Render, Railway, Fly.io, a VPS)
The server is one long-lived Node process (WebSocket + SQLite + timers): use a web service, not serverless (Vercel/Netlify functions cannot host it).
- **Render**: New > Blueprint pointing at this repository (`render.yaml` is included), or a Web Service with build `npm install`, start `node server.mjs`, health check `/health`, Node 24 (`.node-version`). Set `CORS_ORIGIN` to your front-end and `TRUST_PROXY=1`. The free plan sleeps when idle and its disk is erased on every deploy: add a persistent disk and set `DATA_DIR` for real use.
- Open the service URL in a browser: `/` shows a status page, `/api` lists the endpoints, `/api/health` and `/health` return `{"ok":true}`.
- The game's front-end then needs the backend URL: `NEXT_PUBLIC_BACKEND_URL=https://your-service.onrender.com` (see the game repository's README).

## What it does
- **Accounts** - username + password (scrypt), guest -> account upgrade, token revocation, brute-force throttling, cloud save with versioning.
- **Economy** - wallet, inventory, shop prices, advent calendar (UTC), XP/levels, achievements; coins only come from validated runs (daily cap).
- **Fair play** - signed single-use run tickets, physical plausibility (speed curve, score formula, coin density, input rate), live telemetry,
  hard vs soft flags, strikes -> kick -> ban with stored evidence. It is plausibility checking, not a deterministic replay: say so honestly.
- **Duel** - authoritative health/ammo/hits, per-move validation with the same rules as the client (`src/arena.js`), lag compensation, kick on wall-walking / speed / fire-rate hacks.
- **AI panel** - two seats (OpenRouter + Token Harbor) judge independently, cross-review on disagreement, arbiter on a tie; zero tokens when the rules are decisive.
- **Support** - tickets + chat answered by the assistant, escalated to humans, appeals.

Shared rule files (`src/consts.js`, `src/arena.js`) are copied from the game repository (`sprayrun-games`); keep them in sync.
