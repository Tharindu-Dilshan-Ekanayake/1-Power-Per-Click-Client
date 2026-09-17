/**
 * Training dummies. Standing on a dummy's pad multiplies the Power each click gives.
 *
 * cost:       Wins to unlock it for good (the first is free)
 * multiplier: Power-per-click multiplier while standing on its pad
 *
 * rebirths:   rebirths needed as well as the Wins, on the top three only. Both gates
 *             have to be open; the Wins alone will not do it. They are what the
 *             ladder points at once the level bar has nothing left to fill - without
 *             them a rebirth buys a bigger number and nothing to spend it on, and
 *             the last three dummies are simply bought the day a player can afford
 *             them and never thought about again. See game/progression.js.
 *
 * bux:        set instead of `cost` on the two VIP dummies - they are unlocked with
 *             Bux and stand on their own platform away from the rows (see
 *             world/layout.js). `sku` is the IAP they buy, which must exist and be
 *             active in the Bloxity admin panel. A trainer with `bux` has no
 *             `cost`, so always check for it first.
 */
export const TRAINERS = [
  { id: 'dummy-1', multiplier: 1.5, cost: 0, color: '#ff4a4a' },
  { id: 'dummy-2', multiplier: 2, cost: 20, color: '#ffd23f' },
  { id: 'dummy-3', multiplier: 3, cost: 60, color: '#46d160' },
  { id: 'dummy-4', multiplier: 5, cost: 200, color: '#3fa9ff' },
  { id: 'dummy-5', multiplier: 10, cost: 600, color: '#a45cff' },
  { id: 'dummy-6', multiplier: 25, cost: 1500, color: '#ff8f2e' },
  { id: 'dummy-7', multiplier: 50, cost: 4000, color: '#2fe0d0' },
  { id: 'dummy-8', multiplier: 100, cost: 10000, rebirths: 1, color: '#ff5fb8' },
  { id: 'dummy-9', multiplier: 200, cost: 25000, rebirths: 2, color: '#c8ff3a' },
  { id: 'dummy-10', multiplier: 450, cost: 60000, rebirths: 3, color: '#ff3b6b' },

  // --- Bux dummies. Shortcuts rather than an end point: 250x slots between the
  // Wins ladder's 200x and 450x, 1000x above both. Same shape as the Bux blades -
  // you pay to skip a stretch of the grind, not to leave it behind for good.
  { id: 'vip-1', name: '250x VIP Training', multiplier: 250, bux: 99, sku: 'trainer_vip_250x', color: '#a45cff' },
  { id: 'vip-2', name: '1000x VIP Training', multiplier: 1000, bux: 199, sku: 'trainer_vip_1000x', color: '#ffd23f' },
]

/** The two dummies on the VIP platform. */
export const BUX_TRAINERS = TRAINERS.filter((t) => t.bux)
/** The eight unlocked with Wins - the two rows in the training zone. */
export const WINS_TRAINERS = TRAINERS.filter((t) => !t.bux)

/**
 * Where a dummy stands relative to its pad's centre, in the pad's own (rotated)
 * frame. The player faces local -Z to hit it; see `enterTrainer`'s `faceYaw`.
 */
export const DUMMY_OFFSET_Z = -2.6

/** @returns the trainer, or undefined for an unknown / null id. */
export const getTrainer = (id) => TRAINERS.find((t) => t.id === id)

/** How many more rebirths this dummy wants; 0 once it wants none. */
export const rebirthsShort = (trainer, rebirths) =>
  Math.max(0, (trainer?.rebirths ?? 0) - rebirths)
