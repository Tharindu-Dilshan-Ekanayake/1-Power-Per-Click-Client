import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getEgg } from './eggs'
import { formatNumber } from './format'
import { activeBoost, AUTO_CLICKERS, BOOST_S, BOOSTS, levelFor, levelMultiplier } from './progression'
import { playSound } from './sound'
import { DEFAULT_SWORD, getSword } from './swords'
import { getTrainer, TRAINERS } from './trainers'
import { padPower, padWins, WALL_RESET_DELAY_S, WALLS_PER_STAGE, wallStage } from './walls'

/** Power for one click. Kept a whole number so the totals stay tidy. */
export const clickGain = (sword, trainer, multiplier = 1) =>
  Math.max(1, Math.round(sword.power * (trainer?.multiplier ?? 1) * multiplier))

/** Level times any running boost: everything that multiplies a click, bar training. */
export const powerMultiplier = ({ power, boost }, now = Date.now()) =>
  levelMultiplier(levelFor(power)) * (activeBoost(boost, now)?.multiplier ?? 1)

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
      /** Highest stage wall ever broken (0 = none). */
      bestWall: 0,
      /** Running power boost: `{ multiplier, until }` (until in ms), or null. */
      boost: null,
      /** Whether the OP Auto Clicker has been bought. */
      opAutoOwned: false,

      /** Id of the training dummy whose pad the player is standing on, or null. */
      activeTrainer: null,
      /** Yaw the player turns to while training, so they face the dummy. */
      trainYaw: Math.PI,
      /** What the E key acts on: `{ kind: 'sword' | 'egg' | 'pad' | 'trainer', id }`, or null. */
      interact: null,
      /** `performance.now()` seconds when E started being held, or null. */
      holdingSince: null,
      /** The stage wall within sword reach: `{ number, z }` (z of its centre), or null. */
      nearWall: null,
      /** Walls broken this run, `{ [number]: true }`; cleared back in the lobby. */
      brokenWalls: {},
      /** When the broken walls rebuild (performance.now()/1000), once that's due; else null. */
      wallsResetAt: null,
      /** Which auto clicker is running: 'off' | 'normal' | 'op'. */
      autoClick: 'off',
      /** Player position `[x, y, z]` at the last swing, so a wall knows which side was hit. */
      swingPos: null,
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
        // Every "can't do that" goes through here, so they all get the same bonk.
        if (tone === 'error') playSound('error')
        setTimeout(() => {
          if (get().message?.id === id) set({ message: null })
        }, MESSAGE_MS)
      },

      /**
       * One swing of the equipped sword: gain its power, times training, level and
       * boost. `popup` (`{ x, y, dx, dy }` in screen pixels) sends a "⚔ +N" flying
       * from (x, y) by (dx, dy), to the Power counter. `at` is the player's position,
       * if known.
       */
      swing: (popup, at) => {
        const state = get()
        const gain = clickGain(getSword(state.equipped), getTrainer(state.activeTrainer), powerMultiplier(state))
        const next = {
          power: state.power + gain,
          lastGain: gain,
          swingAt: performance.now() / 1000,
          swingPos: at ?? null,
        }
        if (popup) {
          const id = ++popupId
          // Capped, so frantic clicking can't pile up hundreds of elements.
          next.popups = [...state.popups.slice(-24), { ...popup, gain, id }]
          setTimeout(() => set({ popups: get().popups.filter((p) => p.id !== id) }), POPUP_MS)
        }
        set(next)
      },

      /**
       * Stepping onto a dummy's pad: train if it's unlocked. A locked one only offers
       * itself with an E prompt (see unlockTrainer); nothing is spent just by
       * walking over it. `faceYaw` is the yaw that points the player at the dummy.
       */
      enterTrainer: (id, faceYaw = Math.PI) => {
        if (!getTrainer(id)) return
        if (!get().unlockedTrainers.includes(id)) {
          set({ interact: { kind: 'trainer', id }, holdingSince: null, trainYaw: faceYaw })
          return
        }
        set({ activeTrainer: id, trainYaw: faceYaw })
      },

      /** E on a locked training pad: buy it if affordable, then start training on it. */
      unlockTrainer: (id) => {
        const { unlockedTrainers, wins, interact, notify } = get()
        const trainer = getTrainer(id)
        if (!trainer || unlockedTrainers.includes(id)) return
        if (wins < trainer.cost) {
          notify(`Need ${formatNumber(trainer.cost - wins)} more Wins to unlock ${trainer.multiplier}x training`, 'error')
          return
        }
        set({
          wins: wins - trainer.cost,
          unlockedTrainers: [...unlockedTrainers, id],
          activeTrainer: id,
          interact: interact?.kind === 'trainer' && interact.id === id ? null : interact,
        })
        notify(`Unlocked ${trainer.multiplier}x training!`, 'success')
        playSound('unlock')
      },

      leaveTrainer: (id) => {
        if (get().activeTrainer === id) set({ activeTrainer: null })
        get().clearInteract('trainer', id)
      },

      /** A sword, egg, Win pad or locked training pad came into E range. */
      setInteract: (kind, id) => set({ interact: { kind, id }, holdingSince: null }),
      /** It went out of range; ignored if something else has taken over since. */
      clearInteract: (kind, id) => {
        const current = get().interact
        if (current?.kind === kind && current.id === id) set({ interact: null, holdingSince: null })
      },
      /** E pressed (or the prompt clicked): act on whatever is in range. */
      interactNow: () => {
        const target = get().interact
        if (target?.kind === 'sword') get().pickSword(target.id)
        else if (target?.kind === 'egg') get().openEgg(target.id)
        else if (target?.kind === 'trainer') get().unlockTrainer(target.id)
      },
      /** E went down. Win pads need it held (see WinPad); everything else acts at once. */
      interactStart: () => {
        const { interact, holdingSince } = get()
        if (interact?.kind !== 'pad') get().interactNow()
        else if (holdingSince === null) set({ holdingSince: performance.now() / 1000 })
      },
      /** E came up. */
      interactEnd: () => {
        if (get().holdingSince !== null) set({ holdingSince: null })
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
          playSound('equip')
          return
        }
        if (wins < sword.cost) {
          notify(`Need ${formatNumber(sword.cost - wins)} more Wins for ${sword.name}`, 'error')
          return
        }
        set({ wins: wins - sword.cost, owned: [...owned, id], equipped: id })
        notify(`Bought ${sword.name}! +${formatNumber(sword.power)} Power per click`, 'success')
        playSound('unlock')
      },

      /** Came within sword reach of a stage wall (`z`: the z of its centre). */
      setNearWall: (number, z) => set({ nearWall: { number, z } }),
      /** Left its reach; ignored if another wall has taken over since. */
      clearNearWall: (number) => {
        if (get().nearWall?.number === number) set({ nearWall: null })
      },

      /** A stage wall's health hit zero (see StageWall, which tracks the damage). */
      breakWall: (number) => {
        const { brokenWalls, bestWall, notify } = get()
        set({ brokenWalls: { ...brokenWalls, [number]: true }, bestWall: Math.max(bestWall, number) })
        if (number > 1 && (number - 1) % WALLS_PER_STAGE === 0) {
          notify(`Stage ${wallStage(number)} reached!`, 'success')
          playSound('stage')
        }
      },
      /**
       * Back in the lobby with walls still broken: starts the rebuild countdown
       * (a no-op if one's already running, or nothing is broken). See WallField.
       */
      scheduleWallReset: () => {
        const { brokenWalls, wallsResetAt } = get()
        if (wallsResetAt !== null || Object.keys(brokenWalls).length === 0) return
        set({ wallsResetAt: performance.now() / 1000 + WALL_RESET_DELAY_S })
      },

      /**
       * Stepped back out of the lobby (through the still-broken walls) before the
       * countdown ran out: it only rebuilds after a full, uninterrupted stay in the
       * lobby, so cancel it. Walking back in later starts a fresh one.
       */
      cancelWallReset: () => {
        if (get().wallsResetAt !== null) set({ wallsResetAt: null })
      },

      /** The countdown ran out (or a Win pad sent us straight back): rebuild every wall. */
      resetWalls: () => set({ brokenWalls: {}, wallsResetAt: null }),

      /**
       * Held E long enough on a Win pad: pay out and rebuild the walls. Returns the
       * Wins gained, or 0 if Power is too low; the pad then sends the player home.
       */
      claimPad: (number, pad) => {
        const { power, wins, notify } = get()
        const needed = padPower(number, pad)
        if (power < needed) {
          notify(`Need ${formatNumber(needed)} Power for this Win pad`, 'error')
          return 0
        }
        const gain = padWins(number, pad)
        // Walls stay broken a little longer; WallField starts their rebuild countdown
        // once we've actually arrived back in the lobby (see scheduleWallReset).
        set({ wins: wins + gain, nearWall: null, interact: null, holdingSince: null })
        notify(`+${formatNumber(gain)} Wins! Back to the lobby`, 'success')
        playSound('win')
        return gain
      },

      /** A power boost button: buy it, or add time if the same one is running. */
      buyBoost: (multiplier) => {
        const { wins, boost, notify } = get()
        const def = BOOSTS.find((b) => b.multiplier === multiplier)
        if (!def) return
        const now = Date.now()
        const current = activeBoost(boost, now)
        if (current && current.multiplier > multiplier) {
          notify(`Your x${current.multiplier} boost is still running`, 'error')
          return
        }
        if (wins < def.cost) {
          notify(`Need ${formatNumber(def.cost - wins)} more Wins for x${multiplier} Power`, 'error')
          return
        }
        const start = current?.multiplier === multiplier ? current.until : now
        set({ wins: wins - def.cost, boost: { multiplier, until: start + BOOST_S * 1000 } })
        notify(`x${multiplier} Power for ${BOOST_S / 60} minutes!`, 'success')
        playSound('unlock')
      },

      /** An auto clicker button: start or stop it, buying the OP one the first time. */
      toggleAutoClick: (kind) => {
        const { autoClick, opAutoOwned, wins, notify } = get()
        if (autoClick === kind) {
          set({ autoClick: 'off' })
          playSound('click')
          return
        }
        if (kind === 'op' && !opAutoOwned) {
          const { cost } = AUTO_CLICKERS.op
          if (wins < cost) {
            notify(`Need ${formatNumber(cost - wins)} more Wins for the OP Auto Clicker`, 'error')
            return
          }
          set({ wins: wins - cost, opAutoOwned: true })
          notify('OP Auto Clicker unlocked!', 'success')
          playSound('unlock')
        } else {
          playSound('click')
        }
        set({ autoClick: kind })
      },
    }),
    {
      name: 'ppc-progress',
      version: 1,
      partialize: ({ power, wins, owned, equipped, unlockedTrainers, bestWall, boost, opAutoOwned }) => ({
        power,
        wins,
        owned,
        equipped,
        unlockedTrainers,
        bestWall,
        boost,
        opAutoOwned,
      }),
    },
  ),
)
