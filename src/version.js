// Game version. The full version is `${GAME_VERSION}-${commit}`; the commit comes from the build (see next.config.mjs).
export const GAME_VERSION = '2.0.0';
export const GAME_FULL_VERSION = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_VERSION) || `${GAME_VERSION}-dev`;
