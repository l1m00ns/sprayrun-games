import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GradeShader } from './post.js';
import * as C from './consts.js';
import { clamp, damp, lerp, rand, fmt, easeInOut, easeOutCubic } from './util.js';
import { save, persist, resetSave, setPersistHook } from './save.js';
import { initHub } from './hub.js';
import { dressed } from './cosmetics.js';
import { boardSVG } from './icons.js';
import { initSocial } from './social.js';
import { GAME_FULL_VERSION } from './version.js';
import { fillIcons } from './iconsax.js';
import { createDuel } from './duel.js';
import { setLang, getLang, detectLang, flagUrl } from './i18n.js';
import { createOnboarding, openLanguagePicker } from './onboarding.js';
import { cheats, GROUPS as CHEAT_GROUPS, tainted, activeCount, groupActive, konamiListener, renderGroup as renderCheatGroup, unlocked as secretUnlocked, setUnlocked as setSecretUnlocked, resetAll as resetCheats } from './secret.js';
import { SCHEMA as SETTINGS, defaults as settingDefaults, renderTab as renderSettingsTab } from './settings.js';
import { Sky, themeAt } from './sky.js';
import { World, initWorldAssets, setNight, tickWorldAssets } from './world.js';
import { OutlinePass } from './outline.js';
import { Weather } from './weather.js';
import { Birds } from './critters.js';
import { presetOf, gpuName, detectTier, AdaptiveRes, FrameStats } from './perf.js';
import { BIOMES, BIOME_ORDER } from './biomes.js';
import { bend, applyBend } from './bend.js';
import { Net } from './net.js';
import * as api from './api.js';
import { loadModels } from './models.js';
import { makeIconTexture } from './textures.js';
const online = api.online;
import { fxLayer } from './materials.js';
import { CHARACTERS, CHAR_SCALE, buildCharacter, buildGuard, buildDog, poseCharacter, animateDog } from './characters.js';
import { FX } from './fx.js';
import * as audio from './audio.js';
import * as missions from './missions.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');

// ------------------------------------------------------------------ renderer
// Anti-aliasing (MSAA) is fixed when the context is created: the Performance preset starts without it.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: (save.settings && save.settings.quality) !== 'low', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const gpuTier = detectTier(gpuName(renderer.getContext()), { mobile: !!(window.matchMedia && matchMedia('(pointer: coarse)').matches), cores: navigator.hardwareConcurrency || 8, memory: navigator.deviceMemory || 8 });
const adapt = new AdaptiveRes({ min: 0.55 });
const frameStats = new FrameStats();
let autoK = 1, pixelExtra = 1; // adaptive-resolution multiplier, cheat-menu multiplier (retro look)
function applyPixelRatio() {
  const s = save.settings, q = presetOf(s.quality);
  renderer.setPixelRatio(Math.max(0.3, Math.min(window.devicePixelRatio || 1, q.prCap) * (s.renderScale || 1) * autoK * pixelExtra));
  resize();
}
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe6f7, 70, 250);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);
camera.layers.enable(1); // layer 1 = effects that the outline pass ignores
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xbfdcff, 0x7a6b5a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d2, 2.6);
sun.position.set(-7, 15, 4);
sun.target.position.set(0, 0, -14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 38, bottom: -34, near: 1, far: 80 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
// soft fill from the opposite side so building faces away from the sun don't go black
const fill = new THREE.DirectionalLight(0xdfe9ff, 1.0);
fill.position.set(9, 7, 5);
fill.target.position.set(-2, 2, -10);
scene.add(fill, fill.target);

// two dynamic point lights (High preset): a warm glow that follows the runner, and the headlight of the nearest oncoming train
const runnerLight = new THREE.PointLight(0xffc98a, 0, 15, 2);
const trainLight = new THREE.PointLight(0xfff2b0, 0, 34, 2);
runnerLight.visible = trainLight.visible = false;
scene.add(runnerLight, trainLight);
let composer = null, bloom = null, outline = null, grade = null, gradeSpeed = 0;
function setupComposer() {
  const w = window.innerWidth, h = window.innerHeight;
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  outline = new OutlinePass(scene, camera, w * pr, h * pr);
  outline.setSize(w * pr, h * pr);
  composer.addPass(outline);
  bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.55, 0.92);
  composer.addPass(bloom);
  grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
}
// Apply one setting (or all of them when key is undefined). Cheap, safe to call any time.
function applySettings(key) {
  const s = save.settings, all = key === undefined, H = document.documentElement;
  if (all || key === 'lang') { setLang(s.lang || detectLang()); const c = $('tbLangCode'); if (c) c.textContent = getLang().toUpperCase(); const fl = $('tbLangFlag'); if (fl) fl.src = flagUrl(getLang()); }
  if (all || key === 'reduceMotion') H.classList.toggle('reduce', !!s.reduceMotion);
  if (all || key === 'highContrast') H.classList.toggle('hc', !!s.highContrast);
  if (all || key === 'colorBlind') H.classList.toggle('cb', !!s.colorBlind);
  if (all || key === 'keyHints') H.classList.toggle('nohints', s.keyHints === false);
  if (all || key === 'showTimer') $('hTime').style.display = s.showTimer === false ? 'none' : '';
  if (all || key === 'uiScale') H.style.setProperty('--ui-scale', String(s.uiScale || 1));
  if (all || key === 'seasonal') hubUI.refreshChrome && hubUI.refreshChrome();
  if (all || key === 'renderScale') applyPixelRatio();
  if (key === 'autoRes' || (all && s.autoRes === false)) { autoK = 1; adapt.reset(); applyPixelRatio(); }
  if (all || key === 'music' || key === 'sfx') audio.setVolumes(s.music, s.sfx);
  if (all || key === 'quality') applyQuality();
  if (all || key === 'outline') applyOutline();
  if (all || key === 'bloom' || key === 'reduceMotion') { if (bloom) bloom.enabled = s.bloom !== false && !s.reduceMotion; }
  if (all || key === 'shadows') { const on = presetOf(s.quality).shadows && s.shadows !== false; renderer.shadowMap.enabled = on; sun.castShadow = on; }
  if (all || key === 'showFps') $('fpsMeter').classList.toggle('hidden', !s.showFps);
}
function applyOutline() { if (outline) outline.enabled = save.settings.outline !== false; }
function applyQuality() {
  const q = presetOf(save.settings.quality);
  const shadowsOn = q.shadows && save.settings.shadows !== false;
  renderer.shadowMap.enabled = shadowsOn;
  sun.castShadow = shadowsOn;
  if (sun.shadow.mapSize.x !== q.shadowRes) { // a new shadow-map size only takes effect once the old target is released
    sun.shadow.mapSize.set(q.shadowRes, q.shadowRes);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  if (q.post && !composer) setupComposer();
  runnerLight.visible = trainLight.visible = !!q.post; // lights change the shader: only on High
  if (fx) fx.setBudget(q.particles);
  if (weather) weather.budget = q.weather;
  if (birds) birds.mesh.visible = q.birds;
  applyOutline();
  autoK = 1; adapt.reset(); applyPixelRatio(); // the preset changes the pixel-ratio cap: start from the full resolution again
  scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); if (outline) outline.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()); }
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------- state
let world, sky, fx, player, guard, dog;
let state = 'loading'; // loading | menu | playing | paused | dying | over
let menuBlend = 1; // 1 = menu camera, 0 = run camera
let time = 0;
let charIndex = Math.max(0, CHARACTERS.findIndex((c) => c.id === save.character));

const P = {
  lane: 1, target: 1, prev: 1, x: 0, y: 0, vy: 0, grounded: true, coyote: 0, vx: 0,
  rollT: 0, rolling: false, rollQueued: false, h: C.PLAYER_H,
  onBoard: false, boardT: 0, inv: 0, bump: 0, stumbleT: 0,
  jetY: 0, ground: 0, groundSmooth: 0, jetting: false, jetLeft: 0, jetCoinT: 0, jumpBuffer: 0,
  laneFrom: 0, laneT: 1, laneDur: 0.27,
};
const pw = { magnet: 0, jetpack: 0, sneakers: 0, mult: 0 };
const pwMax = { magnet: 1, jetpack: 1, sneakers: 1, mult: 1 };
const run = { speed: 0, score: 0, coins: 0, dist: 0, jumps: 0, rolls: 0, powers: 0, lanes: 0, boards: 0, roof: 0, t: 0, dieT: 0, caughtBy: false, distAcc: 0, roofAcc: 0, reported: 0 };
const G = { active: false, t: 0, z: 30, x: 0, dogZ: 30, shown: false, introT: 0 };
let shake = 0;
let flash = 0;
let themeBase = 0;
let curTheme = themeAt(0);
let curBiomeId = 'city';
let weather, birds;
let stormFlash = 0, stormT = 8, thunderT = -1;
// start animation: the runner is caught tagging a wall, the guard whistles, then the sprint begins
const INTRO_T = 2.8, SPRAY_T = 1.25;
const SPRAY_COLORS = ['#ff3d71', '#29e0ff', '#ffd23f', '#7dff6b'];
let introSaid = false, introGo = false, sprayT = 0, introK = 0;
let mapOverride = null; // daily run / multiplayer room forces a map without touching the saved preference
const curMap = () => cheats.forceMap || mapOverride || save.settings.map || 'city';
const menuBiome = () => { const m = curMap(); return m === 'tour' ? 'city' : m; };
const worldMode = () => { const m = curMap(); return m === 'tour' ? ['tour', 'city'] : ['fixed', m]; };
const net = new Net();
const mp = { active: false, running: false, counting: false, players: new Map(), ghosts: new Map(), room: null, seed: 0, sendT: 0, hudT: 0, results: null };
let duelCtl = null, queueDuelRef = null, onboarding = null, social = null, ensureOnlineRef = null;
let botOn = /[?&]bot/.test(location.search);
const botActive = () => botOn || cheats.bot;
const godNow = () => cheats.god || cheats.noclip || (cheats.bot && cheats.botGod);
let lastSpace = -10;
const queue = [];

// -------------------------------------------------------------------- build
function loadFonts() {
  const fonts = ['40px "Lilita One"', '600 20px "Baloo 2"', '800 20px "Baloo 2"'];
  return Promise.all(fonts.map((f) => document.fonts.load(f).catch(() => null))).then(() => document.fonts.ready);
}

function setLoad(p, txt) {
  $('loadBar').style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`;
  $('loadPct').textContent = `${Math.round(p * 100)}%`;
  if (txt) $('loadTxt').textContent = txt;
}
const tick = () => new Promise((r) => setTimeout(r, 16));

function buildPlayer() {
  if (player) scene.remove(player.root);
  player = buildCharacter(dressed(CHARACTERS[charIndex], save.equip && save.equip.outfit));
  scene.add(player.root);
}

const TIPS = ['Double-tap Space to launch your hoverboard.', 'Trains with a flashing triangle are coming at you - switch lanes!', 'Trains are solid walls: change lanes, or fly over them with the Jetpack.',
  'Roll under the striped bars, jump the red barriers.', 'In No Coin mode, every coin is a trap.', 'Ranked matches pair you with runners at your level.', 'Mystery chests hide coins, hoverboards and power-ups.', 'Each map has its own weather and surprises.'];
async function boot() {
  let tipI = Math.floor(Math.random() * TIPS.length);
  const showTip = () => { $('loadTip').textContent = TIPS[tipI++ % TIPS.length]; };
  showTip();
  const tipTimer = setInterval(showTip, 1800);
  setLoad(0.05, 'Loading fonts…');
  await loadFonts();
  await tick();
  setLoad(0.2, 'Painting the walls…');
  await loadModels();
  await tick();
  initWorldAssets();
  setLoad(0.55, 'Laying the tracks…');
  await tick();
  sky = new Sky(scene);
  world = new World(scene);
  fx = new FX(scene);
  weather = new Weather(scene);
  birds = new Birds(scene);
  world.onSmoke = (x, y, z) => fx.smoke.emit(x + rand(-0.1, 0.1), y, z, rand(-0.5, 0.5), rand(1.2, 2.6), rand(0, 1.2), rand(0.9, 1.5), 0.7, 0.7, 0.75, 0);
  world.onTrainMove = () => audio.sfx.horn();
  world.setMode(...worldMode());
  world.reset({ calm: true });
  setLoad(0.75, 'Waking up the crew…');
  await tick();
  buildPlayer();
  guard = buildGuard();
  dog = buildDog();
  dog.root.scale.setScalar(0.82);
  guard.root.visible = false;
  dog.root.visible = false;
  scene.add(guard.root, dog.root);
  if (!save.onboarded) save.settings.quality = gpuTier.tier; // first launch: pick the preset that suits this graphics card (the welcome flow lets the player change it)
  applyQuality();
  resize();
  setLoad(0.95, 'Ready!');
  await tick();
  for (const [k, v] of Object.entries(settingDefaults())) if (k !== 'lang' && save.settings[k] === undefined) save.settings[k] = v; // lang stays unset until the welcome flow (so the browser language can be detected)
  applySettings();
  setupUI();
  missions.ensureMissions();
  enterMenu(true);
  clearInterval(tipTimer);
  $('loading').classList.add('hidden');
  if (!save.onboarded) onboarding.start();
  last = performance.now();
  requestAnimationFrame(frame);
}

// -------------------------------------------------------------------- input
const keysDown = new Set();
const snappy = () => save.settings.controls !== 'classic';
const camDist = () => ({ close: 0.82, normal: 1, far: 1.22 })[save.settings.camera || 'normal'] || 1;
function pushAction(a) {
  queue.push(a);
  if (state === 'playing' && snappy() && !(run.introOn && run.t < INTRO_T)) while (queue.length) doAction(queue.shift()); // apply now, not on the next frame
  const t = performance.now(); // event time, so same-frame processing never looks like a macro
  if (run.in) { run.in.n++; if (run.in.last && t - run.in.last < 20) run.in.fast++; run.in.last = t; }
}

// Browsers only allow audio after a user gesture: unlock on the first one and start the menu music.
function unlockAudio() {
  audio.initAudio();
  audio.resumeAudio();
  if (state === 'menu') audio.startMusic('menu');
}
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });
window.addEventListener('keydown', (e) => {
  if (e.repeat || dlgOpen || state === 'duel') return;
  const tg = e.target && e.target.tagName;
  if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return; // typing in a field: never a game input
  audio.initAudio(); audio.resumeAudio();
  const k = e.key;
  if (state === 'menu') {
    if (hubUI.tab !== 'play') return;
    if (k === 'Enter' || k === ' ') { e.preventDefault(); tryPlay(); }
    else if (k === 'ArrowLeft') changeChar(-1);
    else if (k === 'ArrowRight') changeChar(1);
    else if (k === 'm' || k === 'M') toggleMute();
    return;
  }
  if (state === 'paused' && (k === 'p' || k === 'P' || k === 'Escape' || k === 'Enter')) { resume(); return; }
  if (state === 'playing') {
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') pushAction('left');
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') pushAction('right');
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') pushAction('jump');
    else if (k === 'ArrowDown' || k === 's' || k === 'S') pushAction('roll');
    else if (k === ' ') {
      e.preventDefault();
      const now = performance.now() / 1000;
      if (now - lastSpace < 0.32 && (save.boards > 0 || cheats.infBoards) && !P.onBoard) pushAction('board');
      else pushAction('jump');
      lastSpace = now;
    }
    else if (k === 'b' || k === 'B' || k === 'z' || k === 'Z') pushAction('board');
    else if (k === 'p' || k === 'P' || k === 'Escape') pause();
    else if (k === 'm' || k === 'M') toggleMute();
  }
  keysDown.add(k);
});
window.addEventListener('keyup', (e) => keysDown.delete(e.key));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing' && !mp.running && save.settings.autoPause !== false) pause();
  if (save.settings.muteBlur !== false) audio.setVolumes(document.hidden ? 0 : save.settings.music, document.hidden ? 0 : save.settings.sfx);
});

// swipe (touch & mouse drag)
let sw = null;
canvas.addEventListener('pointerdown', (e) => {
  audio.initAudio(); audio.resumeAudio();
  sw = { x: e.clientX, y: e.clientY, t: performance.now(), done: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!sw || sw.done || state !== 'playing') return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  const T = save.settings.swipe || 34;
  if (Math.abs(dx) > T && Math.abs(dx) > Math.abs(dy)) { pushAction(dx > 0 ? 'right' : 'left'); sw.done = true; }
  else if (Math.abs(dy) > T) { pushAction(dy < 0 ? 'jump' : 'roll'); sw.done = true; }
});
canvas.addEventListener('pointerup', (e) => {
  if (sw && !sw.done && state === 'playing' && performance.now() - sw.t < 220) {
    const now = performance.now() / 1000;
    if (now - lastSpace < 0.32) pushAction('board');
    lastSpace = now;
  }
  sw = null;
});

// ------------------------------------------------------------------ gameplay
function powerDuration(type) {
  const d = C.POWERUPS[type];
  return d.base + (mp.active ? 0 : d.perLevel * save.upgrades[type]);
}

function resetRun() {
  Object.assign(P, { hitKind: null, hitSide: 1, lane: 1, target: 1, prev: 1, x: 0, y: 0, vy: 0, grounded: true, coyote: 0, vx: 0, rollT: 0, rolling: false, rollQueued: false, h: C.PLAYER_H, onBoard: false, boardT: 0, inv: 0, bump: 0, stumbleT: 0, jetY: 0, ground: 0, groundSmooth: 0, jetting: false, jetLeft: 0, jetCoinT: 0, jumpBuffer: 0, laneFrom: 0, laneT: 1, laneDur: 0.27 });
  for (const k of Object.keys(pw)) { pw[k] = 0; }
  shownScore = 0;
  run.in = { n: 0, fast: 0, last: 0 };
  run.lbScore = 0;
  Object.assign(run, { speed: C.SPEED_START, score: 0, coins: 0, dist: 0, jumps: 0, rolls: 0, powers: 0, lanes: 0, boards: 0, roof: 0, t: 0, dieT: 0, caughtBy: false, distAcc: 0, roofAcc: 0, reported: 0 });
  Object.assign(G, { active: false, t: 0, z: 30, x: 0, dogZ: 30, shown: true, introT: 0 });
  queue.length = 0;
  fx.clear();
  $('h-powers').innerHTML = '';
  $('h-toast').innerHTML = '';
  $('h-tut').innerHTML = '';
  themeBase = 0;
}

function startRun(opts = {}) {
  audio.initAudio(); audio.resumeAudio();
  save.stats.runs++;
  resetRun();
  run.revives = 0; run.chestBoards = 0;
  run.boostT = 0; run.boostMul = 1; run.noCoinsT = 0; run.duelCount = 0; run.deathSaved = false; P.secondLife = false;
  run.cheated = tainted() || !!opts.ltm;
  run.ltm = opts.ltm || null; run.warpAt = 20 + Math.random() * 32; run.warping = false;
  $('h-cheat').classList.toggle('hidden', !(run.cheated || (cheats.bot && cheats.botTag)));
  $('h-cheat').textContent = opts.ltm ? 'GOLD RUSH - the track will warp into the arena...' : cheats.bot && cheats.botTag ? 'BOT DRIVING - PRACTICE' : 'PRACTICE RUN - SECRET MENU ACTIVE';
  hubUI.setBarVisible(false);
  run.mode = opts.mode || save.settings.mode || 'classic';
  world.setNoCoin(run.mode === 'nocoin');
  $('hCoinPill').style.display = run.mode === 'nocoin' ? 'none' : '';
  $('hNoCoin').style.display = run.mode === 'nocoin' ? '' : 'none';
  world.setMode(...worldMode());
  run.seed = opts.seed ?? ((Math.random() * 2 ** 31) >>> 0);
  world.setSeed(run.seed);
  world.reset({ calm: true });
  world.startRun();
  world.dist = 0;
  state = 'playing';
  run.intro = true;
  online.ticket = null; online.submitted = false;
  if (online.token && !mp.active && !run.cheated) api.startTicket(run.mode, !!run.daily, curMap()).then((r) => { if (r) online.ticket = r.ticket; });
  show('menu', false);
  show('hud', true);
  $('hMul').textContent = 'x' + scoreMult();
  updateHudStatic();
  audio.startMusic('play');
  audio.startWind();
  run.introOn = !mp.active;
  introSaid = false; introGo = false; sprayT = 0;
  G.introT = 0;
  G.z = run.introOn ? 18 : 6.4; G.dogZ = run.introOn ? 15 : 4.2;
  G.shown = true;
  guard.root.visible = !run.introOn; dog.root.visible = !run.introOn;
  if (run.introOn) { P.x = -3.2; P.laneT = 1; P.target = 1; run.speed = 0; } else { toast('GO!'); sfx_bark(); }
}
const sfx_bark = () => { audio.sfx.bark(); setTimeout(() => audio.sfx.whistle(), 250); };

function scoreMult() { return (mp.active ? 1 : Math.min(save.level, 30)) * (pw.mult > 0 ? 2 : 1); }

// Start a timed lane change from the current x position toward P.target.
function retarget() {
  P.laneFrom = P.x;
  P.laneT = 0;
  const base = P.jetting ? (snappy() ? C.JET_LANE_CHANGE * 0.5 : C.JET_LANE_CHANGE) : (snappy() ? C.LANE_CHANGE_SNAPPY : C.LANE_CHANGE);
  P.laneDur = (base * Math.max(0.4, Math.abs(C.LANES[P.target] - P.x) / C.LANE_W)) / cheats.laneSpeed;
}

function doAction(a) {
  if (state !== 'playing') return;
  if (P.jetting && a !== 'left' && a !== 'right') return;
  switch (a) {
    case 'left': case 'right': {
      const nl = clamp(P.target + (a === 'left' ? -1 : 1), 0, 2);
      if (nl !== P.target) {
        P.prev = P.target; P.target = nl; retarget(); run.lanes++;
        audio.sfx.lane();
        report('lane', 1);
      }
      break;
    }
    case 'jump':
      if (P.grounded || P.coyote > 0) {
        P.vy = (pw.sneakers > 0 ? C.JUMP_V_SNEAKERS : C.JUMP_V) * Math.sqrt(cheats.jumpScale);
        P.grounded = false; P.coyote = 0;
        if (P.rolling) { P.rolling = false; P.rollT = 0; P.h = C.PLAYER_H; }
        run.jumps++; report('jump', 1);
        audio.sfx.jump();
      } else if (cheats.doubleJump && !P.usedDouble && !P.jetting) {
        P.usedDouble = true; P.vy = C.JUMP_V * 0.92 * Math.sqrt(cheats.jumpScale); run.jumps++; audio.sfx.jump();
      } else if (P.vy > 0 || P.vy < -3) {
        P.jumpBuffer = 0.14;
      }
      break;
    case 'roll':
      if (P.grounded) {
        P.rolling = true; P.rollT = C.ROLL_TIME * cheats.rollScale; P.h = C.PLAYER_H_ROLL;
        run.rolls++; report('roll', 1);
        audio.sfx.roll();
      } else {
        P.vy = Math.min(P.vy, C.DIVE_V);
        P.rollQueued = true;
      }
      break;
    case 'board':
      if (!P.onBoard && (save.boards > 0 || cheats.infBoards) && !(run.ranked && mp.active)) {
        if (!cheats.infBoards) { save.boards--; persist(); }
        P.onBoard = true; P.boardT = cheats.boardTime; P.inv = Math.max(P.inv, 0.5);
        run.boards++; report('board', 1);
        audio.sfx.board();
        toast('HOVERBOARD!');
        updateHudStatic();
      }
      break;
  }
}

function activatePower(type) {
  audio.sfx.power();
  run.powers++; report('power', 1);
  const dur = powerDuration(type);
  pw[type] = dur; pwMax[type] = dur;
  toast(C.POWERUPS[type].name.toUpperCase() + '!');
  if (type === 'jetpack') { P.jetting = true; P.jetCoinT = 0; P.jetLeft = dur; P.landAssist = false; report('jetpack', 1); }
  if (type === 'mult') { $('hDbl').style.display = ''; }
  renderPowers();
}

const iconCache = {};
function powerIcon(k) {
  if (!iconCache[k]) iconCache[k] = makeIconTexture(k, C.POWERUPS[k].color).image.toDataURL();
  return iconCache[k];
}
let shownScore = 0;
function bumpCoin() { const el = $('hCoinPill'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function say(txt, ms) {
  const el = $('h-say');
  el.textContent = txt;
  el.classList.add('on');
  clearTimeout(say.t);
  say.t = setTimeout(() => el.classList.remove('on'), ms);
}
// Drives the runner during the start animation (tagging a wall -> turn -> sprint).
function introStep() {
  const t = run.t;
  if (t < SPRAY_T) {
    P.x = -3.2;
    sprayT -= 1 / 60;
    if (sprayT <= 0) {
      sprayT = 0.06;
      fx.spray(P.x - 0.55, 1.1 + Math.sin(t * 9) * 0.14, 0, SPRAY_COLORS[Math.floor(t * 5) % SPRAY_COLORS.length]);
      if (Math.random() < 0.45) audio.sfx.spray();
    }
  } else {
    if (!introSaid) {
      introSaid = true;
      say('HEY! STOP RIGHT THERE!', 1500);
      audio.sfx.whistle(); setTimeout(() => audio.sfx.bark(), 260);
      guard.root.visible = true; dog.root.visible = true;
    }
    const k = clamp((t - SPRAY_T) / 0.9, 0, 1);
    P.x = lerp(-3.2, 0, k * k * (3 - 2 * k));
    if (!introGo && t > SPRAY_T + 0.7) { introGo = true; toast('RUN!'); }
  }
}

function renderPowers() {
  const box = $('h-powers');
  const sym = { magnet: 'M', jetpack: 'J', sneakers: 'S', mult: '2x' };
  for (const k of Object.keys(pw)) {
    let el = box.querySelector(`[data-k="${k}"]`);
    if (pw[k] > 0) {
      if (!el) {
        el = document.createElement('div');
        el.className = 'power'; el.dataset.k = k;
        el.style.setProperty('--c', C.POWERUPS[k].color);
        el.innerHTML = `<img class="pic" alt="${sym[k]}" src="${powerIcon(k)}"><div class="bar"><i></i></div>`;
        box.appendChild(el);
      }
      el.querySelector('i').style.width = `${clamp(pw[k] / pwMax[k], 0, 1) * 100}%`;
    } else if (el) el.remove();
  }
  if (pw.mult <= 0) $('hDbl').style.display = 'none';
}

function stumble(hit) {
  if (P.onBoard) { breakBoard(hit); return; }
  if (G.active) { die('caught'); return; }
  // first stumble: the guard appears
  G.active = true; G.t = 0; G.z = 9; G.dogZ = 6; G.shown = true;
  guard.root.visible = true; dog.root.visible = true;
  P.stumbleT = 0.5; P.bump = 0.5; hitStop = 0.05;
  P.inv = 0.25;
  shake = Math.max(shake, 0.45);
  run.speed *= 0.82;
  audio.sfx.stumble(); setTimeout(() => audio.sfx.bark(), 200); setTimeout(() => audio.sfx.siren(), 500);
  if (hit && !hit.front) { P.target = P.prev; retarget(); }
  $('h-guard').classList.add('on');
}

function breakBoard(hit) {
  // the board takes the hit AND the obstacle is cleared: otherwise the runner would ride through the inside of a train for 2.4 s
  if (hit && hit.solid) world.removeSolid(hit.solid);
  world.clearLane(P.x, 30);
  P.onBoard = false; P.boardT = 0; P.inv = 2.4; P.bump = 0.6;
  shake = Math.max(shake, 0.6); flash = 1;
  audio.sfx.boardBreak();
  fx.crashBurst(P.x, 0.6, 0);
  toast('BOARD BROKEN!');
  updateHudStatic();
}

let hitStop = 0; // seconds of near-freeze at the moment of impact
function die(reason) {
  if (state !== 'playing') return;
  run.deathKind = reason === 'crash' && P.hitKind === 'slam' ? 'slam' : 'fall';
  if (run.deathKind === 'slam') hitStop = 0.09;
  // Gold Rush: the duel happens at least once per game. A crash before the first one warps into the arena instead.
  if (run.ltm && !run.duelCount && !run.warping && !mp.active) { run.deathSaved = true; P.inv = 6; world.clearAhead(60); toast('GOLD RUSH!'); beginWarp(false); return; }
  if (P.secondLife) { P.secondLife = false; P.inv = Math.max(P.inv, 3.2); shake = 1; flash = 1; world.clearAhead(40); audio.sfx.power(); toast('SECOND LIFE!'); return; }
  state = 'dying';
  run.dieT = 0;
  run.deathReason = reason;
  run.caughtBy = reason === 'caught';
  shake = 1;
  audio.sfx.crash();
  fx.crashBurst(P.x, 1, 0);
  P.jetting = false;
  pw.jetpack = 0;
  $('h-guard').classList.remove('on');
}

function describeAhead() {
  const out = [];
  for (const seg of world.segs) {
    for (const s of seg.solids) {
      const zf = -(seg.z + s.lz1);
      if (zf < -12 || zf > 34) continue;
      out.push(`${s.kind}@L${Math.round(s.x / C.LANE_W) + 1} d=${zf.toFixed(1)} len=${(s.lz1 - s.lz0).toFixed(1)}`);
    }
  }
  return out.join(' | ');
}

function handleHit(hit) {
  if (P.inv > 0) return;
  if (godNow()) return;
  P.hitKind = hit.lethal ? 'slam' : hit.front ? (hit.kind === 'over' ? 'bonk' : 'trip') : 'side'; // picks the animation
  P.hitSide = Math.sign((hit.solid ? hit.solid.x : P.x) - P.x) || 1;
  if (cheats.noStumble && !hit.lethal) return;
  if (hit.lethal || (!hit.front && false)) run.deathInfo = `${hit.kind} lane=${P.target} x=${P.x.toFixed(2)} y=${P.y.toFixed(2)} :: ${describeAhead()}`;
  if (hit.lethal) {
    if (P.onBoard) breakBoard(hit); else die('crash');
  } else {
    if (!hit.front && P.bump > 0) return;
    stumble(hit);
  }
}

function report(ev, n) {
  if (run.cheated) return; // practice runs never advance missions
  const done = missions.report(ev, n);
  for (const m of done) {
    audio.sfx.mission();
    toast('MISSION COMPLETE!');
  }
}

// ------------------------------------------------------------------ bot (testing / demo)
// Bot / assist planner. Builds a 3-lane x N-metre grid of what is ahead (walls, barriers, coins, power-ups, oncoming trains projected
// into the runner's own progress), plans the cheapest path with dynamic programming, and acts with exact timing. `pro` = full autopilot; otherwise only the
// requested assists (jump & roll, or lane dodging) run.
function botThink(opt = {}) {
  const speed = run.speed;
  const style = opt.pro ? (cheats.botStyle || 'pro') : 'safe';
  const lag = opt.pro ? (cheats.botReact / 1000) * speed : 0; // reaction delay = distance travelled before it notices
  const look = Math.min(120, speed * (style === 'safe' ? 1.6 : 1.3) + 14);
  const N = Math.ceil(look);
  // ---- 1. the road ahead as a grid: 3 lanes x N metres. wall = lethal solid, low/over = barriers, val = coins and power-ups
  const mk = (T = Uint8Array) => [0, 1, 2].map(() => new T(N + 2));
  const wall = mk(), low = mk(), over = mk(), val = mk(Float32Array);
  const fill = (arr, a, b, v = 1) => { for (let i = Math.max(0, Math.floor(a)); i <= Math.min(N + 1, Math.ceil(b)); i++) arr[i] = v; };
  for (const seg of world.segs) {
    for (const s of seg.solids) {
      const off = s.off || 0, len = s.lz1 - s.lz0;
      let zf = -(seg.z + s.lz1 + off); // distance to the front face
      let ratio = 1;
      if (s.vz) { // an oncoming train: in the runner's own progress it arrives sooner and covers less road
        ratio = speed / (speed + s.vz);
        zf = s.started ? zf * ratio : zf - (s.vz * Math.min(zf, s.trigger || 38)) / (speed + s.vz);
      }
      const d0 = zf - 0.35 - lag, d1 = zf + len * ratio + 0.35 - lag;
      if (d1 < -0.5 || d0 > N + 1) continue;
      const lane = Math.round(s.x / C.LANE_W) + 1;
      if (lane < 0 || lane > 2) continue;
      if (s.kind === 'train' || s.kind === 'container' || s.kind === 'ramp') fill(wall[lane], d0, d1);
      else if (s.kind === 'low') fill(low[lane], d0 - 0.2, d0 + 0.8);
      else if (s.kind === 'over') fill(over[lane], d0 - 0.4, d0 + 1.1);
    }
  }
  const wCoin = style === 'coins' ? 0.9 : style === 'safe' ? 0.12 : 0.32;
  for (const c of world.coins.list) {
    const dz = -c.z - lag, l = Math.round(c.x / C.LANE_W) + 1;
    if (dz < -0.5 || dz > N || l < 0 || l > 2) continue;
    if (run.mode === 'nocoin') fill(wall[l], dz - 0.8, dz + 0.8); // every coin is a trap here
    else if (c.y < 3) val[l][Math.round(dz)] += (c.v || 1) * wCoin;
  }
  if (run.mode !== 'nocoin') {
    for (const it of world.items.list) {
      const dz = -it.z - lag, l = Math.round(it.x / C.LANE_W) + 1;
      if (dz < 0 || dz > N || l < 0 || l > 2) continue;
      val[l][Math.round(dz)] += (it.type === 'box' ? 4 : 7) * (style === 'safe' ? 0.5 : 1); // power-ups are worth a detour
    }
  }
  // ---- 2. plan: dynamic programming over (metre, lane). Staying costs the road's hazards, changing lane costs a little and needs both
  // lanes clear while the runner is between them. Switches are pushed as late as possible (ties prefer later), so the runner moves
  // with purpose instead of zig-zagging.
  const BIG = 400, SW = style === 'safe' ? 1.8 : style === 'coins' ? 0.5 : 0.8;
  const w = Math.max(2, Math.ceil(speed * (snappy() ? 0.14 : 0.29)) + 1);
  const cell = (l, i) => (wall[l][i] ? BIG : 0) + (low[l][i] || over[l][i] ? 1.4 : 0) - val[l][i];
  const INF = 1e9, W = N + 1, lead = Math.ceil(speed * 0.3);
  const dp = [0, 1, 2].map(() => new Float32Array(W + 1).fill(INF));
  const from = [0, 1, 2].map(() => new Int16Array((W + 1) * 2).fill(-1)); // [prevLane, prevStep]
  const cur = P.target;
  dp[cur][0] = 0;
  for (let i = 0; i < N; i++) {
    for (let l = 0; l < 3; l++) {
      const c = dp[l][i];
      if (c >= INF) continue;
      const stay = c + cell(l, i + 1);
      if (stay < dp[l][i + 1]) { dp[l][i + 1] = stay; from[l][(i + 1) * 2] = l; from[l][(i + 1) * 2 + 1] = i; }
      if (i + w > N) continue;
      for (const l2 of [l - 1, l + 1]) {
        if (l2 < 0 || l2 > 2) continue;
        let cost = SW + 0.003 * (N - i), bad = 0;
        for (let j = i; j <= i + w; j++) { // the runner is between the two lanes for the whole window, starting now
          bad += Math.max(wall[l][j] ? BIG : 0, wall[l2][j] ? BIG : 0);
          if (low[l][j] || over[l][j] || low[l2][j] || over[l2][j]) cost += 3; // a barrier while changing lane: possible but risky
        }
        for (let j = i + w + 1; j <= Math.min(N, i + w + lead); j++) if (low[l2][j] || over[l2][j]) { cost += 7; break; } // no time left to jump or roll after arriving
        cost += bad - val[l2][Math.min(N, i + w)];
        const t = c + cost;
        if (t < dp[l2][i + w]) { dp[l2][i + w] = t; from[l2][(i + w) * 2] = l; from[l2][(i + w) * 2 + 1] = i; }
      }
    }
  }
  let endLane = cur;
  for (let l = 0; l < 3; l++) if (dp[l][N] < dp[endLane][N] - 1e-6 || (dp[l][N] === dp[endLane][N] && l === cur)) endLane = l;
  // walk the best path back and keep its FIRST lane change
  let l = endLane, i = N, first = null;
  while (i > 0 && l >= 0) {
    const pl = from[l][i * 2], pi = from[l][i * 2 + 1];
    if (pl < 0) break;
    if (pl !== l) first = { at: pi, to: l, from: pl };
    l = pl; i = pi;
  }
  const trouble = dp[endLane][N] >= BIG * 0.5; // even the best path runs into something
  const nearWall = (lane) => { for (let k = 0; k <= N; k++) if (wall[lane][k]) return k; return Infinity; };
  const doLanes = opt.pro || opt.lanes, doMoves = opt.pro || opt.assist;
  const act = 0.6; // the plan already accounts for the crossing window: change lane exactly when the path says so
  if (doLanes && first && first.at <= act && botCd <= 0) {
    pushAction(first.to < cur ? 'left' : 'right');
    botCd = 0.05;
    return;
  }
  // ---- 3. jump / roll for barriers in the lane we are in (or about to be in)
  if (doMoves) {
    const lane = P.target, reach = speed * (P.onBoard ? 0.22 : 0.3);
    let nextLow = Infinity, nextOver = Infinity;
    for (let k = 0; k <= N; k++) { if (nextLow === Infinity && low[lane][k]) nextLow = k + 0.3; if (nextOver === Infinity && over[lane][k]) nextOver = k + 0.4; if (nextLow < Infinity && nextOver < Infinity) break; }
    if (nextLow < reach && nextLow > 0.2 && P.grounded) pushAction('jump'); // a jump cancels a roll in progress
    else if (nextOver < speed * 0.13 + 0.4 && nextOver > 0.2 && P.grounded && (!P.rolling || P.rollT < nextOver / speed + 0.25)) pushAction('roll'); // start late (the roll lasts 0.6 s), and renew it for the next bar
    else if (!P.grounded && !P.jetting && nextOver < speed * 0.5 + 2 && nextOver > 0.2 && botCd <= 0) { pushAction('roll'); botCd = 0.3; } // in the air with a bar coming: dive, then roll on landing
    else if (style === 'show' && !P.grounded && P.y > 1.2 && P.vy < 1 && botCd <= 0) { pushAction('roll'); botCd = 0.5; } // jump-roll dive combo
  }
  // ---- 4. nothing works: burn a hoverboard instead of crashing (and only when the crash is really about to happen)
  if (opt.pro && cheats.botBoards && !P.onBoard && (save.boards > 0 || cheats.infBoards) && trouble && nearWall(P.target) < speed * 0.22 + 0.8) pushAction('board');
}
let botCd = 0;

// ---------------------------------------------------------------- update
function updatePlaying(dt) {
  run.t += dt;
  const introActive = !!run.introOn && run.t < INTRO_T && state === 'playing';
  if (run.ltm && state === 'playing' && !run.warping && !introActive && run.t >= run.warpAt) beginWarp(false);
  if (state === 'playing') {
    if (introActive) {
      const k = clamp((run.t - SPRAY_T) / (INTRO_T - SPRAY_T), 0, 1);
      run.speed = k * k * (3 - 2 * k) * C.SPEED_START;
      introStep();
    } else {
      let tt = run.t - (run.introOn ? INTRO_T : 0) + cheats.startPct * 1.79; // the speed curve starts when the sprint does
      if (cheats.noProgress) tt = Math.min(tt, 20 + cheats.startPct * 1.79);
      let target = cheats.lockSpeed ? cheats.lockValue : C.speedAtTime(tt) * cheats.speedMul;
      if (run.boostT > 0) { run.boostT -= dt; target = Math.min(target * run.boostMul, C.SPEED_CAP * 1.1); } // Gold Rush winner boost (capped below the anti-cheat ceiling)
      run.speed = cheats.instantSpeed ? target : damp(run.speed, target * (P.stumbleT > 0 ? 0.8 : 1), 2.5, dt);
    }
  }
  const speed = run.speed;

  // input
  botCd -= dt;
  if (introActive && run.t < INTRO_T - 0.5) queue.length = 0;
  if (botActive() && !introActive) botThink({ pro: true });
  else if ((cheats.assist || cheats.autoLane) && !introActive) botThink({ assist: !!cheats.assist, lanes: !!cheats.autoLane });
  while (queue.length) doAction(queue.shift());

  // timers
  if (cheats.permMagnet && pw.magnet <= 0.3) activatePower('magnet');
  if (cheats.permSneakers && pw.sneakers <= 0.3) activatePower('sneakers');
  if (cheats.permMult && pw.mult <= 0.3) activatePower('mult');
  for (const k of Object.keys(pw)) {
    if (pw[k] > 0) {
      pw[k] -= dt;
      if (pw[k] <= 0) { pw[k] = 0; if (k === 'jetpack') endJet(); }
    }
  }
  if (P.onBoard) { P.boardT -= dt; if (P.boardT <= 0) { P.onBoard = false; toast('Board expired'); updateHudStatic(); } }
  P.inv = Math.max(0, P.inv - dt);
  if (run.noCoinsT > 0) run.noCoinsT -= dt;
  P.bump = Math.max(0, P.bump - dt);
  P.stumbleT = Math.max(0, P.stumbleT - dt);
  P.coyote = Math.max(0, P.coyote - dt);
  P.jumpBuffer = Math.max(0, (P.jumpBuffer || 0) - dt);

  // lane movement
  const oldX = P.x;
  if (introActive) { /* x is driven by introStep */ } else if (P.laneT < 1) {
    P.laneT = Math.min(1, P.laneT + dt / P.laneDur);
    const e = snappy() ? 1 - (1 - P.laneT) ** 3 : P.laneT * P.laneT * (3 - 2 * P.laneT); // snappy: instant start, soft landing
    P.x = lerp(P.laneFrom, C.LANES[P.target], e);
  } else P.x = C.LANES[P.target];
  P.vx = (P.x - oldX) / Math.max(dt, 1e-4);

  // roll timer
  if (P.rolling) {
    P.rollT -= dt;
    if (P.rollT <= 0) { P.rolling = false; P.h = C.PLAYER_H; }
  }

  // vertical
  if (P.jetting) {
    P.jetLeft -= dt;
    if (P.jetLeft < 1.9 && !P.landAssist) { P.landAssist = true; P.prev = P.target; P.target = safeLane(); retarget(); }
    const tgt = P.jetLeft > 0.9 ? 6.4 : 0;
    P.jetY = damp(P.jetY, tgt, P.jetLeft > 0.9 ? 3.5 : 2.6, dt);
    P.y = P.jetY; P.vy = 0; P.grounded = false; P.inv = Math.max(P.inv, 0.2);
    P.jetCoinT -= dt;
    if (P.jetCoinT <= 0 && P.jetLeft > 1.6 && run.mode !== 'nocoin') {
      P.jetCoinT = 0.14;
      const cx = Math.sin(run.t * 1.3) * C.LANE_W;
      world.coins.add(cx, 7.2, -48);
    }
    if (P.jetLeft <= 0) endJet();
  } else {
    P.vy -= C.GRAVITY * cheats.gravity * dt;
    P.y += P.vy * dt;
  }

  // collisions & ground
  const frontDepth = speed * dt * 1.6 + 0.6;
  const q = world.probe(P.x, P.y, P.h, frontDepth);
  P.ground = q.ground;
  if (!P.jetting) {
    if (P.y <= q.ground + 0.0001 && P.vy <= 0.0001) {
      if (!P.grounded && P.vy < -6) { audio.sfx.land(); fx.landDust(P.x, 0); camKick = Math.max(camKick, Math.min(0.34, -P.vy * 0.018)); if (P.vy < -14) shake = Math.max(shake, 0.2); }
      P.y = q.ground; P.vy = 0;
      if (!P.grounded) {
        P.grounded = true; P.usedDouble = false;
        if (P.rollQueued) { P.rollQueued = false; doAction('roll'); }
        if (P.jumpBuffer > 0) { P.jumpBuffer = 0; doAction('jump'); }
      }
    } else if (P.grounded && P.y > q.ground + 0.02 && P.vy <= 0.0001) {
      P.grounded = false; P.coyote = C.COYOTE; P.vy = 0;
    }
  } else {
    P.grounded = false;
  }
  if (q.hit && state === 'playing') handleHit(q.hit);

  // roof running
  const onRoof = P.grounded && P.y > 3;
  if (onRoof) run.roofAcc += speed * dt;

  // world scroll
  world.update(dt, speed);
  run.dist += speed * dt;
  run.distAcc += speed * dt;

  // scoring
  const m = scoreMult();
  run.score += speed * dt * m * 0.9 * cheats.scoreMul;
  run.lbScore += speed * dt * (pw.mult > 0 ? 2 : 1) * 0.9;
  if (run.distAcc >= 10) { const d = Math.floor(run.distAcc / 10) * 10; run.distAcc -= d; report('dist', d); }
  if (run.roofAcc >= 10) { const d = Math.floor(run.roofAcc / 10) * 10; run.roofAcc -= d; report('roof', d); }

  // coins & items
  const pp = { x: P.x, y: P.y, h: P.h };
  world.coins.update(dt, speed, pp, pw.magnet > 0 ? 8.5 * cheats.magnetRange : 0, time, (c) => {
    if (run.noCoinsT > 0) return; // the Gold Rush reward switches coin collection off for 8 s
    if (run.mode === 'nocoin') {
      if (P.inv > 0 || state !== 'playing' || godNow()) return;
      if (P.onBoard) { breakBoard(); return; }
      fx.crashBurst(c.x, c.y, c.z); toast('COIN!'); die('coin'); return;
    }
    const v = c.v || 1;
    run.lbScore += 4 * v * (pw.mult > 0 ? 2 : 1);
    const vv = v * cheats.coinMul;
    run.coins += vv; run.score += 4 * vv * m; if (!run.cheated) { save.coins += vv; save.stats.coins += vv; }
    audio.sfx.coin(); fx.coinBurst(c.x, c.y, c.z, v > 1); bumpCoin();
    report('coins', v);
  }, (c) => fx.sparkle(c.x, c.y, c.z));
  world.items.update(dt, speed, pp, camera, time, (it) => {
    if (it.type === 'box') { openBox(it); return; }
    activatePower(it.type);
    fx.itemBurst(it.x, it.y, it.z, C.POWERUPS[it.type].color);
  });
  if (pw.magnet > 0 && Math.random() < 0.5) fx.magnetPulse(P.x, P.y + 0.9, 0);

  // guard / dog
  updateGuard(dt);
  mpSend(dt);

  // death sequence
  if (state === 'dying') {
    run.dieT += dt;
    run.speed = Math.max(0, run.speed - 60 * dt);
    if (run.dieT > 1.35) gameOver();
  }

  // fx
  if (P.grounded && state === 'playing' && !P.onBoard && Math.random() < 0.35) fx.runDust(P.x, 0.2, speed);
  if (P.onBoard && Math.random() < 0.8) fx.boardTrail(P.x, P.y + 0.1, 0, (time * 0.4) % 1);
  if (P.jetting) { fx.flame(P.x - 0.11, P.y + 0.45, 0.4); fx.flame(P.x + 0.11, P.y + 0.45, 0.4); }
  if (pw.sneakers > 0 && !P.grounded && Math.random() < 0.6) fx.boardTrail(P.x, P.y + 0.05, 0, 0.5);
}

function openBox(it) {
  fx.itemBurst(it.x, it.y, it.z, '#ffb347');
  const r = Math.random();
  audio.sfx.power();
  if (r < 0.55) { const n = 60 + Math.floor(Math.random() * 190); run.coins += n; if (!run.cheated) { save.coins += n; save.stats.coins += n; } run.score += n * 2; report('coins', n); toast(`+${n} COINS!`); }
  else if (r < 0.8) { if (!run.cheated) save.boards++; run.chestBoards = (run.chestBoards || 0) + 1; persist(); updateHudStatic(); toast('+1 HOVERBOARD!'); }
  else { const k = ['magnet', 'sneakers', 'mult', 'jetpack'][Math.floor(Math.random() * 4)]; activatePower(k); }
}

// Lane with the most free road ahead (used to auto-steer to a safe landing after a jetpack).
function safeLane() {
  let best = P.target, bestScore = -1e9;
  for (let l = 0; l < 3; l++) {
    let d = 70;
    for (const seg of world.segs) {
      for (const o of seg.solids) {
        if (Math.round(o.x / C.LANE_W) + 1 !== l || !(o.kind === 'train' || o.kind === 'container' || o.kind === 'ramp')) continue;
        const off = o.off || 0, zf = -(seg.z + o.lz1 + off), zb = -(seg.z + o.lz0 + off);
        if (zb < -4 || zf > 70) continue;
        d = Math.min(d, Math.max(zf, 0));
      }
    }
    const sc = d - Math.abs(l - P.target) * 3;
    if (sc > bestScore) { bestScore = sc; best = l; }
  }
  return best;
}

function endJet() {
  P.jetting = false;
  P.vy = 0;
  pw.jetpack = 0;
  P.inv = Math.max(P.inv, 1.0);
  renderPowers();
}

function updateGuard(dt) {
  const gc = guard, dc = dog;
  if (run.intro) {
    G.introT += dt;
    // intro: guard & dog chase, then fall behind
    const t = G.introT - (run.introOn ? INTRO_T : 0);
    if (t < 0) { // arrives from far behind while the runner is still tagging
      const kk = clamp((G.introT - SPRAY_T) / (INTRO_T - SPRAY_T), 0, 1), e = kk * kk * (3 - 2 * kk);
      G.z = lerp(18, 5.6, e); G.dogZ = lerp(15, 3.6, e);
    } else { G.z = 5.6 + Math.max(0, t - 1.6) * 7; G.dogZ = 3.6 + Math.max(0, t - 1.4) * 8; }
    G.x = damp(G.x, P.x, 6, dt);
    if (t > 4.2) { run.intro = false; G.shown = false; gc.root.visible = false; dc.root.visible = false; }
  } else if (G.active) {
    G.t += dt;
    const caught = state === 'dying' && run.caughtBy;
    const tz = caught ? 0.9 : 3.4;
    const dz = caught ? 0.2 : 2.1;
    G.z = damp(G.z, G.t > 9 ? 40 : tz, 3, dt);
    G.dogZ = damp(G.dogZ, G.t > 9 ? 36 : dz, 3.6, dt);
    G.x = damp(G.x, P.x, 5, dt);
    if (G.t > 9 && G.z > 30) { G.active = false; G.shown = false; gc.root.visible = false; dc.root.visible = false; $('h-guard').classList.remove('on'); }
    if (G.t > 7 && G.active) $('h-guard').classList.remove('on');
  } else if (G.shown && !run.intro) {
    G.shown = false; gc.root.visible = false; dc.root.visible = false;
  }
  if (gc.root.visible) {
    gc.root.position.set(G.x, 0, G.z);
    gc.root.rotation.y = 0;
    poseCharacter(gc, { state: state === 'dying' ? 'run' : 'sprint', speed: run.speed, vx: 0 }, dt);
    dc.root.position.set(G.x + 0.2 * Math.sin(time * 3), 0, G.dogZ);
    animateDog(dc, dt, run.speed);
  }
}

function toast(txt) {
  const box = $('h-toast');
  box.innerHTML = '';
  const d = document.createElement('div');
  d.textContent = txt;
  box.appendChild(d);
  setTimeout(() => { if (d.parentNode) d.remove(); }, 1400);
}

// ----------------------------------------------------------------- game flow
function pause() {
  if (state !== 'playing' || mp.running) return;
  state = 'paused';
  show('pause', true);
  audio.setMood('menu');
}
function resume() {
  if (state !== 'paused') return;
  state = 'playing';
  show('pause', false);
  audio.setMood('play');
  canvas.focus();
}
function gameOver() {
  state = 'over';
  audio.stopWind();
  audio.setMood('menu');
  const finalScore = Math.floor(run.score);
  const bank = !run.cheated;
  const newBest = bank && finalScore > save.best;
  if (newBest) save.best = finalScore;
  if (bank) { save.bestDist = Math.max(save.bestDist, Math.floor(run.dist)); save.bestCoins = Math.max(save.bestCoins, run.coins); }
  if (bank) save.stats.dist += Math.floor(run.dist - (run.countedDist || 0));
  run.countedDist = run.dist;
  if (run.t > 12) save.tutorialDone = true;
  report('score', finalScore);
  const up = missions.advanceIfComplete();
  persist();
  countUp($('oScore'), finalScore, 900);
  $('oBest').textContent = fmt(save.best);
  countUp($('oCoins'), run.coins, 700);
  countUp($('oDist'), Math.floor(run.dist), 800, ' m');
  $('oTime').textContent = fmtTime(run.t);
  $('oMode').textContent = run.mode === 'nocoin' ? (run.deathReason === 'coin' ? 'NO COIN - you touched a coin!' : 'NO COIN') : '';
  $('oNew').style.display = newBest ? '' : 'none';
  if (newBest && finalScore > 0) { audio.sfx.mission(); setTimeout(confetti, 350); }
  renderMissionList($('oMissions'));
  if (up) { const e = document.createElement('div'); e.className = 'newbest ink'; e.textContent = `LEVEL UP! Score x${Math.min(save.level, 30)}`; $('oMissions').appendChild(e); }
  show('hud', false);
  if (run.daily) {
    const k = todayKey();
    if (!save.daily || save.daily.key !== k || finalScore > save.daily.best) save.daily = { key: k, best: finalScore };
    persist();
  }
  if (mp.active) { mpFinishLocal(finalScore); return; }
  submitRun(); // revived runs are paid but kept off the leaderboards (the server decides)
  const cost = cheats.freeRevive ? 0 : 100 * 2 ** (run.revives || 0), rb = $('btnRevive');
  rb.style.display = (cheats.freeRevive || (run.revives || 0) < 3) && !run.ranked ? '' : 'none';
  rb.innerHTML = `REVIVE  ${fmt(cost)} <span class="coin-i sm"></span>`;
  rb.disabled = cost > 0 && save.coins < cost;
  show('over', true);
}

// Numbers that roll up to their value (game over screen).
function countUp(el, to, ms, suffix = '') {
  const t0 = performance.now();
  const step = (now) => {
    const k = clamp((now - t0) / ms, 0, 1), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(to * e) + suffix;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function confetti() {
  const cv = $('confetti'), ctx = cv.getContext('2d');
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  const cols = ['#ffd23f', '#ff3d7f', '#29d6ff', '#42e07a', '#ff8a1f', '#ffffff'];
  const ps = Array.from({ length: 150 }, () => ({ x: cv.width / 2 + (Math.random() - 0.5) * 220, y: cv.height * 0.42, vx: (Math.random() - 0.5) * 16, vy: -6 - Math.random() * 13, r: 4 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[(Math.random() * cols.length) | 0] }));
  const t0 = performance.now();
  const frame2 = (now) => {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of ps) {
      p.vy += 0.32; p.vx *= 0.995; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - t / 3.2);
      ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); ctx.restore();
    }
    if (t < 3.3) requestAnimationFrame(frame2); else ctx.clearRect(0, 0, cv.width, cv.height);
  };
  requestAnimationFrame(frame2);
}

function revive() {
  const cost = cheats.freeRevive ? 0 : 100 * 2 ** (run.revives || 0);
  if (state !== 'over' || (cost && save.coins < cost)) { audio.sfx.deny(); return; }
  save.coins -= cost; run.revives = (run.revives || 0) + 1; persist();
  show('over', false); show('hud', true);
  state = 'playing';
  run.dieT = 0; run.deathReason = null; run.caughtBy = false;
  Object.assign(P, { inv: 3.5, bump: 1, stumbleT: 0, jetting: false, vy: 0, y: P.ground, grounded: true, rolling: false, rollT: 0, h: C.PLAYER_H });
  world.clearAhead(90);
  G.active = false; G.shown = false; guard.root.visible = false; dog.root.visible = false;
  $('h-guard').classList.remove('on');
  run.speed = C.SPEED_START;
  audio.setMood('play'); audio.startWind(); audio.sfx.power();
  toast('BACK IN THE RACE!');
  updateHudStatic();
}

function enterMenu(first = false, keepOverride = false) {
  if (!keepOverride) { mapOverride = null; run.daily = false; }
  state = 'menu';
  menuBlend = first ? 1 : menuBlend;
  show('hud', false); show('pause', false); show('over', false); show('shop', false); show('settings', false);
  hubUI.setBarVisible(true);
  hubUI.open('play');
  show('menu', true);
  world.setMode(...worldMode());
  world.setSeed((Math.random() * 2 ** 31) >>> 0);
  world.reset({ calm: true });
  world.dist = 0;
  fx.clear();
  guard.root.visible = false; dog.root.visible = false;
  buildPlayer();
  P.x = 0; P.y = 0; P.target = 1;
  run.speed = 0;
  themeBase = 0;
  audio.stopWind();
  if (audio.initAudio) { audio.startMusic('menu'); audio.setMood('menu'); }
  renderMenu();
  menuBlendTarget = 1;
}
let menuBlendTarget = 1;

function tryPlay(opts = {}) {
  const c = CHARACTERS[charIndex];
  if (!save.unlocked.includes(c.id)) { audio.initAudio(); audio.sfx.deny(); return; }
  audio.initAudio(); audio.resumeAudio();
  audio.sfx.click();
  menuBlendTarget = 0;
  run.daily = !!opts.daily;
  startRun(opts);
}

// ---------------------------------------------------------------------- UI
const shown = {};
function show(id, on) { $(id).classList.toggle('hidden', !on); shown[id] = on; }

// Native in-game dialogs (replace the browser's alert / confirm / prompt - no popups anywhere).
let dlgOpen = false;
function dialog({ title = 'CONFIRM', message = '', yes = 'OK', no = 'CANCEL', input = null, danger = false, validate = null, single = false }) {
  return new Promise((resolve) => {
    const el = $('dlg'), inp = $('dlgInput');
    $('dlgTitle').textContent = title; $('dlgMsg').textContent = message; $('dlgErr').textContent = '';
    $('dlgYes').textContent = yes; $('dlgNo').textContent = no; $('dlgNo').style.display = single ? 'none' : '';
    el.classList.toggle('danger', !!danger);
    inp.style.display = input ? '' : 'none';
    if (input) { inp.value = input.value || ''; inp.placeholder = input.placeholder || ''; inp.maxLength = input.max || 40; inp.type = input.password ? 'password' : 'text'; }
    dlgOpen = true; show('dlg', true);
    if (input) setTimeout(() => inp.focus(), 60);
    const done = (ok) => {
      if (ok && input && validate) { const err = validate(inp.value); if (err) { $('dlgErr').textContent = err; return; } }
      dlgOpen = false; show('dlg', false);
      $('dlgYes').onclick = $('dlgNo').onclick = null; inp.onkeydown = null; window.removeEventListener('keydown', onKey, true);
      resolve(ok ? (input ? inp.value : true) : (input ? null : false));
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } else if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); done(true); } else e.stopPropagation(); };
    window.addEventListener('keydown', onKey, true);
    $('dlgYes').onclick = () => { audio.sfx.click(); done(true); };
    $('dlgNo').onclick = () => { audio.sfx.click(); done(false); };
  });
}
const confirmDlg = (message, opts = {}) => dialog({ title: 'ARE YOU SURE?', message, yes: 'YES', no: 'NO', ...opts });
const notify = (title, message) => dialog({ title, message, yes: 'OK', single: true });

function renderMissionList(el) {
  el.innerHTML = '';
  for (const m of save.missions) {
    const d = document.createElement('div');
    d.className = 'mission' + (m.done ? ' done' : '');
    d.innerHTML = `<div class="t"><span>${missions.missionText(m)}</span><span>${m.done ? '✔' : `${fmt(m.progress)}/${fmt(m.target)}`}</span></div><div class="bar"><i style="width:${(m.progress / m.target) * 100}%"></i></div>`;
    el.appendChild(d);
  }
}

function renderMenu() {
  $('mCoins').textContent = fmt(save.coins);
  $('mBest').textContent = fmt(save.best);
  $('mDist').textContent = `${fmt(save.bestDist)} m`;
  $('mRuns').textContent = fmt(save.stats.runs);
  $('mBoards').textContent = save.boards;
  $('mLevel').textContent = `SCORE x${Math.min(save.level, 30)}`;
  renderMissionList($('mList'));
  renderMaps();
  renderModes();
  renderDaily();
  const c = CHARACTERS[charIndex];
  $('charName').textContent = c.name;
  $('charTag').textContent = c.tag;
  const unlocked = save.unlocked.includes(c.id);
  $('unlockBtn').style.display = unlocked ? 'none' : '';
  $('unlockBtn').innerHTML = `UNLOCK  ${fmt(c.cost)} <span class="coin-i sm"></span>`;
  $('playBtn').disabled = !unlocked;
  renderMenuChrome();
}

function changeChar(d) {
  charIndex = (charIndex + d + CHARACTERS.length) % CHARACTERS.length;
  audio.sfx.click();
  buildPlayer();
  const c = CHARACTERS[charIndex];
  if (save.unlocked.includes(c.id)) { save.character = c.id; persist(); if (serverEconomy()) api.equip('char', c.id); }
  renderMenu();
}

function updateHudStatic() {
  $('hBoards').textContent = save.boards;
  $('h-boardBtn').classList.toggle('active', P.onBoard);
  $('hCoins').textContent = fmt(run.coins);
}

function toggleMute() {
  const m = save.settings.music > 0 || save.settings.sfx > 0;
  if (m) { save.settings._m = [save.settings.music, save.settings.sfx]; save.settings.music = 0; save.settings.sfx = 0; }
  else { const v = save.settings._m || [0.55, 0.9]; save.settings.music = v[0]; save.settings.sfx = v[1]; }
  audio.setVolumes(save.settings.music, save.settings.sfx);
  persist();
}

function setupUI() {
  $('playBtn').onclick = () => (social ? social.onPlay() : tryPlay());
  $('prevChar').onclick = () => changeChar(-1);
  $('nextChar').onclick = () => changeChar(1);
  $('unlockBtn').onclick = async () => {
    const c = CHARACTERS[charIndex];
    if (serverEconomy()) {
      audio.initAudio();
      const r = await api.buy('char:' + c.id);
      if (r && r.json && r.json.ok) { await api.equip('char', c.id); syncEconomy(); audio.sfx.buy(); renderMenu(); } else audio.sfx.deny();
      return;
    }
    if (save.coins >= c.cost) { save.coins -= c.cost; save.unlocked.push(c.id); save.character = c.id; persist(); audio.initAudio(); audio.sfx.buy(); renderMenu(); }
    else { audio.initAudio(); audio.sfx.deny(); }
  };
  $('btnDuel').onclick = () => { audio.initAudio(); audio.sfx.click(); startDuel(); };
  let setTab = 'Gameplay';
  const drawSettings = () => {
    $('setTabs').innerHTML = SETTINGS.map((g) => `<button class="tab${g.tab === setTab ? ' sel' : ''}" data-t="${g.tab}">${g.tab.toUpperCase()}</button>`).join('');
    for (const b of $('setTabs').querySelectorAll('.tab')) b.onclick = () => { audio.sfx.click(); setTab = b.dataset.t; drawSettings(); };
    renderSettingsTab($('setBody'), setTab, save.settings, (k, v) => { save.settings[k] = v; applySettings(k); persist(); });
  };
  $('btnSettings').onclick = () => { audio.initAudio(); audio.sfx.click(); drawSettings(); show('settings', true); };
  $('btnSetClose').onclick = () => { audio.sfx.click(); show('settings', false); persist(); };
  $('btnSecret').classList.toggle('hidden', !secretUnlocked());
  $('btnSecret').onclick = () => { audio.sfx.click(); show('settings', false); drawSecret(); show('secret', true); };
  $('secClose').onclick = closeSecret;
  $('secUnload').onclick = () => { audio.sfx.click(); unloadCheats(); };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'Escape' && !$('secret').classList.contains('hidden')) { e.preventDefault(); e.stopPropagation(); closeSecret(); return; }
    if (e.key !== '²' && e.code !== 'Backquote') return;
    const t = e.target, tag = t && t.tagName;
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && !['checkbox', 'range'].includes(t.type) && t.id !== 'secSearch')) return;
    e.preventDefault(); toggleSecret();
  }, true);
  $('secReset').onclick = () => { audio.sfx.click(); resetCheats(); applyCheatVisuals(); drawSecret(); };
  konamiListener(() => { const tg = document.activeElement && document.activeElement.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return; openSecret(true); });
  $('btnExport').onclick = async () => {
    if (!online.token) { toast('Sign in first'); return; }
    const r = await api.call('GET', '/api/me/export');
    if (!r || r.status !== 200) { toast('Could not export your data'); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(r.json, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'reverse-surfers-my-data.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Your data was downloaded');
  };
  $('btnDeleteAcct').onclick = async () => {
    if (!online.token || !online.player) { toast('There is no online account to delete'); return; }
    const hasPw = !!online.player.hasAccount;
    const v = await dialog({ title: 'DELETE ACCOUNT', message: hasPw ? 'This permanently deletes your account, progress, friends and messages. Enter your password to confirm.' : 'This permanently deletes your guest account, progress, friends and messages. Type DELETE to confirm.', yes: 'DELETE FOREVER', no: 'KEEP MY ACCOUNT', danger: true, input: { placeholder: hasPw ? 'Password' : 'DELETE', password: hasPw, max: 72 } });
    if (!v) return;
    const r = await api.call('POST', '/api/me/delete', hasPw ? { password: v } : { confirm: v });
    if (!r || r.status !== 200) { toast((r && r.json && r.json.message) || 'Could not delete the account'); return; }
    try { net.close(); localStorage.clear(); } catch (e) { /* storage unavailable */ }
    location.reload();
  };
  $('btnReset').onclick = async () => { if (await confirmDlg('This erases coins, characters, upgrades and records stored on this device.', { danger: true, yes: 'ERASE' })) { resetSave(); location.reload(); } };
  initHubUI();
  onboarding = createOnboarding({ save, persist, applySettings, click: () => audio.sfx.click(), openAccount: () => { hubUI.setBarVisible(true); hubUI.open('account'); }, done: () => { renderMenu(); } });
  $('tbLang').onclick = () => { audio.initAudio(); audio.sfx.click(); openLanguagePicker({ save, persist, onChange: () => { $('tbLangCode').textContent = getLang().toUpperCase(); } }); };
  duelCtl = createDuel({ renderer, canvas, save, cheats, audio, send: (o) => net.send(o), myId: () => net.id, serverNow: api.serverNow, onEnd: showDuelResult });
  window.addEventListener('resize', () => duelCtl.resize());
  $('drHome').onclick = () => { audio.sfx.click(); show('duelres', false); if (mp.room) leaveRoom(); else enterMenu(); };
  $('drAgain').onclick = () => { audio.sfx.click(); show('duelres', false); enterArena({ online: false }); };
  $('btnPause').onclick = pause;
  $('btnResume').onclick = resume;
  $('btnRestart').onclick = () => { show('pause', false); audio.sfx.click(); restart(); };
  $('btnQuit').onclick = () => { show('pause', false); audio.sfx.click(); enterMenu(); };
  $('btnAgain').onclick = () => { show('over', false); audio.sfx.click(); restart(); };
  $('btnHome').onclick = () => { show('over', false); audio.sfx.click(); enterMenu(); };
  $('setVer').textContent = `Version ${GAME_FULL_VERSION}`;
  $('hBoardIc').innerHTML = boardSVG({ deck: '#ffffff', rail: '#1b9bd6' }, { shadow: false, tilt: -28 });
  $('h-boardBtn').onclick = () => pushAction('board');
  $('h-boardBtn').addEventListener('pointerdown', (e) => e.stopPropagation());
  $('btnRevive').onclick = revive;
  $('btnDaily').onclick = () => { const di = dailyInfo(); audio.initAudio(); mapOverride = di.map; tryPlay({ seed: di.seed, daily: true }); };
  setupOnline();
}

function restart() {
  buildPlayer();
  world.reset({ calm: true });
  menuBlend = 0; menuBlendTarget = 0;
  startRun(run.daily ? { seed: dailyInfo().seed } : {});
}


// ------------------------------------------------------------------- maps / daily
const MAP_LABELS = [...BIOME_ORDER.map((id) => [id, BIOMES[id].name, BIOMES[id].accent]), ['tour', 'World Tour', '#ffffff']];
const MAP_DESC = { tour: 'All five maps, one after the other' };
function renderMaps() {
  const el = $('mapList');
  if (!el) return;
  const cur = save.settings.map || 'city';
  const i = Math.max(0, MAP_LABELS.findIndex(([id]) => id === cur));
  const [id, name, col] = MAP_LABELS[i];
  el.innerHTML = `<div class="cycler"><button class="btn round sm" data-d="-1">&#9664;</button><div class="cycler-name"><b><i style="background:${col}"></i>${name}</b><small>${MAP_DESC[id] || BIOMES[id].desc}</small></div><button class="btn round sm" data-d="1">&#9654;</button></div>`;
  for (const b of el.querySelectorAll('button')) {
    b.onclick = () => {
      audio.initAudio(); audio.sfx.click();
      save.settings.map = MAP_LABELS[(i + Number(b.dataset.d) + MAP_LABELS.length) % MAP_LABELS.length][0];
      persist(); enterMenu();
    };
  }
}
const MODES = [['classic', 'Classic', 'Collect coins, survive as long as you can'], ['nocoin', 'No Coin', 'Touch one coin and it is over']];
function renderModes() {
  const el = $('modeList');
  if (!el) return;
  el.innerHTML = '';
  for (const [id, name, desc] of MODES) {
    const b = document.createElement('button');
    b.className = 'map-chip' + ((save.settings.mode || 'classic') === id ? ' sel' : '');
    b.innerHTML = `<i style="background:${id === 'nocoin' ? '#ff4d5e' : '#ffd23f'}"></i><span>${name}<small style="display:block;font-family:var(--body);font-size:12px;opacity:.75">${desc}</small></span>`;
    b.onclick = () => { audio.initAudio(); audio.sfx.click(); save.settings.mode = id; persist(); renderModes(); };
    el.appendChild(b);
  }
}
const todayKey = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
function dailyInfo() { const k = todayKey(); return { key: k, seed: Math.imul(k, 2654435761) >>> 0, map: BIOME_ORDER[k % BIOME_ORDER.length] }; }
function renderDaily() {
  const b = $('btnDaily');
  if (!b) return;
  const di = dailyInfo();
  const best = save.daily && save.daily.key === di.key ? save.daily.best : 0;
  b.innerHTML = 'DAILY RUN' + (best ? `<span class="badge">${fmt(best)}</span>` : '');
  b.title = `Today: ${BIOMES[di.map].name} - same track for everyone`;
}

// ------------------------------------------------------------------- gamepad
const padPrev = {};
function pollGamepad() {
  if (!navigator.getGamepads) return;
  const pad = [...navigator.getGamepads()].find((g) => g && g.connected);
  if (!pad) return;
  const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
  const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
  const cur = { left: b(14) || ax < -0.55, right: b(15) || ax > 0.55, up: b(12) || ay < -0.55 || b(0), down: b(13) || ay > 0.55 || b(1), board: b(2) || b(3) || b(5), start: b(9) };
  const edge = (k) => cur[k] && !padPrev[k];
  if (state === 'playing') {
    if (edge('left')) pushAction('left');
    if (edge('right')) pushAction('right');
    if (edge('up')) pushAction('jump');
    if (edge('down')) pushAction('roll');
    if (edge('board')) pushAction('board');
    if (edge('start')) pause();
  } else if (state === 'menu' && hubUI.tab === 'play' && !shown.lobby && !shown.shop && !shown.settings && !dlgOpen) {
    if (edge('left')) changeChar(-1);
    if (edge('right')) changeChar(1);
    if (edge('up') || edge('start')) tryPlay();
  } else if (state === 'paused' && edge('start')) resume();
  Object.assign(padPrev, cur);
}

// ------------------------------------------------------------------ multiplayer
const escapeHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function nameTag(name, color = '#fff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = '34px "Lilita One", sans-serif';
  x.textAlign = 'center';
  x.lineWidth = 8; x.strokeStyle = 'rgba(10,16,48,0.9)'; x.strokeText(name, 128, 44);
  x.fillStyle = color; x.fillText(name, 128, 44);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), applyBend(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false })));
  m.renderOrder = 5; m.frustumCulled = false;
  return fxLayer(m);
}
function isAlly(id) {
  const room = mp.room;
  if (room && room.teamMode) { const me = room.players.find((p) => p.id === net.id), him = room.players.find((p) => p.id === id); if (me && him && me.team != null && me.team === him.team) return true; }
  const party = social && social.party; if (party && room) { const him = room.players.find((p) => p.id === id); if (him && party.members.some((m) => m.name === him.name)) return true; }
  return false;
}
function ensureGhost(id) {
  let g = mp.ghosts.get(id);
  const ps = mp.players.get(id);
  const solid = isAlly(id); // your team and your party are shown as real runners, everybody else as ghosts
  if (g && g.charId === ps.char && g.solid === solid) return g;
  if (g) scene.remove(g.ch.root, g.tag);
  const def = CHARACTERS.find((c) => c.id === ps.char) || CHARACTERS[0];
  const ch = buildCharacter(def, CHAR_SCALE, { ghost: !solid });
  const tag = nameTag(ps.name, solid ? '#7ee0a0' : undefined);
  scene.add(ch.root, tag);
  g = { ch, tag, charId: ps.char, solid };
  mp.ghosts.set(id, g);
  return g;
}
function dropGhost(id) {
  const g = mp.ghosts.get(id);
  if (g) { scene.remove(g.ch.root, g.tag); mp.ghosts.delete(id); }
}
function clearGhosts() { for (const id of [...mp.ghosts.keys()]) dropGhost(id); }

function updateGhosts(dt) {
  if (!mp.active) return;
  const now = performance.now() / 1000;
  for (const [id, ps] of mp.players) {
    if (id === net.id) continue;
    const live = mp.running && ps.seen && (state === 'playing' || state === 'dying' || state === 'over');
    if (!live) {
      const g0 = mp.ghosts.get(id);
      if (g0) { g0.ch.root.visible = false; g0.tag.visible = false; }
      continue;
    }
    const g = ensureGhost(id);
    const age = Math.min(now - ps.t, 0.35);
    const rd = ps.alive ? ps.d + ps.sp * age : ps.d;
    const z = -(rd - run.dist);
    const vis = z > -150 && z < 14;
    g.ch.root.visible = vis; g.tag.visible = vis;
    if (!vis) continue;
    ps.x = damp(ps.x ?? ps.tx ?? 0, ps.tx ?? ps.x ?? 0, 22, dt); ps.y = damp(ps.y ?? ps.ty ?? 0, ps.ty ?? ps.y ?? 0, 22, dt);
    g.ch.root.position.set(ps.x, ps.y, z);
    g.ch.root.rotation.y = 0;
    const st = ps.alive ? (ps.a || 'run') : 'crash';
    poseCharacter(g.ch, { state: st, speed: ps.sp, vy: 0, vx: 0, rollP: (now * 1.6) % 1, crashT: 1 }, dt);
    g.ch.board.visible = ps.a === 'board' && ps.alive;
    g.ch.jet.visible = ps.a === 'jet' && ps.alive;
    g.tag.position.set(ps.x, ps.y + 2.5, z);
    g.tag.quaternion.copy(camera.quaternion);
  }
}

function updateMpHud(dt) {
  const box = $('h-mp');
  const on = mp.active && mp.running;
  box.classList.toggle('hidden', !on);
  $('hPing').style.display = on && online.ping != null ? '' : 'none';
  if (online.ping != null) $('hPing').textContent = `${online.ping} ms`;
  if (!on) return;
  mp.hudT -= dt;
  if (mp.hudT > 0) return;
  mp.hudT = 0.25;
  const rows = [...mp.players.values()].map((p) => (p.id === net.id
    ? { name: p.name, d: run.dist, alive: state === 'playing' || state === 'dying', me: true }
    : { name: p.name, d: p.d, alive: p.alive, me: false }));
  rows.sort((a, b) => b.d - a.d);
  if (mp.room && mp.room.teamMode) { // team race: both teams' totals on top, mine highlighted
    const sum = [0, 0]; let mine = -1;
    for (const p of mp.players.values()) { const rp = mp.room.players.find((x) => x.id === p.id); if (!rp || rp.team == null) continue; if (p.id === net.id) mine = rp.team; sum[rp.team] += p.id === net.id ? run.score : p.s; }
    const my = Math.max(0, mine);
    box.innerHTML = `<div class="tm"><span class="a">YOUR TEAM <b>${fmt(sum[my])}</b></span><span class="b"><b>${fmt(sum[1 - my])}</b> RIVALS</span></div>`
      + rows.map((r) => `<div class="r${r.me ? ' me' : ''}${r.alive ? '' : ' out'}"><span>${escapeHtml(r.name)}</span><b>${fmt(r.d)}m</b></div>`).join('');
    if (shown.mpres && mp.results == null) renderMpWait();
    return;
  }
  box.innerHTML = rows.map((r) => `<div class="r${r.me ? ' me' : ''}${r.alive ? '' : ' out'}"><span>${escapeHtml(r.name)}</span><b>${fmt(r.d)}m</b></div>`).join('');
  if (shown.mpres && mp.results == null) renderMpWait();
}

function mpSend(dt) {
  if (!mp.active || !mp.running || state !== 'playing') return;
  mp.sendT -= dt;
  if (mp.sendT > 0) return;
  mp.sendT = 0.033;
  let a = 'run';
  if (P.stumbleT > 0) a = 'stumble';
  else if (P.jetting) a = 'jet';
  else if (P.onBoard) a = 'board';
  else if (P.rolling) a = 'roll';
  else if (!P.grounded) a = 'jump';
  net.send({ t: 'st', d: +run.dist.toFixed(1), s: Math.floor(run.score), x: +P.x.toFixed(2), y: +P.y.toFixed(2), sp: +run.speed.toFixed(1), a });
}

function mpFinishLocal(finalScore) {
  net.send({ t: 'dead', d: +run.dist.toFixed(1), s: finalScore });
  const me = mp.players.get(net.id);
  if (me) { me.alive = false; me.d = run.dist; me.s = finalScore; }
  show('mpres', true);
  $('mpTitle').textContent = "YOU'RE OUT!";
  renderMpWait();
}
function renderMpWait() {
  $('mpWait').textContent = 'Waiting for the other runners...';
  const rows = [...mp.players.values()].map((p) => ({ name: p.name, d: p.id === net.id ? run.dist : p.d, alive: p.id === net.id ? false : p.alive })).sort((a, b) => b.d - a.d);
  $('mpRank').innerHTML = rows.map((r) => `<div class="lob-row"><b>${escapeHtml(r.name)}</b><span>${fmt(r.d)} m</span><span class="tag ${r.alive ? 'ok' : ''}">${r.alive ? 'RUNNING' : 'OUT'}</span></div>`).join('');
}

function setupOnline() {
  let wsAuthed = false, connecting = null; const authWaiters = [];
  const boardSel = { board: 'classic', period: 'all' };
  let searchTimer = null;

  net.on('hello', () => net.send({ t: 'auth', token: online.token, char: CHARACTERS[charIndex].id }));
  net.on('authed', (m) => { online.player = m.player; wsAuthed = true; renderProfile(); while (authWaiters.length) authWaiters.shift()(); });
  // One connection attempt at a time, shared by everybody who needs the socket (lobby, PLAY, friends, auto-connect).
  async function connectNet() {
    if (net.connected && wsAuthed) return;
    if (!connecting) {
      connecting = (async () => {
        if (!net.connected) await net.connect(api.wsUrl());
        if (!wsAuthed) await new Promise((res, rej) => {
          const f = () => { clearTimeout(to); res(); };
          const to = setTimeout(() => { const i = authWaiters.indexOf(f); if (i >= 0) authWaiters.splice(i, 1); rej(new Error('Authentication timed out')); }, 7000);
          authWaiters.push(f);
        });
      })().finally(() => { connecting = null; });
    }
    await connecting;
  }

  async function connectOnline() {
    if (tainted()) throw new Error('Secret Menu options are active - turn them off to play online');
    const name = ($('lobName').value || 'Runner').trim().slice(0, 14);
    save.mpName = name; persist();
    $('lobErr').textContent = 'Connecting...';
    const p = await api.ensureAccount(name);
    if (!p) throw new Error('Could not reach the server');
    await connectNet();
    $('lobErr').textContent = '';
  }
  const go = async (kind) => {
    try { await connectOnline(); net.send({ t: kind, name: online.player.name, char: CHARACTERS[charIndex].id, code: $('lobCode').value.trim().toUpperCase() }); }
    catch (e) { $('lobErr').textContent = e.message; }
  };

  queueDuelRef = async () => { await connectOnline(); net.send({ t: 'dq', char: CHARACTERS[charIndex].id }); };
  // Online without the lobby form: the account name comes from the save (guests get one on the fly).
  async function ensureOnline() {
    if (tainted()) throw new Error('Secret Menu options are active - turn them off to play online');
    const name = (save.mpName || (online.player && online.player.name) || CHARACTERS[charIndex].name).trim().slice(0, 14);
    const p = await api.ensureAccount(name);
    if (!p) throw new Error('Could not reach the server');
    await connectNet();
  }
  ensureOnlineRef = ensureOnline;
  social = initSocial({ inRace: () => mp.active, $, api, net, online, save, persist, audio, dialog, toast, show, CHARACTERS, charId: () => CHARACTERS[charIndex].id, ensureOnline, startDuel, startOffline: () => tryPlay(), tainted });
  $('btnOnline').onclick = async () => {
    audio.initAudio(); audio.sfx.click();
    $('lobName').value = save.mpName || CHARACTERS[charIndex].name;
    $('lobErr').textContent = '';
    showTab('play');
    if (!mp.room) showLobbyView('connect');
    show('lobby', true);
    if (!online.player) { await api.ensureAccount($('lobName').value); renderProfile(); }
  };
  $('btnLobClose').onclick = () => { audio.sfx.click(); show('lobby', false); };
  $('btnQuick').onclick = () => go('quick');
  $('btnCreate').onclick = () => go('create');
  $('btnJoin').onclick = () => { if (!$('lobCode').value.trim()) { $('lobErr').textContent = 'Enter a room code'; return; } go('join'); };
  $('btnRanked').onclick = async () => {
    try { await connectOnline(); net.send({ t: 'rq', mode: save.settings.mode === 'nocoin' ? 'nocoin' : 'classic', char: CHARACTERS[charIndex].id }); }
    catch (e) { $('lobErr').textContent = e.message; }
  };
  $('btnCancelSearch').onclick = () => { net.send({ t: 'rc' }); };
  $('btnReady').onclick = () => { const me = mp.players.get(net.id); net.send({ t: 'ready', v: !(me && me.ready) }); audio.sfx.click(); };
  $('btnStartRace').onclick = () => { audio.sfx.click(); net.send({ t: 'start' }); };
  $('btnLeaveRoom').onclick = () => leaveRoom();
  $('lobMap').onchange = (e) => net.send({ t: 'map', map: e.target.value });
  $('lobMap').innerHTML = MAP_LABELS.map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
  $('btnMpLobby').onclick = () => { show('mpres', false); if (mp.room && mp.room.ranked) { leaveRoom(); return; } if (mp.room && mp.room.host === net.id) net.send({ t: 'lobby' }); mpToLobby(); };
  $('btnMpLeave').onclick = () => { show('mpres', false); leaveRoom(); };
  $('btnRename').onclick = () => renameFlow();
  $('tabBtnPlay').onclick = () => showTab('play');
  $('tabBtnBoard').onclick = () => { showTab('board'); loadBoard(); };

  function showTab(t) {
    $('tabPlay').style.display = t === 'play' ? '' : 'none';
    $('tabBoard').style.display = t === 'board' ? '' : 'none';
    $('tabBtnPlay').classList.toggle('sel', t === 'play');
    $('tabBtnBoard').classList.toggle('sel', t === 'board');
  }
  function showLobbyView(v) {
    $('lobConnect').style.display = v === 'connect' ? '' : 'none';
    $('lobSearch').style.display = v === 'search' ? '' : 'none';
    $('lobRoom').style.display = v === 'room' ? '' : 'none';
  }
  showLobbyViewRef = showLobbyView;

  const BOARDS = [['classic', 'Classic'], ['nocoin', 'No Coin'], ['daily', 'Daily'], ['ranked', 'Ranked']];
  const PERIODS = [['all', 'All time'], ['week', 'This week'], ['day', 'Today']];
  async function loadBoard() {
    const chips = (list, key) => list.map(([id, label]) => `<button class="map-chip${boardSel[key] === id ? ' sel' : ''}" data-k="${key}" data-v="${id}" style="width:auto;display:inline-flex;margin:3px"><i style="background:${key === 'board' ? '#ffd23f' : '#9ad7ff'}"></i>${label}</button>`).join('');
    $('boardChips').innerHTML = chips(BOARDS, 'board');
    $('periodChips').innerHTML = boardSel.board === 'classic' || boardSel.board === 'nocoin' ? chips(PERIODS, 'period') : '';
    for (const b of document.querySelectorAll('#tabBoard .map-chip')) b.onclick = () => { boardSel[b.dataset.k] = b.dataset.v; loadBoard(); };
    $('boardRows').innerHTML = '<div class="stage-note">Loading...</div>';
    const d = await api.leaderboard(boardSel.board, boardSel.period);
    if (!d) { $('boardRows').innerHTML = '<div class="stage-note">Server unreachable - leaderboards need the online server.</div>'; return; }
    const you = online.player ? online.player.name : '';
    const rows = d.rows.map((r) => `<div class="lob-row${r.name === you ? ' me' : ''}"><b style="min-width:42px">#${r.rank}</b><b style="flex:1">${escapeHtml(r.name)}</b>${r.tier ? `<span class="tag">${r.tier}</span>` : ''}<span style="font-family:var(--font);color:var(--yellow)">${fmt(r.score)}</span>${r.dist != null ? `<span style="opacity:.7;font-size:15px">${fmt(r.dist)}m</span>` : `<span style="opacity:.7;font-size:15px">${r.wins}/${r.games}</span>`}</div>`).join('');
    const yours = d.you ? `<div class="stage-note">Your best: <b style="color:var(--yellow)">${fmt(d.you.score)}</b>${d.you.rank ? ` (rank #${d.you.rank})` : ''}</div>` : '';
    $('boardRows').innerHTML = yours + (rows || '<div class="stage-note">No scores yet - be the first!</div>');
  }

  net.on('queued', (m) => {
    showLobbyView('search');
    const t0 = performance.now();
    clearInterval(searchTimer);
    $('srchNote').textContent = `Looking for runners near ${m.rating} (${m.tier})...`;
    searchTimer = setInterval(() => { const s = Math.floor((performance.now() - t0) / 1000); $('srchTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 250);
  });
  net.on('searching', (m) => { $('srchNote').textContent = `Search range +/-${m.range} - ${m.found} runner${m.found > 1 ? 's' : ''} in range`; });
  net.on('queue_cancelled', () => { clearInterval(searchTimer); showLobbyView('connect'); });
  net.on('match', (m) => {
    clearInterval(searchTimer);
    $('srchTime').textContent = 'MATCH!';
    $('srchNote').textContent = m.players.map((p) => `${p.name} (${p.rating})`).join('  vs  ');
    audio.sfx.power();
  });

  net.on('room', (m) => {
    mp.room = m;
    for (const p of m.players) {
      const old = mp.players.get(p.id) || { d: 0, s: 0, x: 0, y: 0, sp: 17, a: 'run', t: performance.now() / 1000, seen: false };
      mp.players.set(p.id, { ...old, id: p.id, name: p.name, char: p.char, ready: p.ready, alive: p.alive, rating: p.rating, d: p.alive ? old.d : p.d, s: p.alive ? old.s : p.s });
    }
    for (const id of [...mp.players.keys()]) if (!m.players.some((p) => p.id === id)) { mp.players.delete(id); dropGhost(id); }
    if (!mp.running) renderLobby();
  });
  net.on('start', (m) => startMpRace(m));
  net.on('st', (m) => {
    const p = mp.players.get(m.id);
    if (!p) return;
    Object.assign(p, { d: m.d, s: m.s, tx: m.x, ty: m.y, sp: m.sp, a: m.a, t: performance.now() / 1000, seen: true });
    if (p.x === undefined || !p.sx) { p.x = m.x; p.y = m.y; p.sx = true; }
  });
  net.on('dead', (m) => { const p = mp.players.get(m.id); if (p) { p.alive = false; p.d = m.d; p.s = m.s; } });
  net.on('left', (m) => { mp.players.delete(m.id); dropGhost(m.id); });
  net.on('results', (m) => {
    mp.results = m.ranking;
    mp.running = false;
    show('hud', false); show('mpres', true);
    const myRank = m.ranking.findIndex((r) => r.id === net.id) + 1;
    if (m.teamMode) { // 2 v 2 / 3 v 3: the team total decides
      const mine = (m.ranking.find((r) => r.id === net.id) || {}).team, other = 1 - mine;
      const w = m.winner;
      $('mpTitle').textContent = w === -1 ? 'DRAW' : w === mine ? 'VICTORY' : 'DEFEAT';
      $('mpWait').textContent = m.ranked ? 'Updating your rating...' : `${fmt(m.teams[mine].score)} - ${fmt(m.teams[other].score)}`;
      $('mpRank').innerHTML = [mine, other].map((ti) => `<div class="lob-row team${ti === mine ? ' me' : ''}"><b>${ti === mine ? 'YOUR TEAM' : 'RIVALS'}</b><span style="color:var(--yellow);font-family:var(--font)">${fmt(m.teams[ti].score)} pts</span></div>${m.ranking.filter((r) => r.team === ti).map((r) => `<div class="lob-row${r.id === net.id ? ' me' : ''}"><b>${escapeHtml(r.name)}</b><span>${fmt(r.s)} pts / ${fmt(r.d)} m</span>${r.dq ? '<span class="tag">DQ</span>' : ''}</div>`).join('')}`).join('');
      if (state === 'dying' || state === 'playing') state = 'over';
      audio.setMood('menu'); audio.stopWind();
      return;
    }
    $('mpTitle').textContent = myRank === 1 ? 'YOU WIN!' : `RACE OVER - #${myRank}`;
    $('mpWait').textContent = m.ranked ? 'Updating your rating...' : (myRank === 1 ? 'Best score on the track!' : '');
    $('mpRank').innerHTML = m.ranking.map((r, i) => `<div class="lob-row${r.id === net.id ? ' me' : ''}"><b>#${i + 1} ${escapeHtml(r.name)}</b><span>${fmt(r.s)} pts / ${fmt(r.d)} m</span>${r.dq ? '<span class="tag">DQ</span>' : ''}</div>`).join('');
    if (state === 'dying' || state === 'playing') state = 'over';
    audio.setMood('menu'); audio.stopWind();
  });
  net.on('rating', (m) => {
    $('mpWait').innerHTML = `${m.delta >= 0 ? '+' : ''}${m.delta} rating &rarr; <b style="color:var(--yellow)">${fmt(m.after)}</b> (${m.tier})${m.dq ? ' - disqualified' : ''}`;
    if (online.player) { online.player.rating = m.after; online.player.tier = m.tier; renderProfile(); }
    audio.sfx[m.delta >= 0 ? 'mission' : 'deny']();
  });
  net.on('pong', (m) => { online.ping = Math.max(0, Date.now() - m.c); });
  net.on('err', (m) => { $('lobErr').textContent = m.msg; if (m.code === 'vpn_blocked') showVpnBlocked(online.vpn || {}); });
  net.on('warp', () => { if (mp.active && ['playing', 'dying', 'over'].includes(state)) beginWarp(true); });
  net.on('resume', (m) => { duelResume = m; maybeResume(); });
  net.on('duel', (m) => {
    if (m.phase === 'start') {
      const mine = m.players.find((p) => p.id === net.id), foe = m.players.find((p) => p.id !== net.id) || {};
      show('lobby', false); show('mpres', false);
      enterArena({ online: true, inRun: true, spawn: mine ? mine.spawn : 0, foeName: foe.name, foeChar: foe.char, liveIn: m.countdown });
    } else duelCtl.onNet('duel', m);
  });
  for (const tp of ['ds', 'dfire', 'dhit', 'dfix', 'dend']) net.on(tp, (m) => duelCtl.onNet(tp, m));
  net.on('duel_nomatch', () => { clearInterval(searchTimer); showLobbyView('connect'); show('lobby', false); toast('No opponent found - practice duel'); startSoloDuelRun(); });
  net.on('kick', (m) => { if (state === 'duel') { duelCtl.stop(); show('duelres', false); } showSanction({ error: m.banned ? 'banned' : 'kicked', reason: m.reason, until: m.until }); if (mp.active) leaveRoom(true); });
  net.on('close', () => {
    clearInterval(searchTimer);
    if (state === 'duel' || state === 'duelres') { duelCtl.stop(); show('duelres', false); toast('Disconnected'); mp.active = false; mp.running = false; mp.room = null; enterMenu(); return; }
    if (mp.active) { toast('Disconnected'); leaveRoom(true); }
    else { mp.room = null; showLobbyView('connect'); }
  });
  net.also('close', () => { wsAuthed = false; connecting = null; });
  setInterval(() => { if (net.connected) net.send({ t: 'ping', c: Date.now() }); }, 2000);

  // silent boot: resume the account if a server is reachable
  bootOnline();
  setInterval(async () => { if (state === 'menu') { if (await api.events()) hubUI.refreshChrome(); checkAppeals(); } }, 60000); // event windows flip at midnight UTC
}

// ---------------------------------------------------------------- hub / economy / cloud / sanctions
let hubUI = { tab: 'play', open() {}, setBarVisible() {}, refreshChrome() {}, checkUpdates() {}, toast() {} }; // replaced by initHub()
const serverEconomy = () => !!(online.player && online.inv);
function renderMenuChrome() { try { hubUI.refreshChrome(); } catch (e) { /* hub not ready */ } }

// When signed in (guest or account) the server owns coins, boards, upgrades, runners and cosmetics: mirror it locally.
function syncEconomy() {
  if (!serverEconomy()) return;
  const inv = online.inv;
  save.coins = online.wallet; save.boards = inv.boards; save.upgrades = { ...save.upgrades, ...inv.up };
  save.unlocked = [...inv.chars]; save.cos = [...inv.cos]; save.equip = { ...inv.equip };
  const i = CHARACTERS.findIndex((c) => c.id === inv.equip.char);
  if (i >= 0 && inv.chars.includes(inv.equip.char)) { const changed = charIndex !== i; charIndex = i; save.character = inv.equip.char; if (changed || true) buildPlayer(); }
  persist(); renderMenuChrome(); if (typeof renderProfile === 'function') renderProfile();
}

const cloud = { ver: 0, timer: null, status: 'guest', last: 0, busy: false };
const CLOUD_KEYS = ['settings', 'level', 'missions', 'stats', 'best', 'bestDist', 'bestCoins', 'tutorialDone', 'daily', 'mpName'];
function cloudData() {
  const d = {};
  for (const k of CLOUD_KEYS) if (save[k] !== undefined && save[k] !== null) d[k] = save[k];
  if (d.settings) { d.settings = { ...d.settings }; delete d.settings._m; }
  return d;
}
function cloudMerge(d) { // cloud -> local: preferences come from the cloud, records keep the best of both
  if (!d) return;
  if (d.settings) Object.assign(save.settings, d.settings);
  for (const k of ['best', 'bestDist', 'bestCoins', 'level']) if (typeof d[k] === 'number') save[k] = Math.max(save[k] || 0, d[k]);
  if (d.stats) for (const k of Object.keys(d.stats)) if (typeof d.stats[k] === 'number') save.stats[k] = Math.max(save.stats[k] || 0, d.stats[k]);
  if (d.tutorialDone) save.tutorialDone = true;
  if (d.mpName) save.mpName = d.mpName;
  if (d.missions && !save.missions) save.missions = d.missions;
  if (d.daily && (!save.daily || save.daily.key < d.daily.key || (save.daily.key === d.daily.key && save.daily.best < d.daily.best))) save.daily = d.daily;
}
async function cloudPull() {
  if (!online.player || !online.player.hasAccount) { cloud.status = 'guest'; return; }
  const r = await api.getCloud();
  if (!r || r.status !== 200) { cloud.status = 'offline'; return; }
  cloud.ver = r.json.ver; cloudMerge(r.json.data);
  audio.setVolumes(save.settings.music, save.settings.sfx); applyQuality(); applyOutline();
  cloud.status = 'synced'; cloud.last = Date.now();
}
async function cloudPush(force = false) {
  if (!online.player || !online.player.hasAccount || (cloud.busy && !force)) return;
  cloud.busy = true;
  try {
    for (let i = 0; i < 2; i++) {
      const r = await api.putCloud(cloud.ver, cloudData());
      if (!r) { cloud.status = 'offline'; return; }
      if (r.status === 200) { cloud.ver = r.json.ver; cloud.status = 'synced'; cloud.last = Date.now(); return; }
      if (r.status === 409) { cloud.ver = r.json.ver; cloudMerge(r.json.data); continue; } // another device saved first: merge, retry
      cloud.status = 'error'; return;
    }
  } finally { cloud.busy = false; }
}
const cloudStatus = () => ({ guest: 'Not signed in', offline: 'Offline', error: 'Error', synced: `Synced ${new Date(cloud.last).toLocaleTimeString()}` })[cloud.status] || cloud.status;
setPersistHook(() => { if (online.player && online.player.hasAccount) { clearTimeout(cloud.timer); cloud.timer = setTimeout(() => cloudPush(), 4000); } });

async function bootOnline() {
  if (!(await api.health())) { renderMenuChrome(); return false; }
  await api.ensureAccount(save.mpName || 'Runner');
  if (online.vpn) { renderMenuChrome(); showVpnBlocked(online.vpn); return false; }
  await api.events();
  syncEconomy(); await cloudPull(); renderProfile();
  afterLogin(); checkAppeals();
  if (state === 'menu') renderMenu();
  hubUI.checkUpdates();
  const p = online.player;
  if (p && (p.banned || p.kickedUntil)) showSanction({ error: p.banned ? 'banned' : 'kicked', reason: p.banReason || 'Fair-play violation', until: p.kickedUntil });
  else if (p && ensureOnlineRef && !tainted()) ensureOnlineRef().catch(() => { /* the socket reconnects on its own */ }); // friends, invites and presence need the live connection
  return true;
}
async function onSignedIn(importedCoins) {
  await api.events(); syncEconomy(); await cloudPull(); renderProfile(); renderMenu(); afterLogin();
  if (importedCoins) notify('PROGRESS IMPORTED', `Your offline progress was carried over (up to ${fmt(importedCoins)} coins - the import is capped).`);
}
async function signOut() { await cloudPush(true); await api.logout(); net.close(); cloud.status = 'guest'; cloud.ver = 0; renderProfile(); renderMenuChrome(); await api.ensureAccount(save.mpName || 'Runner'); syncEconomy(); renderMenu(); }
async function renameFlow() {
  const n = await dialog({ title: 'DISPLAY NAME', message: 'Shown on leaderboards and in races (14 characters max).', yes: 'SAVE', input: { value: online.player ? online.player.name : '', max: 14, placeholder: 'Your name' }, validate: (v) => (v.trim().length < 2 ? 'At least 2 characters' : '') });
  if (!n || !n.trim()) return;
  await api.ensureAccount(n);
  if (online.player) { const r = await api.rename(n.trim().slice(0, 14)); if (r && r.status !== 200) notify('NAME NOT ALLOWED', (r.json && r.json.message) || 'Pick another name.'); }
  renderProfile(); renderMenuChrome();
}
// ---------------------------------------------------------------- Spray Secret Menu
let secGroup = 'Player';
function applyCheatVisuals() {
  const f = [];
  if (cheats.grayscale) f.push('grayscale(1)');
  if (cheats.sepia) f.push('sepia(1)');
  if (cheats.invert) f.push('invert(1)');
  if (cheats.vivid) f.push('saturate(1.7) contrast(1.1)');
  if (cheats.disco) f.push(`hue-rotate(${Math.floor((time * 70) % 360)}deg)`);
  canvas.style.filter = f.join(' ');
  canvas.style.transform = [cheats.mirror ? 'scaleX(-1)' : '', cheats.upsideDown ? 'rotate(180deg)' : ''].filter(Boolean).join(' ');
  canvas.style.imageRendering = cheats.retro ? 'pixelated' : '';
  const want = cheats.retro ? 0.22 : 1;
  if (applyCheatVisuals.rs !== want) { applyCheatVisuals.rs = want; pixelExtra = want; applyPixelRatio(); }
  scene.overrideMaterial = cheats.wireframe ? (applyCheatVisuals.wire ||= new THREE.MeshBasicMaterial({ color: 0x66ffcc, wireframe: true })) : null;
  $('hud').classList.toggle('nohud', !!cheats.hideHud);
  $('h-cheat').classList.toggle('hidden', !(run.cheated || (cheats.bot && cheats.botTag)) || state === 'menu');
  $('dbgPanel').classList.toggle('hidden', !cheats.debug);
}
let secQuery = '', secPaused = false;
function drawSecret() {
  $('secTabs').innerHTML = CHEAT_GROUPS.map((g) => { const n = groupActive(g); return `<button class="tab${g === secGroup && !secQuery ? ' sel' : ''}" data-g="${g}">${g.toUpperCase()}${n ? `<b class="tabn">${n}</b>` : ''}</button>`; }).join('');
  for (const b of $('secTabs').querySelectorAll('.tab')) b.onclick = () => { audio.sfx.click(); secGroup = b.dataset.g; secQuery = ''; $('secSearch').value = ''; drawSecret(); };
  $('secSearch').oninput = () => { secQuery = $('secSearch').value; drawSecret(); };
  renderCheatGroup($('secBody'), secGroup, () => { applyCheatVisuals(); updateSecretNote(); drawSecretTabs(); }, onCheatButton, secQuery);
  updateSecretNote();
}
function drawSecretTabs() { for (const b of $('secTabs').querySelectorAll('.tab')) { const n = groupActive(b.dataset.g); let t = b.querySelector('.tabn'); if (n && !t) { t = document.createElement('b'); t.className = 'tabn'; b.appendChild(t); } if (t) { if (n) t.textContent = n; else t.remove(); } } }
function updateSecretNote() {
  const n = activeCount(), practice = tainted();
  $('secUnload').classList.toggle('hidden', !practice && !n); // visible as soon as anything is on: one click and online play is back
  $('secReset').textContent = n ? `RESET ALL (${n} ON)` : 'RESET ALL';
  $('secNote').className = `stage-note${practice ? ' warn' : ''}`;
  $('secNote').textContent = practice ? 'Practice session: nothing you do now is banked, submitted or ranked, and online play is blocked.' : 'Visual options are free. Any option that changes gameplay turns the run into a practice run: nothing banked, submitted or ranked.';
}
// ² (the key left of 1 on AZERTY; the backtick key elsewhere) opens and closes the menu once it is unlocked, even in a run (it pauses).
function toggleSecret() {
  if (!secretUnlocked() || dlgOpen || state === 'loading' || state === 'duel') return;
  if (!$('secret').classList.contains('hidden')) { closeSecret(); return; }
  if (!$('onboard').classList.contains('hidden')) return;
  if (state === 'playing') { pause(); secPaused = state === 'paused'; }
  audio.sfx.click(); drawSecret(); show('secret', true); $('secSearch').value = secQuery;
}
function closeSecret() { audio.sfx.click(); show('secret', false); applyCheatVisuals(); if (secPaused) { secPaused = false; if (state === 'paused') toast('Paused - press P or tap Resume'); } canvas.focus(); }
// Turns every option off (bot included) so the session is no longer a practice session: online play and ranked work again.
function unloadCheats() {
  const inRun = state === 'playing' || (state === 'paused' && secPaused) || state === 'dying';
  resetCheats(); botOn = false; applyCheatVisuals(); drawSecret();
  $('h-cheat').classList.toggle('hidden', !(run.cheated && inRun));
  toast(inRun ? 'Unloaded - this run stays practice, start a new one to play online' : 'Unloaded - online play and ranked are available again');
}
function onCheatButton(id) {
  audio.sfx.click();
  if (id === 'unload') { unloadCheats(); return; }
  if (id === 'resetAll') { resetCheats(); applyCheatVisuals(); drawSecret(); return; }
  if (id === 'lockMenu') { setSecretUnlocked(false); show('secret', false); $('btnSecret').classList.add('hidden'); return; }
  if (state !== 'playing' && !(state === 'paused' && secPaused)) { notify('START A RUN FIRST', 'This button acts on a run in progress. Press PLAY, then open this menu with ² (the game pauses).'); return; }
  run.cheated = true; $('h-cheat').classList.remove('hidden');
  if (id === 'actJet') activatePower('jetpack');
  else if (id === 'actMagnet') activatePower('magnet');
  else if (id === 'actBoard') { P.onBoard = true; P.boardT = cheats.boardTime; updateHudStatic(); }
  else if (id === 'instantDie') { show('secret', false); die('manual'); }
}
function openSecret(first) {
  if (dlgOpen || state === 'playing' || state === 'loading') return;
  if (!secretUnlocked()) {
    setSecretUnlocked(true); $('btnSecret').classList.remove('hidden');
    notify('SECRET MENU UNLOCKED', 'Welcome to the Spray Secret Menu: 65+ options to play with. Press ² (the key left of 1) anywhere to open or close it, even during a run. Anything that changes gameplay makes the run a practice run - nothing is banked, submitted or ranked.');
    return;
  }
  drawSecret(); show('secret', true);
}
// ---------------------------------------------------------------- VPN / device / appeals
let vpnShown = 0;
function showVpnBlocked(info) {
  if (Date.now() - vpnShown < 4000) return;
  vpnShown = Date.now();
  dialog({ title: 'VPN DETECTED', message: `${info && info.brand ? 'Network: ' + info.brand + '. ' : ''}A VPN, proxy or datacenter connection was detected, so online play is disabled. Turn it off and retry. Offline play still works.`, yes: 'RETRY', no: 'PLAY OFFLINE' })
    .then((retry) => { if (retry) { online.vpn = null; bootOnline(); } });
}
async function afterLogin() {
  const r = await api.reportDevice(true).catch(() => null);
  if (r && r.restricted) showSanction({ error: 'kicked', reason: 'This device is linked to a suspended account.', until: Date.now() + 3600e3 });
  else if (r && r.network && r.network.blocked) showVpnBlocked({ brand: r.network.brand });
}
async function checkAppeals() {
  if (!online.player || !online.token) return;
  const d = await api.appeals();
  if (!d) return;
  const seen = save.seenAppeals || (save.seenAppeals = []);
  for (const a of d.appeals) {
    if (a.status !== 'decided' || seen.includes(a.id) || Date.now() - a.decided > 7 * 86400e3) continue;
    seen.push(a.id); persist();
    await api.refreshMe(); renderProfile(); renderMenuChrome();
    await notify(a.decision === 'overturned' ? 'APPEAL APPROVED' : 'APPEAL REVIEWED', a.decision === 'overturned' ? `Appeal #${a.id}: the sanction was overturned. Your access is restored.` : `Appeal #${a.id}: the sanction stands.`);
  }
}
let sanctionShown = 0;
function showSanction(info) {
  if (!info || Date.now() - sanctionShown < 4000) return;
  sanctionShown = Date.now();
  const banned = info.error === 'banned';
  dialog({ title: banned ? 'ACCOUNT SUSPENDED' : 'REMOVED FROM ONLINE PLAY', message: `${info.reason || 'Fair-play violation.'}${info.until ? ` You can play online again at ${new Date(info.until).toLocaleTimeString()}.` : ''}\nSolo play still works. If you think this is a mistake, open a request in Support.`, yes: 'CONTEST', no: 'CLOSE' })
    .then((go) => { if (go) hubUI.openAppeals(); });
}
// ---------------------------------------------------------------- Gold Rush duel (limited-time mode)
async function startDuel() {
  if (state !== 'menu') return;
  audio.initAudio(); audio.resumeAudio();
  const p = online.player;
  if (p && online.token && !tainted() && !p.banned && !p.kickedUntil) {
    try {
      if (await api.health()) { hubUI.setBarVisible(false); $('lobName').value = save.mpName || CHARACTERS[charIndex].name; $('lobErr').textContent = ''; show('lobby', true); await queueDuelRef(); return; }
    } catch (e) { show('lobby', false); hubUI.setBarVisible(true); toast(String(e.message || e)); return; }
  }
  startSoloDuelRun();
}
function startSoloDuelRun() { show('lobby', false); hubUI.setBarVisible(false); tryPlay({ ltm: 'goldrush' }); }
function beginWarp(onlineMatch) {
  run.warping = true; $('warp').classList.add('on'); audio.sfx.warp(); toast('GOLD RUSH!');
  if (!onlineMatch) setTimeout(() => { $('warp').classList.remove('on'); if (state === 'playing') enterArena({ online: false, inRun: true }); }, 1500);
}
function enterArena(o) {
  $('warp').classList.remove('on');
  duelInfo = { inRun: !!o.inRun, online: !!o.online, wasDead: state === 'dying' || state === 'over' };
  duelResume = null; duelBannerDone = false;
  show('hud', false); show('pause', false); show('menu', false); show('over', false); show('mpres', false); hubUI.setBarVisible(false);
  state = 'duel'; audio.stopWind(); audio.setMood('menu');
  duelCtl.start({ online: !!o.online, spawn: o.spawn || 0, meName: (online.player && online.player.name) || 'YOU', foeName: o.foeName || 'GOLD BOT', foeChar: o.foeChar || (CHARACTERS[(charIndex + 3) % CHARACTERS.length]).id, liveIn: o.liveIn ?? 3, level: o.level });
  canvas.focus();
}
let duelInfo = null, duelResume = null, duelBannerDone = false;
// Result inside a game: a short banner, then the race goes on (with the winner's reward).
function duelBanner(r) {
  duelCtl.stop(); state = 'paused'; show('hud', true); duelBannerDone = false; duelLast = r;
  $('drbT').textContent = { win: 'VICTORY', lose: 'DEFEAT', draw: 'DRAW' }[r.result];
  $('drbT').className = 'ink ' + r.result;
  $('drbS').textContent = r.result === 'win' ? (r.online ? 'First blood!' : 'You win the Gold Rush!') : r.result === 'draw' ? 'Nobody went down. The race goes on.' : 'Back to the track.';
  $('drBanner').classList.remove('hidden');
  audio.sfx[r.result === 'win' ? 'mission' : r.result === 'lose' ? 'deny' : 'click']();
  setTimeout(() => { duelBannerDone = true; maybeResume(); }, 2300);
  if (r.online) setTimeout(() => { if (state === 'paused' && !duelResume) { duelResume = { winner: null, boost: null, first: false, fallback: true }; maybeResume(); } }, 6500);
}
let duelLast = null;
function maybeResume() {
  if (!duelInfo || !duelInfo.inRun || state !== 'paused' || !duelBannerDone) return;
  const r = duelLast || { result: 'draw' };
  const rs = duelInfo.online ? duelResume : { winner: r.result === 'win' ? 'me' : null, first: false, boost: r.result === 'win' ? { sec: 8, speed: 1.25, noCoinsSec: 8, secondLife: true } : null };
  if (!rs) return;
  $('drBanner').classList.add('hidden');
  const mine = rs.winner !== null && (rs.winner === 'me' || rs.winner === net.id);
  if (!duelInfo.online && run.deathSaved && r.result !== 'win') { run.deathSaved = false; state = 'playing'; run.warping = false; duelInfo = null; die('crash'); return; } // the saved crash comes back
  run.deathSaved = false; run.warping = false; run.duelCount = (run.duelCount || 0) + 1; run.warpAt = run.t + 40 + Math.random() * 45;
  const wasDead = duelInfo.wasDead;
  duelInfo = null;
  if (wasDead && !(mine && rs.boost)) { state = 'over'; show('hud', false); show('mpres', true); $('mpTitle').textContent = 'YOU ARE OUT'; $('mpWait').textContent = 'Waiting for the race to end...'; return; }
  // back on the track
  state = 'playing'; show('hud', true); show('mpres', false);
  audio.setMood('play'); audio.startWind();
  Object.assign(P, { inv: 3.5, bump: 1, stumbleT: 0, jetting: false, vy: 0, y: P.ground, grounded: true, rolling: false, rollT: 0, h: C.PLAYER_H });
  world.clearAhead(70); G.active = false; G.shown = false; guard.root.visible = false; dog.root.visible = false; $('h-guard').classList.remove('on');
  if (wasDead) run.speed = C.SPEED_START;
  if (mine && rs.first) { toast('NEW BADGE: GOLD EAGLE!'); hubUI.toast('Profile badge unlocked: Gold Eagle'); api.refreshMe().then(() => renderMenuChrome()); }
  else if (mine && rs.boost) { run.boostT = rs.boost.sec; run.boostMul = rs.boost.speed; run.noCoinsT = rs.boost.noCoinsSec; P.secondLife = rs.boost.secondLife; toast('BOOST + SECOND LIFE!'); audio.sfx.power(); }
  updateHudStatic();
}
function showDuelResult(r) {
  if (duelInfo && duelInfo.inRun && (r.reason === 'kill' || r.reason === 'timeout')) return duelBanner(r);
  duelInfo = null;
  duelCtl.stop(); state = 'duelres';
  $('drTitle').textContent = { win: 'VICTORY', lose: 'DEFEAT', draw: 'DRAW' }[r.result];
  $('drTitle').className = 'ink ' + r.result;
  $('drSub').textContent = r.result === 'draw' ? 'Time is up and nobody went down: it is a draw.' : r.reason === 'forfeit' ? 'Your opponent left the arena.' : r.reason === 'forfeit_cheat' ? 'Your opponent was removed by fair play.' : r.result === 'win' ? 'You took the Gold Eagle crown.' : 'You were eliminated.';
  $('drStats').innerHTML = `<div class="stat"><span>Shots</span><b>${r.stats.shots}</b></div><div class="stat"><span>Hits</span><b>${r.stats.hits} (${r.stats.acc}%)</b></div><div class="stat"><span>Headshots</span><b>${r.stats.head}</b></div><div class="stat"><span>Damage dealt</span><b>${Math.round(r.stats.dmg)}</b></div><div class="stat"><span>Your HP / theirs</span><b>${r.hp} / ${r.foeHp}</b></div>${r.online ? '' : '<div class="stage-note">Practice duel - nothing is banked.</div>'}`;
  $('drAgain').style.display = r.online ? 'none' : '';
  audio.sfx[r.result === 'win' ? 'mission' : r.result === 'lose' ? 'deny' : 'click']();
  show('duelres', true);
  if (r.result === 'win') setTimeout(confetti, 300);
}
function initHubUI() {
  hubUI = initHub({
    api, save, persist, audio, dialog, notify, confirm: confirmDlg, CHARACTERS, BIOMES,
    syncEconomy, refresh: () => { if (state === 'menu') renderMenu(); }, reconnect: bootOnline,
    onPlayTab: () => { show('menu', true); }, onHubOpen: () => { show('menu', false); },
    startDuel: () => startDuel(), rename: renameFlow, cloudStatus, cloudPush, signOut, onSignedIn,
  });
}

function renderProfile() {
  if (social) social.refresh();
  const p = online.player;
  $('pfName').textContent = p ? p.name : 'Offline';
  $('pfTier').textContent = p ? p.tier : '-';
  $('pfRating').textContent = p ? fmt(p.rating) : '-';
  const rk = p && p.ranked, rn = $('rankedNote');
  if (rn) { const min = rk ? Math.round(rk.minSeconds / 60) : 0; rn.textContent = !rk ? '' : rk.unlocked ? 'Ranked unlocked' : `Ranked unlocks after ${min} min of play - ${Math.min(min, Math.floor(rk.played / 60))}/${min} min`; }
  const rb = $('btnRanked'); if (rb) rb.disabled = !!(rk && !rk.unlocked);
  const pill = $('mOnline');
  if (pill) pill.innerHTML = p ? `<span class="dotlive"></span>${escapeHtml(p.name)} &middot; ${fmt(p.rating)} ${p.tier}` : '<span class="dotlive off"></span>Offline';
}

let showLobbyViewRef = () => {};

async function submitRun() {
  if (run.cheated) { $('oOnline').textContent = 'Practice run (Secret Menu options active) - nothing was banked or submitted'; return; }
  if (online.submitted || !online.ticket || mp.active) { $('oOnline').textContent = online.token ? '' : 'Offline - score not submitted'; return; }
  online.submitted = true;
  $('oOnline').textContent = 'Submitting score...';
  const r = await api.finishRun({
    ticket: online.ticket, score: Math.floor(run.lbScore), dist: Math.floor(run.dist), coins: run.coins, time: +run.t.toFixed(2),
    stats: { jumps: run.jumps, rolls: run.rolls, lanes: run.lanes, boards: run.boards, revives: run.revives || 0, chestBoards: run.chestBoards || 0 }, input: { n: run.in.n, fast: run.in.fast },
  });
  if (!r) { $('oOnline').textContent = online.sanction ? 'You are not allowed to play online right now' : 'Could not reach the server - score not submitted'; if (online.sanction) showSanction(online.sanction); }
  else if (!r.accepted) $('oOnline').textContent = 'Run rejected by fair play - nothing was banked';
  else {
    const rw = r.reward;
    syncEconomy();
    $('oOnline').innerHTML = (r.ranked ? `Leaderboard: <b style="color:var(--yellow)">${fmt(Math.floor(run.lbScore))}</b>${r.rank ? ` &middot; rank #${r.rank}` : ''}` : 'Revived runs are paid but do not count for leaderboards')
      + (rw ? `<br>Banked <b style="color:var(--yellow)">+${fmt(rw.coins)}</b> coins${rw.coinsCapped ? ' (daily cap reached)' : ''} &middot; <b style="color:var(--cyan)">+${rw.xp} XP</b>` : '');
    if (rw && rw.achievements) for (const a of rw.achievements) hubUI.toast(`Achievement: ${a.name} (+${a.reward})`);
    renderMenuChrome();
  }
}

function renderLobby() {
  const m = mp.room;
  if (!m) return;
  showLobbyViewRef('room');
  $('lobRoomCode').textContent = m.code;
  $('lobMapNote').textContent = m.ranked ? 'Ranked match' : m.pub ? 'Public room - share the code with friends' : 'Private room - share the code with friends';
  const isHost = m.host === net.id;
  $('lobPlayers').innerHTML = m.players.map((p) => `<div class="lob-row${p.id === net.id ? ' me' : ''}"><b>${escapeHtml(p.name)}</b><span style="opacity:.7">${escapeHtml((CHARACTERS.find((c) => c.id === p.char) || CHARACTERS[0]).name)}</span>${p.id === m.host ? '<span class="tag host">HOST</span>' : `<span class="tag ${p.ready ? 'ok' : ''}">${p.ready ? 'READY' : 'WAITING'}</span>`}</div>`).join('');
  $('lobMap').value = m.map; $('lobMap').disabled = !isHost;
  $('btnStartRace').style.display = isHost ? '' : 'none';
  $('btnReady').style.display = isHost ? 'none' : '';
  const me = mp.players.get(net.id);
  $('btnReady').textContent = me && me.ready ? 'NOT READY' : 'READY';
  $('btnStartRace').disabled = m.state !== 'lobby';
}

function mpToLobby() {
  mp.active = false; mp.running = false; mp.results = null;
  clearGhosts();
  enterMenu();
  show('lobby', true);
  renderLobby();
}

function leaveRoom(fromClose = false) {
  if (!fromClose) net.send({ t: 'leave' });
  mp.active = false; mp.running = false; mp.counting = false; mp.room = null; mp.players.clear(); mp.results = null;
  clearGhosts();
  net.close();
  showLobbyViewRef('connect');
  show('lobby', false); show('mpres', false);
  if (state !== 'menu') enterMenu(); else mapOverride = null;
}

function startMpRace(m) {
  mp.active = true; mp.running = false; mp.counting = true; mp.results = null; mp.seed = m.seed;
  for (const p of mp.players.values()) { p.d = 0; p.s = 0; p.alive = true; p.seen = false; p.ready = false; }
  clearGhosts();
  mapOverride = m.map;
  show('lobby', false); show('mpres', false);
  run.ranked = !!m.ranked;
  enterMenu(false, true);
  show('menu', false); show('hud', true);
  audio.initAudio(); audio.resumeAudio();
  let n = m.countdown || 3;
  const tickCount = () => {
    const box = $('h-count');
    if (n > 0) { box.innerHTML = `<div>${n}</div>`; audio.sfx.click(); n--; setTimeout(tickCount, 1000); }
    else {
      box.innerHTML = '<div>GO!</div>';
      mp.counting = false; mp.running = true;
      run.daily = false;
      run.ranked = !!m.ranked;
      startRun({ seed: m.seed, mode: m.mode || 'classic' });
      mp.sendT = 0;
      show('hud', true);
      setTimeout(() => { box.innerHTML = ''; }, 900);
    }
  };
  tickCount();
}

// --------------------------------------------------------------- tutorial
const tutSteps = [
  [0.4, '← →   change lane'], [3.6, '↑  jump over barriers'], [7.2, '↓  roll under bars'], [10.8, 'Double-tap Space  hoverboard'],
];
let tutIdx = 0;
function updateTutorial() {
  if (save.tutorialDone) return;
  const tt = run.t - (run.introOn ? INTRO_T : 0);
  if (tt < 0.05) tutIdx = 0;
  if (tt >= 0 && tutIdx < tutSteps.length && tt >= tutSteps[tutIdx][0]) {
    $('h-tut').innerHTML = `<div>${tutSteps[tutIdx][1]}</div>`;
    const idx = tutIdx;
    setTimeout(() => { if (tutIdx === idx + 1) $('h-tut').innerHTML = ''; }, 3200);
    tutIdx++;
  }
}

// ------------------------------------------------------------------- camera
const camLook = new THREE.Vector3();
const camPos = new THREE.Vector3();
let camX = 0, camY = 4.8, fov = 60, camRoll = 0;
let camYs = 3.5, camZs = 6.1, camKick = 0, camLookX = 0;
function updateCamera(dt) {
  const t = easeInOut(clamp(1 - menuBlend, 0, 1));
  const base = P.groundSmooth;
  const air = Math.max(0, P.y - base - 1.0); // follow big altitude only (jetpack, sneakers), not ordinary hops
  const speedK = clamp((run.speed - C.SPEED_START) / (C.SPEED_MAX - C.SPEED_START), 0, 1.6);
  const lead = clamp(P.vx, -24, 24) * 0.04; // look where we are going
  const rx = P.x * 0.6 + lead;
  const ry = (3.5 + base * 0.85 + air * 0.62 + (P.y - base) * 0.1 - camKick) * cheats.camHeight;
  const rz = (6.1 + Math.min(speedK, 1.4) * 0.8 + air * 0.3) * camDist() * cheats.camBack;
  const lx = P.x * 0.78 + lead * 1.5, ly = 1.3 + base * 0.85 + air * 0.85 + (P.y - base) * 0.15, lz = -9;
  camX = damp(camX, rx, 8, dt);
  camYs = damp(camYs, ry, 9, dt);
  camZs = damp(camZs, rz, 4, dt);
  camLookX = damp(camLookX, lx, 9, dt);
  camKick = Math.max(0, camKick - dt * 1.4);
  // menu camera: 3/4 front view of the character, with a slow breathing orbit
  const orbit = Math.sin(time * 0.35) * 0.35;
  const mx = 1.8 + orbit, my = 1.3, mz = 4.5;
  const mlx = -0.1, mly = 0.95, mlz = 0;
  let px = lerp(mx, camX, t), py = lerp(my, camYs, t), pz = lerp(mz, camZs, t);
  let lkx = lerp(mlx, camLookX, t), lky = lerp(mly, ly, t), lkz = lerp(mlz, lz, t);
  // intro: a slow three-quarter orbit on the tagging scene, then a swoop behind the runner as the guard whistles
  introK = 0;
  if (state === 'playing' && run.introOn && run.t < INTRO_T + 0.7 && !mp.counting) {
    const tt = run.t;
    introK = 1 - easeInOut(clamp((tt - (SPRAY_T - 0.1)) / 1.6, 0, 1));
    const ax = P.x + 2.5 + Math.sin(tt * 0.5) * 0.4, ay = 1.5 + Math.sin(tt * 0.9) * 0.07, az = 3.3 - tt * 0.15;
    px = lerp(px, ax, introK); py = lerp(py, ay, introK); pz = lerp(pz, az, introK);
    lkx = lerp(lkx, P.x - 1.3, introK); lky = lerp(lky, 1.15, introK); lkz = lerp(lkz, 0, introK);
  }
  // death cam: drift in low and look at the crash
  if (state === 'dying' || state === 'over') {
    const dk = easeOutCubic(clamp(run.dieT / 1.3, 0, 1));
    px += Math.sin(dk * 2.4) * 1.1 * dk; py = lerp(py, 2.3, dk); pz = lerp(pz, 4.3, dk); lky = lerp(lky, 0.7, dk); lkz = lerp(lkz, -1, dk);
  }
  px += Math.sin(time * 1.4) * 0.05 * speedK * t; // gentle sway at speed
  if (t > 0.5) {
    if (cheats.camSpin > 0) { const a = time * cheats.camSpin; px += Math.sin(a) * 4 * t; pz += (Math.cos(a) - 1) * 2 * t; }
    if (cheats.topDown) { py = 20; pz = 3; lky = 0; lkz = -4; }
    else if (cheats.sideView) { px = P.x + 9; py = 2.6; pz = 1.5; lkx = P.x; lky = 1.4; lkz = -2; }
  }
  camPos.set(px, py, pz);
  camLook.set(lkx, lky, lkz);
  if (shake > 0) {
    const sk = save.settings.shake === false || save.settings.reduceMotion ? 0 : 1;
    camPos.x += (Math.random() - 0.5) * shake * 0.5 * sk;
    camPos.y += (Math.random() - 0.5) * shake * 0.4 * sk;
    shake = Math.max(0, shake - dt * 1.8);
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  camRoll = damp(camRoll, save.settings.tilt === false || save.settings.reduceMotion ? 0 : clamp(-P.vx * 0.0024, -0.07, 0.07) * t, 7, dt);
  camera.rotateZ(camRoll);
  let fovT = (save.settings.fov || 58) + cheats.camFov + (save.settings.dynFov === false || save.settings.reduceMotion ? 0 : Math.min(speedK, 1.5) * 16) + (P.jetting ? 8 : 0) + (P.onBoard ? 3 : 0) + (pw.sneakers > 0 && !P.grounded ? 4 : 0) + (P.vy < -10 ? 4 : 0) - (P.stumbleT > 0 ? 3 : 0);
  if (state === 'dying' || state === 'over') fovT = 46;
  fovT = lerp(fovT, 44, introK);
  fov = damp(fov, lerp(46, fovT, t), 5, dt);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

// -------------------------------------------------------------------- theme
const _white = new THREE.Color(0xffffff), _gradeTint = new THREE.Color(), _gradeSun = new THREE.Color(), _gradeNight = new THREE.Color(0.78, 0.9, 1.25);
function applyTheme(th, dt, bs) {
  const k = 1 - Math.exp(-3 * dt);
  const fa = BIOMES[bs.a].fog, fb = BIOMES[bs.b].fog;
  scene.fog.near = lerp(scene.fog.near, lerp(fa[0], fb[0], bs.t), k);
  scene.fog.far = lerp(scene.fog.far, lerp(fa[1], fb[1], bs.t), k);
  bend.uRimCol.value.set(th.sun).lerp(_white, 0.35);
  bend.uRimI.value = lerp(0.32, 0.6, th.night);
  scene.fog.color.lerp(new THREE.Color(th.fog), k);
  hemi.color.lerp(new THREE.Color(th.hemiSky), k);
  hemi.groundColor.lerp(new THREE.Color(th.hemiGround), k);
  hemi.intensity = lerp(hemi.intensity, th.hemiI, k);
  sun.color.lerp(new THREE.Color(th.sun), k);
  sun.intensity = lerp(sun.intensity, th.sunI, k);
  fill.intensity = lerp(fill.intensity, 1.5 - th.night * 0.8, k);
  setNight(th.night);
  if (bloom) { bloom.strength = 0.14 + th.night * 0.3; bloom.threshold = lerp(0.95, 0.85, th.night); }
  renderer.toneMappingExposure = lerp(1.0, 1.15, th.night);
  sky.setTheme(th, time);
}

// --------------------------------------------------------------------- main
let last = 0;
let hudAcc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  { // frame cap, frame statistics, adaptive resolution
    const s = save.settings, userCap = Number(s.fpsCap) || 0, idle = state !== 'playing' && state !== 'dying';
    const menuCap = idle ? presetOf(s.quality).menuFps : 0; // the Performance preset idles at 30 fps in menus (battery, heat)
    const cap = userCap && menuCap ? Math.min(userCap, menuCap) : userCap || menuCap;
    const prev = frame.lastDraw || 0;
    if (cap && now - prev < 1000 / cap - 1.5) return;
    frame.lastDraw = now;
    const ms = prev ? Math.min(now - prev, 250) : 16.7;
    frameStats.push(ms);
    if (s.autoRes !== false && state === 'playing' && run.t > 3 && !document.hidden) {
      const k = adapt.push(ms, 1000 / (userCap || 60)); // target: the frame cap, or 60 fps
      if (k !== null) { autoK = k; applyPixelRatio(); }
    }
    if (s.showFps && now - (frame.t0 || 0) > 500) {
      frame.t0 = now;
      const st = frameStats.summary();
      if (st) $('fpsMeter').textContent = `${st.fps} FPS · ${st.ms.toFixed(1)} ms · 1% low ${st.low1} · ${Math.round(renderer.getPixelRatio() / Math.max(0.01, Math.min(window.devicePixelRatio || 1, 2)) * 100)}% res`;
    }
  }
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0)) dt = 0.016;
  dt = Math.min(dt, 0.05);
  if (hitStop > 0) { hitStop -= dt; dt *= 0.04; } // a brief freeze on impact makes the hit feel solid
  if (state === 'playing' || state === 'dying') dt *= cheats.timeScale;
  time += dt;
  if (state === 'duel') { duelCtl.update(dt); duelCtl.render(); return; } // the arena has its own scene and camera

  // state updates
  if (state === 'menu') {
    menuBlend = damp(menuBlend, mp.counting ? 0 : 1, 5, dt);
    world.update(dt, 0);
    updateMenuChar(dt);
  } else if (state === 'playing' || state === 'dying') {
    menuBlend = damp(menuBlend, 0, 4.5, dt);
    // sub-steps: a slow frame must not let the world jump past a thin obstacle (or through a train's side) between two checks
    const steps = Math.min(2, Math.ceil(dt / 0.022));
    for (let i = 0; i < steps && (state === 'playing' || state === 'dying'); i++) updatePlaying(dt / steps);
    updateTutorial();
    updatePlayerVisual(dt);
    hudAcc += dt;
    updateHud();
  } else if (state === 'paused') {
    // frozen
  } else if (state === 'over') {
    world.update(dt, 0);
    updatePlayerVisual(dt);
  }

  P.groundSmooth = damp(P.groundSmooth, state === 'playing' || state === 'dying' ? P.ground : 0, 6, dt);
  const themeDist = state === 'menu' ? 0 : world.dist;
  const bs = state === 'menu' ? { a: menuBiome(), b: menuBiome(), t: 0 } : world.biomeState(world.dist);
  curTheme = themeAt(themeDist, bs.a, bs.b, bs.t, themeBase);
  if (cheats.timeOfDay !== 'auto') curTheme = themeAt(0, bs.a, bs.b, bs.t, { day: 0, sunset: 1, night: 2 }[cheats.timeOfDay]);
  applyTheme(curTheme, dt, bs);
  scene.fog.near *= 1; scene.fog.far = Math.max(scene.fog.near + 20, scene.fog.far);
  const wb = BIOMES[bs.t > 0.5 ? bs.b : bs.a];
  if (wb.id !== curBiomeId) { curBiomeId = wb.id; sky.setBiome(wb.id); birds.setBiome(wb.id); }
  weather.set(save.settings.weather === false ? 'none' : wb.weather);
  weather.update(dt, state === 'playing' || state === 'dying' ? run.speed : 0, camera, curTheme.night);
  tickWorldAssets(time);
  if (birds.mesh.visible) birds.update(dt, state === 'playing' || state === 'dying' ? run.speed : 0, time);
  // storms: random lightning flashes in the neon district
  if (curBiomeId === 'neon' && save.settings.weather !== false) {
    stormT -= dt;
    if (stormT < 0) { stormFlash = 1; stormT = 5 + Math.random() * 9; thunderT = 0.35 + Math.random() * 0.9; }
  }
  if (thunderT > 0) { thunderT -= dt; if (thunderT <= 0) audio.sfx.thunder(); }
  stormFlash = Math.max(0, stormFlash - dt * 4.5);
  sky.uniforms.uFlash.value = stormFlash * (0.6 + 0.4 * Math.sin(time * 60));
  hemi.intensity += stormFlash * 1.6;
  fx.update(dt, state === 'playing' || state === 'dying' ? run.speed : 0, state === 'playing', camera, P.onBoard || P.jetting);
  sky.update(camera, dt);
  pollGamepad();
  updateGhosts(dt);
  updateMpHud(dt);
  updateCamera(dt);
  if (cheats.disco || cheats.debug) applyCheatVisuals();
  if (cheats.debug) $('dbgPanel').textContent = `speed ${run.speed.toFixed(1)}  dist ${Math.floor(run.dist)}  lane ${P.target}  y ${P.y.toFixed(2)}  seed ${run.seed}  t ${run.t.toFixed(1)}  cheated ${!!run.cheated}`;
  audio.setWind(state === 'playing' ? clamp((run.speed - 10) / 28, 0, 1) : 0);

  const hi = presetOf(save.settings.quality).post;
  if (hi) {
    const playing = state === 'playing' || state === 'dying';
    runnerLight.position.set(P.x, (playing ? P.y : 0) + 1.7, -1.4);
    runnerLight.intensity = damp(runnerLight.intensity, (playing || state === 'menu') ? 2.5 + curTheme.night * 9 : 0, 3, dt);
    let best = null, bd = 1e9;
    if (playing) for (const seg of world.segs) for (const o of seg.solids) {
      if (!o.vz) continue;
      const wz = seg.z + o.lz1 + (o.off || 0); // the end of the train that faces the runner
      if (wz < -75 || wz > 3) continue;
      if (-wz < bd) { bd = -wz; best = { x: o.x, z: wz }; }
    }
    if (best) { trainLight.position.set(best.x, 2.1, best.z + 1.2); trainLight.intensity = damp(trainLight.intensity, 26 * (1 - clamp(bd / 75, 0, 1)) * (0.8 + 0.2 * Math.sin(time * 16)), 8, dt); }
    else trainLight.intensity = damp(trainLight.intensity, 0, 6, dt);
    if (grade) {
      gradeSpeed = damp(gradeSpeed, playing && !run.cheated ? clamp((run.speed - 19) / 22, 0, 1) : 0, 2.5, dt);
      const u = grade.uniforms, neon = curBiomeId === 'neon', tint = _gradeTint.set(1, 1, 1).lerp(_gradeSun.set(curTheme.sun), 0.16 - curTheme.night * 0.06).lerp(_gradeNight, curTheme.night * 0.35);
      u.uSpeed.value = save.settings.reduceMotion ? 0 : gradeSpeed;
      u.uSat.value = damp(u.uSat.value, neon ? 1.22 : curBiomeId === 'tropic' ? 1.14 : 1.06, 2, dt);
      u.uCon.value = 1.04 + curTheme.night * 0.05;
      u.uVig.value = 0.2 + curTheme.night * 0.12;
      u.uTint.value = [tint.r, tint.g, tint.b];
    }
  }
  if (composer && hi) composer.render(dt);
  else renderer.render(scene, camera);
}

function updateMenuChar(dt) {
  player.root.position.set(0, 0, 0);
  player.root.rotation.y = lerp(player.root.rotation.y, mp.counting ? 0 : Math.PI - 0.55 + Math.sin(time * 0.5) * 0.1, 1 - Math.exp(-6 * dt));
  poseCharacter(player, { state: 'idle', speed: 0, vx: 0 }, dt);
  player.board.visible = false; player.jet.visible = false;
}

function updatePlayerVisual(dt) {
  const ch = player;
  ch.root.position.set(P.x, P.y, 0);
  if ((state === 'dying' || state === 'over') && run.deathKind === 'slam') { // thrown back and bouncing
    const cT = state === 'over' ? 2 : run.dieT;
    ch.root.position.z = Math.min(cT, 0.7) * 1.9;
    ch.root.position.y += Math.max(0, Math.sin(Math.min(cT, 0.5) * 6.3)) * 0.5 * Math.exp(-cT * 2);
  }
  const introSpray = !!run.introOn && run.t < SPRAY_T && state === 'playing';
  ch.root.rotation.y = lerp(ch.root.rotation.y, introSpray ? Math.PI / 2 : 0, 1 - Math.exp(-(introSpray ? 14 : 8) * dt)); // faces the wall, then forward
  ch.can.visible = introSpray;
  ch.root.visible = !cheats.hideRunner;
  ch.root.scale.setScalar(cheats.runnerSize);
  if (ch.rig && ch.rig.head) ch.rig.head.scale.setScalar(cheats.bigHead);
  let st = 'run';
  if (state === 'dying' || state === 'over') st = 'crash';
  else if (introSpray) st = 'spray';
  else if (run.introOn && run.t < INTRO_T + 0.6 && state === 'playing') st = 'sprint';
  else if (P.stumbleT > 0) st = 'stumble';
  else if (P.jetting) st = 'jet';
  else if (P.onBoard) st = 'board';
  else if (P.rolling) st = 'roll';
  else if (!P.grounded) st = 'jump';
  const rollP = P.rolling ? 1 - P.rollT / C.ROLL_TIME : 0;
  ch.crashT = (state === 'dying') ? run.dieT : (state === 'over' ? 2 : 0);
  poseCharacter(ch, { state: st, speed: run.speed, vy: P.vy, vx: P.vx, rollP, crashT: ch.crashT, kind: st === 'crash' ? run.deathKind : P.hitKind, side: P.hitSide }, dt);
  ch.board.visible = P.onBoard && state !== 'dying';
  ch.board.position.set(0, 0.1 + Math.sin(time * 6) * 0.015, 0);
  ch.board.rotation.z = -P.vx * 0.012;
  ch.jet.visible = !!P.jetting;
  for (const f of ch.flameMats) f.scale.set(1, 0.8 + Math.random() * 0.6, 1);
  // flashing while invulnerable
  const flick = P.inv > 0 && P.inv < 3 && state === 'playing' && Math.floor(time * 18) % 2 === 0;
  ch.root.visible = !flick;
}

const fmtTime = (sec) => { const t = Math.floor(sec); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
function updateWarnings() {
  const ws = world.warnings();
  for (let l = 0; l < 3; l++) {
    const el = $('warn' + l);
    let best = null;
    for (const w of ws) if (w.lane === l && (!best || w.d < best.d)) best = w;
    el.classList.toggle('on', !!best && best.d < 130);
    el.classList.toggle('hot', !!best && best.started);
  }
}
function updateHud() {
  $('hTime').textContent = fmtTime(run.t);
  { const b = $('h-boost'), on = run.boostT > 0 || run.noCoinsT > 0 || P.secondLife; b.classList.toggle('hidden', !on); if (on) b.textContent = `${run.boostT > 0 ? 'BOOST ' + Math.ceil(run.boostT) + 's  ' : ''}${run.noCoinsT > 0 ? 'COINS OFF ' + Math.ceil(run.noCoinsT) + 's  ' : ''}${P.secondLife ? '+1 LIFE' : ''}`.trim(); }
  updateWarnings();
  shownScore += (run.score - shownScore) * 0.3;
  $('hScore').textContent = fmt(Math.round(shownScore));
  $('hDist').textContent = `${fmt(run.dist)} m`;
  $('hMul').textContent = 'x' + scoreMult();
  $('hCoins').textContent = fmt(run.coins);
  if (hudAcc > 0.08) {
    hudAcc = 0;
    renderPowers();
    updateHudStatic();
    const el = $('h-missions');
    if (!el.dataset.k || el.dataset.k !== missionsKey()) { el.dataset.k = missionsKey(); el.innerHTML = '<h3>MISSIONS</h3><div></div>'; }
    renderMissionList(el.lastChild);
  }
}
const missionsKey = () => 'm';

// debug / test hooks
window.__game = {
  api, cheats, applyCheatVisuals, get onboarding() { return onboarding; }, setLang, getLang, get duelCtl() { return duelCtl; }, enterArena, startSoloDuelRun, startDuel, showDuelResult, get hub() { return hubUI; }, get dlgOpen() { return dlgOpen; },
  get state() { return state; },
  P, run, pw, G,
  get world() { return world; },
  get mp() { return mp; },
  get guardVisible() { return guard.root.visible; },
  die: (r) => die(r),
  showcase(id, zl = -41, n = 2) {
    save.settings.map = id; enterMenu(); tryPlay(); P.inv = 9999;
    const seg = world.segs[0];
    [0, 1, 2].forEach((l) => world.placeTrain(seg, l, zl, n, false, id));
  },
  net,
  start: () => { tryPlay(); },
  restart: () => { show('over', false); restart(); },
  setMap: (id) => { save.settings.map = id; persist(); enterMenu(); },
  power: (t) => activatePower(t),
  board: () => { P.onBoard = true; P.boardT = 30; },
  findAhead(kind, max = 40, onlyMoving = false) {
    let best = null;
    for (const seg of world.segs) for (const s of seg.solids) {
      if (s.kind !== kind || (onlyMoving && !s.vz)) continue;
      const zf = -(seg.z + s.lz1);
      if (zf > 4 && zf < max && (!best || zf < best.d)) best = { d: zf, lane: Math.round(s.x / C.LANE_W) + 1, len: s.lz1 - s.lz0, vz: s.vz || 0 };
    }
    return best;
  },
  stepTo(kind, maxDist = 40, dt = 1 / 30, onlyMoving = false) {
    for (let i = 0; i < 4000; i++) { if (this.findAhead(kind, maxDist, onlyMoving)) return this.findAhead(kind, maxDist, onlyMoving); updatePlaying(dt); fx.update(dt, run.speed, true, camera, false); if (state !== 'playing') break; }
    return null;
  },
  setBot: (v) => { botOn = !!v; },
  setSpeed: (s) => { run.speed = s; },
  fastForward(m) { // test hook: scroll the world (difficulty follows the segment index), then clear the start zone and skip the intro
    for (let d = 0; d < m; d += 30) world.update(0.1, 300);
    world.clearAhead(70);
    if (run.introOn) { run.introOn = false; P.x = C.LANES[P.target]; }
  },
  addCoins: (n) => { save.coins += n; persist(); },
  cam: camera,
  scene, renderer, sun, hemi,
  save,
  // headless simulation of the game logic (no rendering) for automated tests
  sim(seconds, dt = 1 / 30) {
    const n = Math.floor(seconds / dt);
    let i = 0;
    const events = [];
    const lastStumble = { v: G.active };
    let roofFrames = 0, maxLenAhead = 0;
    for (; i < n; i++) {
      time += dt;
      if (state !== 'playing' && state !== 'dying') break;
      updatePlaying(dt);
      fx.update(dt, run.speed, true, camera, false);
      if (P.grounded && P.y > 2.5) roofFrames++;
      if (G.active && !lastStumble.v) events.push(`stumble@${Math.floor(run.dist)}m:${P.hitKind}`);
      lastStumble.v = G.active;
      if (state === 'over') break;
    }
    return { roof: roofFrames, state, t: +run.t.toFixed(1), dist: Math.floor(run.dist), coins: run.coins, score: Math.floor(run.score), reason: run.deathReason || null, info: run.deathInfo || null, events: events.slice(0, 12), segs: world.segs.length, speed: +run.speed.toFixed(1) };
  },
};

boot().catch((e) => {
  console.error(e);
  $('loadTxt').textContent = 'Error: ' + e.message;
});
