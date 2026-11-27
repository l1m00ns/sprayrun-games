// Engine tuning values. They are intentionally inert: there is no secret menu, no unlock code and no in-game way
// to change them. Tests may set a few of these through window.__game for headless simulations.
export const cheats = {
  forceMap: '', god: false, noclip: false, noStumble: false, infBoards: false,
  laneSpeed: 1, jumpScale: 1, doubleJump: false, rollScale: 1, boardTime: 5,
  gravity: 1, scoreMul: 1, coinMul: 1, magnetRange: 1, freeRevive: false,
  timeScale: 1, camHeight: 1, camBack: 1, camSpin: 0, topDown: false, sideView: false, camFov: 0,
  timeOfDay: 'auto', hideRunner: false, runnerSize: 1, bigHead: 1,
  bot: false, botGod: false, botTag: false, botStyle: '', botReact: 25, botBoards: false, // pro bot reaction: 25 ms is the sharpest fair setting (it reads the track, not the future)
  assist: false, autoLane: false, permMagnet: false, permSneakers: false, permMult: false,
  startPct: 0, speedMul: 1, noProgress: false, lockSpeed: false, lockValue: 0, instantSpeed: false,
  hideHud: false, grayscale: false, sepia: false, invert: false, vivid: false, disco: false,
  mirror: false, upsideDown: false, retro: false, wireframe: false, debug: false,
  duelHitbox: false, duelRate: 1, duelInfAmmo: false, duelBigHead: false, duelGod: false,
  duelBot: '', duelSlowKill: false,
};

export const OPTIONS = []; // kept so older tools that import the list still build
export const GROUPS = [];
export const tainted = () => false;
export const activeCount = () => 0;
export const groupActive = () => 0;
export const unlocked = () => false;
export const setUnlocked = () => {};
export const konamiListener = () => {};
export const resetAll = () => {};
export const renderGroup = () => {};
