import { tidy } from './format'

/**
 * Stage wall balance. Every stage is a corridor of solid, numbered walls; you break
 * each by hitting it with your sword, and every hit deals your current Power as
 * damage. Walls heal between hits, so each needs roughly a tenth of its health in
 * Power to get through. Broken walls stay down until you're back in the lobby.
 */

/** Stage N holds walls 10(N-1)+1 … 10N. */
export const WALLS_PER_STAGE = 10

/** The stage (1-based) wall `number` belongs to. */
export const wallStage = (number) => Math.ceil(number / WALLS_PER_STAGE)

/** Wall health: each wall is a quarter tougher than the one before. */
export const wallHp = (number) => tidy(10 * 1.25 ** (number - 1))

/** Fraction of its full health a damaged wall recovers per second. */
export const WALL_REGEN = 0.5

/**
 * Seconds to wait, once you're back in the lobby, before every broken wall rebuilds.
 * A brief grace period rather than an instant snap shut, so it doesn't seal behind
 * you the moment you step through.
 */
export const WALL_RESET_DELAY_S = 10

/**
 * The two Win pads at the end of each stage's cabin, in front of the next stage's
 * first wall. side: -1 left, +1 right, seen walking in.
 *
 * Gold, on the right, is the normal pad: always open, pays the base Wins.
 *
 * Blue, on the left, is the VIP pad. It pays double and asks for no Power at all,
 * but it stays shut until the player buys the VIP Wins Pad with Bux (see
 * game/passes.js) — one purchase opens the blue pad in front of every stage, for
 * good. `pass` is what makes a pad Bux-gated; `power` is then ignored.
 */
export const WIN_PADS = [
  { id: 'blue', side: -1, color: '#2fd4ff', fill: ['#e8fdff', '#35d8ff'], wins: 2, power: 0, pass: 'vipWins' },
  { id: 'gold', side: 1, color: '#ffe14a', fill: ['#fff6a8', '#ffc21a'], wins: 1, power: 0 },
]

/** Seconds to hold E on a Win pad to cash in. */
export const HOLD_S = 1.2

/**
 * Wins for cashing in at the pads in front of wall `number`, i.e. after breaking
 * the `number - 1` walls before it. Further in pays a lot more.
 */
export const padWins = (number, pad) => Math.max(1, tidy(10 * 1.135 ** (number - 11))) * pad.wins

/** Power needed before a pad pays out. Zero for both of today's pads. */
export const padPower = (number, pad) => wallHp(number) * pad.power

/**
 * Whether this pad will pay out right now.
 *
 * A Bux pad opens on the pass and nothing else; a normal one opens on Power. Takes
 * the game state rather than reading the store itself, so the pads' render path and
 * `claimPad` can both ask the same question of the same snapshot.
 *
 * @param {number} number the wall the pad stands before
 * @param {object} pad an entry of WIN_PADS
 * @param {{ power: number, ownedPasses: string[] }} state
 */
export function padUnlocked(number, pad, state) {
  if (pad.pass) return state.ownedPasses.includes(pad.pass)
  return state.power >= padPower(number, pad)
}
