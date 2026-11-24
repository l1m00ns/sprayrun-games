// Tiny WebSocket client for Reverse Surfers multiplayer.
export class Net {
  constructor() {
    this.ws = null;
    this.id = null;
    this.handlers = new Map();
    this.connected = false;
  }
  on(type, fn) { this.handlers.set(type, fn); return this; }

  connect(url) {
    return new Promise((resolve, reject) => {
      this.close();
      let ws;
      try { ws = new WebSocket(url); } catch (e) { reject(e); return; }
      this.ws = ws;
      const timer = setTimeout(() => { try { ws.close(); } catch (e) { /* noop */ } reject(new Error('Connection timed out')); }, 6000);
      ws.onopen = () => { clearTimeout(timer); this.connected = true; resolve(); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('Could not reach the server')); };
      ws.onclose = () => { this.connected = false; const h = this.handlers.get('close'); if (h) h(); };
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'hello') this.id = m.id;
        const h = this.handlers.get(m.t);
        if (h) h(m);
      };
    });
  }

  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  close() { if (this.ws) { try { this.ws.close(); } catch (e) { /* noop */ } } this.ws = null; this.connected = false; }
}
