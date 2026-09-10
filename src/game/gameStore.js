import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getEgg } from './eggs'
import { formatNumber } from './format'
import { DEFAULT_SWORD, getSword } from './swords'
import { getTrainer, TRAINERS } from './trainers'

/** Wins for breaking stage wall `number`. */
export const wallReward = (number) => number * number + 1

/** Power for one click. Kept a whole number so the totals stay tidy. */
export const clickGain = (sword, trainer) =>
  Math.max(1, Math.round(sword.power * (trainer?.multiplier ?? 1)))

const MESSAGE_MS = 2600
/** Matches the `click-popup` animation in index.css. */
const POPUP_MS = 1000
let messageId = 0
let popupId = 0

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
      /** What the E key acts on: `{ kind: 'sword' | 'egg', id }`, or null. */
      interact: null,
      /** "⚔ +N" popups flying to the Power counter: `{ id, gain, x, y, dx, dy }`. */
      popups: [],
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

      /**
       * One swing of the equipped sword: gain its power, times any training. `popup`
       * (`{ x, y, dx, dy }` in screen pixels) sends a "⚔ +N" flying from (x, y) by
       * (dx, dy), to the Power counter.
       */
      swing: (popup) => {
        const { equipped, activeTrainer, power, popups } = get()
        const gain = clickGain(getSword(equipped), getTrainer(activeTrainer))
        const next = { power: power + gain, lastGain: gain, swingAt: performance.now() / 1000 }
        if (popup) {
          const id = ++popupId
          // Capped, so frantic clicking can't pile up hundreds of elements.
          next.popups = [...popups.slice(-24), { ...popup, gain, id }]
          setTimeout(() => set({ popups: get().popups.filter((p) => p.id !== id) }), POPUP_MS)
        }
        set(next)
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

      /** A sword or egg came into E range. */
      setInteract: (kind, id) => set({ interact: { kind, id } }),
      /** It went out of range; ignored if something else has taken over since. */
      clearInteract: (kind, id) => {
        const current = get().interact
        if (current?.kind === kind && current.id === id) set({ interact: null })
      },
      /** E pressed (or the prompt clicked): act on whatever is in range. */
      interactNow: () => {
        const target = get().interact
        if (target?.kind === 'sword') get().pickSword(target.id)
        else if (target?.kind === 'egg') get().openEgg(target.id)
      },
      /** Hatching isn't built yet, so opening an egg just says so. */
      openEgg: (id) => {
        const egg = getEgg(id)
        if (egg) get().notify(`${egg.name}: hatching pets is coming soon!`)
      },

      /** E at a sword pad: equip it if owned, otherwise try to buy it. */
      pickSword: (id) => {
        const { owned, equipped, wins, notify } = get()
        const sword = getSword(id)
        if (equipped === id) {
          notify(`${sword.name} is already equipped`)
          return
        }
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
