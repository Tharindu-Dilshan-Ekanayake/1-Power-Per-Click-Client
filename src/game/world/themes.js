/**
 * Map dimensions and per-stage themes.
 *
 * Coordinates: +Y up, the lobby is centred on the origin, and the stages run off
 * towards -Z behind the gate. One unit is roughly one metre (the player is 1.8 tall).
 */

/** Half-size of the flat lobby plaza. */
export const LOBBY_HALF = 44
/** Depth of each terrace ring around the lobby. */
export const RING = 6

/** Inner half-width of the stage corridor. */
export const CORRIDOR_HALF = 12
/** Thickness of the corridor side walls. */
export const WALL_T = 2
/** Height of corridor walls. */
export const WALL_H = 12

/** The doorway every stage wall sits in. */
export const OPEN_HALF = 8
export const OPEN_H = 10

/** Z of the gate tower's front face; wall 1 lives here. */
export const GATE_Z = -44
/** Z where stage 1's corridor begins (the back of the gate tower). */
export const STAGE_START = -50
export const STAGE_LEN = 44

export const SPAWN = [0, 2, 30]

/** Cyan used for every stage-wall frame. */
export const FRAME_COLOR = '#6ff7ff'

const DEFAULT_FLOOR = ['#c9ccdb', '#abafc4']

/**
 * One entry per stage. Wall N is the doorway *into* stage N.
 *
 * wall.style: 'cobble' | 'crystal' | 'lava' (voronoi rock), 'bricks', 'planks'
 * wall.glow:  emissive strength of the wall surface (0 = none)
 * side:       tint for the corridor's panelled walls
 * neon:       strip-light colour along the corridor
 */
export const THEMES = [
  {
    name: 'Stone',
    wall: { style: 'cobble', palette: ['#9aa0a8', '#8b9199', '#a9aeb5', '#7f858e'], gap: '#474b52', moss: true },
    side: '#6a70a8',
    neon: '#62f3ff',
  },
  {
    name: 'Wood',
    wall: { style: 'planks', palette: ['#b07540', '#a0662f', '#c0844b', '#8f5a2a'], gap: '#4a2a12' },
    side: '#8a6fb0',
    neon: '#ffd166',
  },
  {
    name: 'Sandstone',
    wall: { style: 'bricks', palette: ['#e8c784', '#dcb86f', '#f0d396', '#d1ab60'], gap: '#a47d3e' },
    side: '#b08a58',
    neon: '#ffe08a',
    floor: ['#f2e6c9', '#e2d2ad'],
  },
  {
    name: 'Ice',
    wall: { style: 'cobble', palette: ['#cdefff', '#b5e3fb', '#e4f7ff', '#a6d8f5'], gap: '#5aa7d6', glow: 0.25 },
    side: '#6aa6d8',
    neon: '#9ff3ff',
    floor: ['#e8f6ff', '#cfe8f7'],
  },
  {
    name: 'Jungle',
    wall: { style: 'cobble', palette: ['#5e9e46', '#6fb34f', '#4f8c3c', '#7cc05a'], gap: '#2f4d24', moss: true },
    side: '#5c9a5a',
    neon: '#8dff6a',
  },
  {
    name: 'Brick',
    wall: { style: 'bricks', palette: ['#c0492f', '#b23f27', '#cf5637', '#a3391f'], gap: '#e2d3c0' },
    side: '#b0605a',
    neon: '#ff7b6b',
  },
  {
    name: 'Gold',
    wall: { style: 'bricks', palette: ['#f5c542', '#e8b52f', '#ffd457', '#dba623'], gap: '#9c7415', glow: 0.2 },
    side: '#c2a24a',
    neon: '#fff08a',
    floor: ['#fbf1d2', '#eedfae'],
  },
  {
    name: 'Amethyst',
    wall: { style: 'crystal', palette: ['#9b5de5', '#b47cff', '#7f47d1', '#c79bff'], gap: '#f0d9ff', glow: 0.35 },
    side: '#8a5ac8',
    neon: '#d59bff',
  },
  {
    name: 'Obsidian',
    wall: { style: 'cobble', palette: ['#2a2238', '#342a46', '#231c30', '#3b2f52'], gap: '#b44cff', glow: 0.6 },
    side: '#4a3a6a',
    neon: '#b65cff',
    floor: ['#b9b3c9', '#a39cb6'],
  },
  {
    name: 'Emerald',
    wall: { style: 'bricks', palette: ['#2fbf71', '#27a862', '#3ad07f', '#219457'], gap: '#0f5a33', glow: 0.15 },
    side: '#3f9a86',
    neon: '#5affc8',
  },
  {
    name: 'Lava',
    wall: { style: 'lava', palette: ['#e2531f', '#ef6a2a', '#d6441a', '#f47b33'], gap: '#7a1a08', glow: 0.7 },
    side: '#7a3d5a',
    neon: '#ff9b3d',
    floor: ['#c9bfc4', '#b2a7ad'],
  },
  {
    name: 'Diamond',
    wall: { style: 'crystal', palette: ['#9ff3ff', '#7fe6fb', '#bff8ff', '#6cd3f0'], gap: '#ffffff', glow: 0.45 },
    side: '#5a8ad0',
    neon: '#7ff9ff',
  },
].map((theme) => ({ floor: DEFAULT_FLOOR, ...theme }))

export const STAGE_COUNT = THEMES.length

/** Z where stage `k` (1-based) begins. */
export const stageStart = (k) => STAGE_START - (k - 1) * STAGE_LEN

/** Z of the closed wall at the very end of the last stage. */
export const END_Z = stageStart(STAGE_COUNT + 1)

/** Cosmetic HP shown on each wall's health bar. */
export const wallHp = (number) => (number === 1 ? 1 : Math.round(2.2 * 1.62 ** (number - 1)))
