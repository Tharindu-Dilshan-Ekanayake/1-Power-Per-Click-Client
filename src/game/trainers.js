/**
 * Training dummies. Standing on a dummy's pad multiplies the Power each click gives.
 *
 * cost:       Wins to unlock it for good (the first is free)
 * multiplier: Power-per-click multiplier while standing on its pad
 */
export const TRAINERS = [
  { id: 'dummy-1', multiplier: 1.5, cost: 0, color: '#ff4a4a' },
  { id: 'dummy-2', multiplier: 2, cost: 20, color: '#ffd23f' },
  { id: 'dummy-3', multiplier: 3, cost: 60, color: '#46d160' },
  { id: 'dummy-4', multiplier: 5, cost: 200, color: '#3fa9ff' },
  { id: 'dummy-5', multiplier: 10, cost: 600, color: '#a45cff' },
  { id: 'dummy-6', multiplier: 25, cost: 1500, color: '#ff8f2e' },
  { id: 'dummy-7', multiplier: 50, cost: 4000, color: '#2fe0d0' },
  { id: 'dummy-8', multiplier: 100, cost: 10000, color: '#ff5fb8' },
]

/**
 * Where a dummy stands relative to its pad's centre, in the pad's own (rotated)
 * frame. The player faces local -Z to hit it; see `enterTrainer`'s `faceYaw`.
 */
export const DUMMY_OFFSET_Z = -2.6

/** @returns the trainer, or undefined for an unknown / null id. */
export const getTrainer = (id) => TRAINERS.find((t) => t.id === id)
