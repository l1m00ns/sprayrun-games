// Runtime configuration, read by the game before it starts. Edit this file on your host to change the backend
// WITHOUT rebuilding the front-end. Leave both values empty to use the server that serves this page (the default).
//   backendUrl: 'https://your-service.onrender.com'      REST API (the WebSocket address is derived: https -> wss, + /ws)
//   wsUrl:      ''                                        only if the WebSocket lives somewhere else
// This file overrides NEXT_PUBLIC_BACKEND_URL / NEXT_PUBLIC_WS_URL.
window.__RS_CONFIG__ = { backendUrl: '', wsUrl: '' };
