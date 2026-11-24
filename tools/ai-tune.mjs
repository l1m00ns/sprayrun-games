// Find the cheapest reliable request settings per model (reasoning models can burn the whole token budget thinking).
//   node tools/ai-tune.mjs
import '../server/env.mjs';
import { JUDGE_SYSTEM, checkJudge } from '../server/prompts.mjs';

const user = `<evidence>
kind=run flags(!=hard)=!score_exceeds_formula,input_gap_inhuman,coin_density
run: score=61200 dist=3100 coins=980 time=142 mode=classic stats: jumps=190 rolls=120 lanes=400 boards=1 input: n=740 fast=96
account: ageDays=2 games=0 strikes=0
physical: maxDist=5400 maxScore=59000
</evidence>
Judge this event.`;

const OR = 'https://openrouter.ai/api/v1/chat/completions', TH = 'https://tokenharbor.ai/v1/chat/completions';
const cases = [
  ['OR', OR, process.env.OPENROUTER_API_KEY, 'nvidia/nemotron-3-ultra-550b-a55b:free', [{ reasoning: { effort: 'low' } }, { reasoning: { enabled: false } }, { reasoning: { effort: 'low', exclude: true }, max_tokens: 1400 }]],
  ['OR', OR, process.env.OPENROUTER_API_KEY, 'nvidia/nemotron-3.5-super-vl:free', [{ reasoning: { effort: 'low' } }, { reasoning: { enabled: false } }]],
  ['TH', TH, process.env.TOKENHARBOR_API_KEY, 'deepseek-v4.1-flash:free', [{}, { reasoning_effort: 'low' }, { thinking: { type: 'disabled' } }, { reasoning: { enabled: false } }]],
  ['TH', TH, process.env.TOKENHARBOR_API_KEY, 'mimo-v2.6-flash:free', [{}, { reasoning_effort: 'low' }, { thinking: { type: 'disabled' } }, { reasoning: { enabled: false } }]],
];
for (const [tag, url, key, model, variants] of cases) {
  for (const v of variants) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(90000),
        body: JSON.stringify({ model, temperature: 0, max_tokens: 1500, messages: [{ role: 'system', content: JUDGE_SYSTEM }, { role: 'user', content: user }], ...v }) });
      const j = await r.json().catch(() => ({}));
      const c = j.choices && j.choices[0];
      const txt = c && c.message && c.message.content || '';
      const m = txt.indexOf('{'), e = txt.lastIndexOf('}');
      let ok = false; try { ok = !!checkJudge(JSON.parse(txt.slice(m, e + 1))); } catch { /* not json */ }
      const u = j.usage || {};
      console.log(`${tag} ${model.padEnd(40)} ${JSON.stringify(v).padEnd(58)} HTTP ${r.status} ${String(Date.now() - t0).padStart(6)}ms prompt=${u.prompt_tokens} out=${u.completion_tokens} reasoning=${(u.completion_tokens_details || {}).reasoning_tokens ?? '?'} finish=${c && c.finish_reason} json=${ok}`);
    } catch (err) { console.log(`${tag} ${model} ${JSON.stringify(v)} ERROR ${err.message}`); }
  }
}
process.exit(0);
