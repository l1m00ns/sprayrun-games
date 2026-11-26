// Admin dashboard served at /analytics and /analytics.html on the backend. The HTML itself is public (no data,
// no key); every number comes from /api/analytics/summary with the ADMIN_KEY in an X-Admin-Key header.
// No framework, no external asset, no cookie: the key lives in sessionStorage only.
export function analyticsPage() {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Reverse Surfers - Analytics</title>
<style>
:root{--bg:#0b0f18;--panel:#121a2c;--panel2:#0e1524;--line:rgba(255,255,255,.1);--ink:#eef2fa;--dim:#8b95a8;--yellow:#ffd23f;--green:#42e07a;--red:#ff5d72;--blue:#42a5ff}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--yellow)}button{font:inherit;cursor:pointer}
header{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:14px 22px;background:rgba(11,15,24,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.6px}.brand b{color:var(--yellow);font-weight:800}
.dot{width:9px;height:9px;border-radius:50%;background:var(--green);box-shadow:0 0 12px var(--green)}
.controls{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.periods{display:flex;gap:4px;padding:3px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)}
.periods button{border:0;background:transparent;color:var(--dim);padding:5px 11px;border-radius:7px;font-weight:700;font-size:12px}
.periods button.sel{background:var(--yellow);color:#2b2100}
.btn{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:9px;padding:7px 13px;font-weight:700}
.btn:hover{border-color:rgba(255,255,255,.32)}
#stamp{color:var(--dim);font-size:12px;min-width:120px;text-align:right}
main{max-width:1240px;margin:0 auto;padding:20px 18px 70px}
.grid{display:grid;gap:12px}.kpis{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.kpi{padding:13px 15px;border:1px solid var(--line);border-radius:14px;background:linear-gradient(180deg,var(--panel),var(--panel2))}
.kpi small{display:block;color:var(--dim);font-weight:700;font-size:11px;letter-spacing:.8px;text-transform:uppercase}
.kpi b{display:block;margin-top:3px;font-size:27px;line-height:1.1;font-variant-numeric:tabular-nums}
.kpi span{color:var(--dim);font-size:12px;font-weight:600}
.panel{margin-top:14px;padding:15px 16px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,var(--panel),var(--panel2))}
.panel h2{margin:0 0 10px;font-size:13px;letter-spacing:1.2px;text-transform:uppercase;color:var(--dim)}
.two{display:grid;grid-template-columns:1.55fr 1fr;gap:12px}@media(max-width:900px){.two{grid-template-columns:1fr}}
.three{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}@media(max-width:900px){.three{grid-template-columns:1fr}}
svg{display:block;width:100%;height:auto;overflow:visible}
.legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:var(--dim);font-weight:700}
.legend i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px;vertical-align:0}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.06)}
th{color:var(--dim);font-size:11px;letter-spacing:.6px;text-transform:uppercase}td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:0}.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px}
.pill{display:inline-block;padding:1px 7px;border-radius:99px;border:1px solid var(--line);color:var(--dim);font-size:11px;font-weight:700}
.good{color:var(--green)}.bad{color:var(--red)}.muted{color:var(--dim)}
.login{max-width:390px;margin:12vh auto 0;padding:22px;border:1px solid var(--line);border-radius:18px;background:var(--panel)}
.login h1{margin:0 0 4px;font-size:24px}.login p{margin:0 0 14px;color:var(--dim)}
.login input{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--line);background:#0a0f1a;color:var(--ink);font:inherit}
.login .btn{width:100%;margin-top:10px;background:var(--yellow);color:#2b2100;border-color:var(--yellow)}
.err{min-height:18px;margin-top:8px;color:var(--red);font-weight:700;font-size:12px}
.hidden{display:none!important}.scroll{max-height:330px;overflow:auto}
.hint{color:var(--dim);font-size:12px;margin-top:8px}
@media(max-width:640px){header{padding:11px 13px}.controls{margin-left:0;width:100%}#stamp{text-align:left;min-width:0}main{padding:12px 10px 50px}.kpi b{font-size:23px}}
</style>
</head><body>
<header>
  <div class="brand"><span class="dot"></span>REVERSE SURFERS <b>ANALYTICS</b></div>
  <div class="controls">
    <div class="periods" id="periods"></div>
    <button class="btn" id="refresh">REFRESH</button>
    <span id="stamp">not loaded</span>
  </div>
</header>
<main>
  <section id="login" class="login hidden">
    <h1>Admin access</h1>
    <p>Enter the backend's <b>ADMIN_KEY</b>. It stays in this tab only.</p>
    <form id="loginForm"><input id="key" type="password" autocomplete="current-password" placeholder="ADMIN_KEY" /><button class="btn" type="submit">OPEN DASHBOARD</button></form>
    <div class="err" id="loginErr"></div>
    <p class="hint">Set ADMIN_KEY on the hosting platform (Render/Fly/Railway environment variables). Without it this dashboard returns nothing.</p>
  </section>
  <section id="dash" class="hidden">
    <div class="grid kpis" id="kpis"></div>
    <div class="panel"><h2>Growth, activation and funnel</h2><div id="growth"></div></div>
    <div class="two">
      <div class="panel"><h2>Sessions, players and runs per day</h2><div id="chart"></div><div class="legend" id="chartLegend"></div></div>
      <div class="panel"><h2>Online now</h2><div id="live"></div><h2 style="margin-top:14px">Last 24 hours</h2><div id="hourly"></div></div>
    </div>
    <div class="three">
      <div class="panel"><h2>Retention</h2><div id="retention"></div></div>
      <div class="panel"><h2>Performance</h2><div id="perf"></div></div>
      <div class="panel"><h2>Devices and languages</h2><div id="devices"></div></div>
    </div>
    <div class="three">
      <div class="panel"><h2>Top maps</h2><div id="maps"></div></div>
      <div class="panel"><h2>Top modes</h2><div id="modes"></div></div>
      <div class="panel"><h2>Traffic sources</h2><div id="refs"></div></div>
    </div>
    <div class="panel"><h2>Recent sessions (IP retained for 30 days)</h2><div class="scroll" id="sessions"></div></div>
    <div class="panel"><h2>Recent events</h2><div class="scroll" id="events"></div></div>
  </section>
</main>
<script>
(function(){
  var $=function(s){return document.querySelector(s)};
  var KEY='rs.analytics.key', days=14, timer=null, busy=false;
  var stored=''; try{stored=sessionStorage.getItem(KEY)||''}catch(e){}
  var fromUrl=new URLSearchParams(location.search).get('key')||'';
  var key=stored||fromUrl;
  if(fromUrl){try{sessionStorage.setItem(KEY,fromUrl)}catch(e){}; try{history.replaceState(null,'','/analytics')}catch(e){}}
  var fmt=function(n){n=Number(n)||0;return n.toLocaleString('en-US')};
  var dur=function(s){s=Math.round(Number(s)||0);var m=Math.floor(s/60);return m?m+'m '+(s%60)+'s':s+'s'};
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var ago=function(t){if(!t)return 'never';var s=Math.round((Date.now()-t)/1000);if(s<60)return s+'s ago';if(s<3600)return Math.round(s/60)+'m ago';if(s<86400)return Math.round(s/3600)+'h ago';return Math.round(s/86400)+'d ago'};
  function showLogin(msg){$('#login').classList.remove('hidden');$('#dash').classList.add('hidden');$('#loginErr').textContent=msg||'';setTimeout(function(){var i=$('#key');if(i)i.focus()},30)}
  function periodBtn(n){var b=document.createElement('button');b.type='button';b.textContent=n+'d';b.className=n===days?'sel':'';b.onclick=function(){days=n;drawPeriods();load()};return b}
  function drawPeriods(){var p=$('#periods');p.innerHTML='';[7,14,30,90].forEach(function(n){p.appendChild(periodBtn(n))})}
  function kpi(label,value,sub){return '<div class="kpi"><small>'+label+'</small><b>'+value+'</b><span>'+sub+'</span></div>'}
  function table(cols,rows,empty){
    if(!rows||!rows.length)return '<div class="muted">'+esc(empty||'No data yet')+'</div>';
    var h='<table><thead><tr>'+cols.map(function(c){return '<th'+(c.num?' class="num"':'')+'>'+esc(c.label)+'</th>'}).join('')+'</tr></thead><tbody>';
    rows.forEach(function(r){h+='<tr>'+cols.map(function(c){return '<td'+(c.num?' class="num"':'')+'>'+(c.html?c.html(r):esc(c.get?c.get(r):r[c.k]))+'</td>'}).join('')+'</tr>'});
    return h+'</tbody></table>';
  }
  function bars(rows){
    var w=360,h=150,pad=18,n=Math.max(1,rows.length),max=Math.max(1,Math.max.apply(null,rows.map(function(r){return r.n||0})));
    var bw=(w-pad*2)/n, out='<svg viewBox="0 0 '+w+' '+h+'" role="img">';
    for(var g=1;g<4;g++){var y=h-pad-(h-pad*2)*g/3;out+='<line x1="'+pad+'" x2="'+(w-pad)+'" y1="'+y+'" y2="'+y+'" stroke="rgba(255,255,255,.07)"/>'}
    rows.forEach(function(r,i){var bh=(h-pad*2)*(r.n||0)/max;out+='<rect x="'+(pad+i*bw+bw*.18)+'" y="'+(h-pad-bh)+'" width="'+(bw*.64)+'" height="'+Math.max(0,bh)+'" rx="3" fill="'+(r.color||'#ffd23f')+'"><title>'+esc(r.k||r.h)+': '+fmt(r.n)+'</title></rect>'});
    return out+'</svg>'
  }
  function chart(rows){
    var w=760,h=230,pad=34,n=rows.length,max=Math.max(1,Math.max.apply(null,rows.map(function(r){return Math.max(r.sessions,r.players,r.runs)})));
    var xs=function(i){return pad+(w-pad*2)*(n<2?.5:i/(n-1))};
    var ys=function(v){return h-pad-(h-pad*2)*(v/max)};
    var line=function(k){return rows.map(function(r,i){return (i?'L':'M')+xs(i).toFixed(1)+' '+ys(r[k]).toFixed(1)}).join(' ')};
    var out='<svg viewBox="0 0 '+w+' '+h+'" role="img">';
    for(var g=0;g<=3;g++){var y=h-pad-(h-pad*2)*g/3;out+='<line x1="'+pad+'" x2="'+(w-pad)+'" y1="'+y+'" y2="'+y+'" stroke="rgba(255,255,255,.07)"/>';out+='<text x="'+(pad-7)+'" y="'+(y+4)+'" fill="#8b95a8" font-size="10" text-anchor="end">'+Math.round(max*g/3)+'</text>'}
    var colors={sessions:'#ffd23f',players:'#42a5ff',runs:'#42e07a'};
    ['sessions','players','runs'].forEach(function(k){out+='<path d="'+line(k)+'" fill="none" stroke="'+colors[k]+'" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>';rows.forEach(function(r,i){out+='<circle cx="'+xs(i)+'" cy="'+ys(r[k])+'" r="2.5" fill="'+colors[k]+'"><title>'+r.day+' '+k+': '+fmt(r[k])+'</title></circle>'})});
    if(n){out+='<text x="'+pad+'" y="'+(h-8)+'" fill="#8b95a8" font-size="10">'+rows[0].day+'</text>';out+='<text x="'+(w-pad)+'" y="'+(h-8)+'" fill="#8b95a8" font-size="10" text-anchor="end">'+rows[n-1].day+'</text>'}
    return out+'</svg>'
  }
  function render(d){
    $('#login').classList.add('hidden');$('#dash').classList.remove('hidden');
    var t=d.totals;
    $('#kpis').innerHTML=
      kpi('Live now',fmt(d.online),'WebSocket clients')+
      kpi('Sessions',fmt(t.sessions),t.newSessions+' new')+
      kpi('Players',fmt(t.players),'active in '+d.days+'d')+
      kpi('Runs',fmt(t.runs),fmt(t.matches)+' matches')+
      kpi('Avg session',dur(t.avgSession),t.bounce+'% bounce')+
      kpi('Events',fmt(t.events),d.days+' days');
    var g=d.growth||{};
    $('#growth').innerHTML='<div class="grid kpis">'+
      kpi('DAU',fmt(g.dau),'today, unique runners')+
      kpi('WAU',fmt(g.wau),'last 7 days')+
      kpi('Runs / player',g.runsPerPlayer,'in the period')+
      kpi('Run completion',(g.completion||0)+'%','start -> finish')+
      kpi('Tutorial',(g.tutorial||0)+'%','of visits')+
      kpi('Shop conversion',(g.shop||0)+'%','view -> purchase')+
      kpi('Match rate',(g.queue||0)+'%','queue -> match')+
      '</div>'+bars((g.funnel||[]).map(function(f){return {k:f.k,n:f.n,color:'#ff5cb8'}}))+
      table([{label:'Step',k:'k'},{label:'Events',k:'n',num:true},{label:'Players',num:true,get:function(r){return fmt(r.players)}}],g.funnel||[],'No funnel events yet.');
    $('#chart').innerHTML=chart(d.daily);
    $('#chartLegend').innerHTML='<span><i style="background:#ffd23f"></i>sessions</span><span><i style="background:#42a5ff"></i>players</span><span><i style="background:#42e07a"></i>runs</span>';
    $('#live').innerHTML='<div style="font-size:34px;font-weight:800">'+fmt(d.online)+' <span class="pill">online</span></div><div class="muted">last event '+ago(d.lastEventAt)+'</div><div class="muted">generated '+new Date(d.generatedAt).toLocaleTimeString()+'</div>';
    $('#hourly').innerHTML=bars(d.hourly.map(function(h){return {k:('0'+h.h).slice(-2)+':00',n:h.n,color:'#42a5ff'}}));
    $('#retention').innerHTML='<div class="grid kpis"><div class="kpi"><small>Day 1</small><b>'+(d.retention.d1||0)+'%</b><span>come back tomorrow</span></div><div class="kpi"><small>Day 7</small><b>'+(d.retention.d7||0)+'%</b><span>within a week</span></div></div>'+
      table([{label:'Day',k:'day'},{label:'Players',k:'base',num:true},{label:'D1',num:true,get:function(r){return r.d1+'%'}},{label:'D7',num:true,get:function(r){return r.d7+'%'}}],d.retention.days.slice(-8).reverse(),'Retention needs a few days of data.');
    var p=d.perf.overall;
    $('#perf').innerHTML='<div class="grid kpis"><div class="kpi"><small>Avg FPS</small><b>'+p.fps+'</b><span>'+fmt(p.n)+' samples</span></div><div class="kpi"><small>1% low</small><b>'+p.low1+'</b><span>'+p.ms+' ms avg</span></div></div>'+
      table([{label:'Preset',k:'preset'},{label:'Samples',k:'n',num:true},{label:'FPS',k:'fps',num:true},{label:'1% low',k:'low1',num:true}],d.perf.presets,'No performance samples yet.');
    $('#devices').innerHTML=table([{label:'Device',k:'k'},{label:'Sessions',k:'n',num:true}],d.devices,'No sessions yet.')+'<div style="height:8px"></div>'+table([{label:'Language',k:'k'},{label:'Sessions',k:'n',num:true}],d.langs,'');
    $('#maps').innerHTML=table([{label:'Map',k:'k'},{label:'Runs',k:'n',num:true}],d.maps,'No runs yet.');
    $('#modes').innerHTML=table([{label:'Mode',k:'k'},{label:'Runs',k:'n',num:true}],d.modes,'No runs yet.');
    $('#refs').innerHTML=table([{label:'Source',k:'k'},{label:'Sessions',k:'n',num:true}],d.refs,'Direct traffic only.');
    $('#sessions').innerHTML=table([{label:'Session',k:'sid'},{label:'IP',k:'ip'},{label:'Device',k:'device'},{label:'Lang',k:'lang'},{label:'Beats',k:'beats',num:true},{label:'Last seen',get:function(r){return ago(r.last)}}],d.sessions,'No sessions recorded yet.');
    $('#events').innerHTML=table([{label:'When',get:function(r){return ago(r.at)}},{label:'Event',k:'name'},{label:'Map / mode',get:function(r){return [r.map,r.mode,r.quality].filter(Boolean).join(' / ')}},{label:'Meta',html:function(r){return r.meta?'<span class="mono">'+esc(JSON.stringify(r.meta).slice(0,150))+'</span>':''}}],d.recent,'No events yet.');
    $('#stamp').textContent='updated '+new Date(d.generatedAt).toLocaleTimeString();
  }
  function load(){
    if(!key){showLogin();return}
    if(busy)return;busy=true;$('#refresh').disabled=true;
    fetch('/api/analytics/summary?days='+days,{headers:{'X-Admin-Key':key,'Accept':'application/json'},cache:'no-store'})
      .then(function(r){if(r.status===403){try{sessionStorage.removeItem(KEY)}catch(e){};key='';throw new Error('forbidden')}if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
      .then(function(d){render(d)})
      .catch(function(e){if(e.message==='forbidden')showLogin('That key was refused.');else $('#stamp').textContent='load failed ('+e.message+')'})
      .then(function(){busy=false;$('#refresh').disabled=false});
  }
  $('#loginForm').addEventListener('submit',function(e){e.preventDefault();var v=$('#key').value.trim();if(!v)return;key=v;$('#loginErr').textContent='';load()});
  $('#refresh').onclick=function(){load()};
  drawPeriods();
  if(key)load();else showLogin();
  timer=setInterval(function(){if(key&&!document.hidden)load()},30000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&key)load()});
})();
</script>
</body></html>`;
}
