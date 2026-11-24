// Probe both AI providers: does the key work, which model answers, latency, tokens, valid JSON?
//   node tools/ai-probe.mjs
import '../server/env.mjs';

const probes = [
  { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions', key: process.env.OPENROUTER_API_KEY,
    models: (process.env.OPENROUTER_MODELS || 'nvidia/nemotron-3-ultra-550b-a55b:free,nvidia/nemotron-3.5-super-vl:free,particle-ai/particle-1:free,openrouter/free').split(',') },
  { name: 'TokenHarbor', url: 'https://tokenharbor.ai/v1/chat/completions', key: process.env.TOKENHARBOR_API_KEY,
    models: (process.env.TOKENHARBOR_MODELS || 'deepseek-v4.1-flash:free,mimo-v2.6-flash:free').split(',') },
];
const system = 'You are a fair-play analyst. Reply with ONLY a JSON object: {"verdict":"legit|suspicious|cheating","confidence":"low|medium|high","reason":"short"}.';
const user = 'Evidence: distance 2140 m after 38 s (physical ceiling 790 m), no input events, score 99999.';

for (const p of probes) {
  console.log(`\n== ${p.name} ${p.key ? '(key set)' : '(NO KEY)'}`);
  if (!p.key) continue;
  for (const model of p.models) {
    const t0 = Date.now();
    try {
      const r = await fetch(p.url, {
        method: 'POST', headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0, max_tokens: 600, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], ...(p.name === 'OpenRouter' ? { reasoning: { effort: 'low' } } : {}) }),
        signal: AbortSignal.timeout(60000),
      });
      const j = await r.json().catch(() => ({}));
      const msg = j.choices && j.choices[0] && j.choices[0].message;
      const txt = msg ? String(msg.content || '').trim() : '';
      console.log(`${model.padEnd(46)} HTTP ${r.status}  ${Date.now() - t0} ms  tokens=${j.usage ? j.usage.total_tokens + ` (out ${j.usage.completion_tokens})` : '?'}  served_by=${j.model || '?'}`);
      console.log('   ->', (txt || JSON.stringify(j.error || j).slice(0, 220)).replace(/\s+/g, ' ').slice(0, 220));
    } catch (e) { console.log(`${model.padEnd(46)} ERROR ${e.message}`); }
  }
}
