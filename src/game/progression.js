import { tidy } from './format'

/**
 * Levels, boosts, auto clickers and walk speed: the numbers behind the bottom HUD.
 */

export const MAX_LEVEL = 20

/** Power needed to reach `level` (level 1 is free). */
export const levelPower = (level) => (level <= 1 ? 0 : tidy(100 * 3 ** (level - 2)))

/** The level a Power total has reached. */
export function levelFor(power) {
  let level = 1
  while (level < MAX_LEVEL && power >= levelPower(level + 1)) level++
  return level
}

/** Click multiplier for a level: 1x at level 1, rising evenly to 5x at the max. */
export const levelMultiplier = (level) => 1 + ((level - 1) * 4) / (MAX_LEVEL - 1)

/** How long a bought power boost lasts. */
export const BOOST_S = 300

/** Power boosts, bought with Wins. Buying one again while it runs adds time. */
export const BOOSTS = [
  { multiplier: 2, cost: 100 },
  { multiplier: 4, cost: 1000 },
  { multiplier: 8, cost: 10000 },
]

/** `boost` (`{ multiplier, until }`, until in ms) if it's still running, else null. */
export const activeBoost = (boost, now = Date.now()) => (boost && boost.until > now ? boost : null)

/**
 * Auto clickers swing for you. The normal one is free; the OP one is much faster
 * and is unlocked once with Wins.
 */
export const AUTO_CLICKERS = {
  normal: { interval: 0.25 },
  op: { interval: 0.1, cost: 2500 },
}

/** Walk speed as shown on the HUD (Roblox-style units). */
export const WALK_SPEED = 16
