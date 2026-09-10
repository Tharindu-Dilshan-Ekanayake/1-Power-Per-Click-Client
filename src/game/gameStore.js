import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { formatNumber } from './format'
import { DEFAULT_SWORD, getSword } from './swords'
import { getTrainer, TRAINERS } from './trainers'

/** Wins for breaking stage wall `number`. */
export const wallReward = (number) => number * number + 1

/** Power for one click. Kept a whole number so the totals stay tidy. */
export const clickGain = (sword, trainer) =>
  Math.max(1, Math.round(sword.power * (trainer?.multiplier ?? 1)))

const MESSAGE_MS = 2600
let messageId = 0

/**
 * Player progress. Saved to localStorage for now; move it to the server before
 * Wins or Power are worth anything, since the browser can edit this freely.
 *
 * Readable outside React (e.g. in useFrame) via `useGame.getState()`.
 */
export const useGame = create(
  persist(
    (set, get) => ({
      power: 0,
      wins: 0,
      owned: [DEFAULT_SWORD],
      equipped: DEFAULT_SWORD,
      unlockedTrainers: [TRAINERS[0].id],

      /** Id of the training dummy whose pad the player is standing on, or null. */
      activeTrainer: null,
      /** Yaw the player turns to while training, so they face the dummy. */
      trainYaw: Math.PI,
      /** `performance.now()` seconds of the last swing; drives the arm animation. */
      swingAt: -Infinity,
      /** Power gained by the last swing, for the dummy's "+N" popup. */
      lastGain: 0,
      /** Latest toast: `{ text, tone: 'info'|'success'|'error', id }`. */
      message: null,

      notify: (text, tone = 'info') => {
        const id = ++messageId
        set({ message: { text, tone, id } })
        setTimeout(() => {
          if (get().message?.id === id) set({ message: null })
        }, MESSAGE_MS)
      },

      /** One click: swing the equipped sword and gain its power, times any training. */
      swing: () => {
        const { equipped, activeTrainer, power } = get()
        const gain = clickGain(getSword(equipped), getTrainer(activeTrainer))
        set({ power: power + gain, lastGain: gain, swingAt: performance.now() / 1000 })
      },

      /**
       * Stepping onto a dummy's pad: unlock it if needed and affordable, then train.
       * `faceYaw` is the yaw that points the player at the dummy.
       */
      enterTrainer: (id, faceYaw = Math.PI) => {
        const { unlockedTrainers, wins, notify } = get()
        const trainer = getTrainer(id)
        if (!trainer) return
        if (!unlockedTrainers.includes(id)) {
          if (wins < trainer.cost) {
            notify(`Need ${formatNumber(trainer.cost - wins)} more Wins to unlock ${trainer.multiplier}x training`, 'error')
            return
          }
          set({ wins: wins - trainer.cost, unlockedTrainers: [...unlockedTrainers, id] })
          notify(`Unlocked ${trainer.multiplier}x training!`, 'success')
        }
        set({ activeTrainer: id, trainYaw: faceYaw })
      },

      leaveTrainer: (id) => {
        if (get().activeTrainer === id) set({ activeTrainer: null })
      },

      /** Stepping onto a sword pad: equip it if owned, otherwise try to buy it. */
      stepOnSword: (id) => {
        const { owned, equipped, wins, notify } = get()
        const sword = getSword(id)
        if (equipped === id) return
        if (owned.includes(id)) {
          set({ equipped: id })
          notify(`Equipped ${sword.name}`)
          return
        }
        if (wins < sword.cost) {
          notify(`Need ${formatNumber(sword.cost - wins)} more Wins for ${sword.name}`, 'error')
          return
        }
        set({ wins: wins - sword.cost, owned: [...owned, id], equipped: id })
        notify(`Bought ${sword.name}! +${formatNumber(sword.power)} Power per click`, 'success')
      },

      /** Walking into a stage wall. Returns true if it broke. */
      hitWall: (number, hp) => {
        const { power, wins, notify } = get()
        if (power < hp) {
          notify(`Need ${formatNumber(hp)} Power to break wall ${number}`, 'error')
          return false
        }
        const reward = wallReward(number)
        set({ wins: wins + reward })
        notify(`Wall ${number} broken! +${formatNumber(reward)} Wins`, 'success')
        return true
      },
    }),
    {
      name: 'ppc-progress',
      version: 1,
      partialize: ({ power, wins, owned, equipped, unlockedTrainers }) => ({
        power,
        wins,
        owned,
        equipped,
        unlockedTrainers,
      }),
    },
  ),
)
