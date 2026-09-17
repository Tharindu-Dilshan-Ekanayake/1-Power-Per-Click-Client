import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { isSignedIn, purchase, showLogin } from '../bloxity/bux'
import { getEgg } from './eggs'
import { formatBonus, formatNumber } from './format'
import { getPet, MAX_EQUIPPED, PETS, petWinsMultiplier } from './pets'
import {
  activeBoost,
  AUTO_CLICKERS,
  BOOSTS,
  BOOST_S,
  canRebirth,
  levelFor,
  levelMultiplier,
  rebirthMultiplier,
} from './progression'
import { playSound } from './sound'
import { DEFAULT_SWORD, getSword } from './swords'
import { getTrainer, TRAINERS } from './trainers'
import { getPass } from './passes'
import { padPower, padUnlocked, padWins, WALL_RESET_DELAY_S, WALLS_PER_STAGE, wallStage } from './walls'

/** Power for one click. Kept a whole number so the totals stay tidy. */
export const clickGain = (sword, trainer, multiplier = 1) =>
  Math.max(1, Math.round(sword.power * (trainer?.multiplier ?? 1) * multiplier))

/**
 * Level times any running boost times every rebirth earned: everything that
 * multiplies a click, bar training.
 *
 * `rebirths` is read with a default so that a caller passing an older slice - or a
 * save from before rebirths existed - multiplies by one rather than by undefined.
 */
export const powerMultiplier = ({ power, boost, rebirths = 0 }, now = Date.now()) =>
  levelMultiplier(levelFor(power)) * (activeBoost(boost, now)?.multiplier ?? 1) * rebirthMultiplier(rebirths)

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
      /** Rebirths completed. Every one is a permanent multiplier on every click. */
      rebirths: 0,
      wins: 0,
      owned: [DEFAULT_SWORD],
      equipped: DEFAULT_SWORD,
      /** Ids of hatched eggs (one pet each — see pets.js). */
      ownedPets: [],
      /**
       * Ids of the pets currently following the player, in the order they walk
       * (first one leads). Their Wins bonuses add up — see petWinsMultiplier.
       */
      equippedPets: [],
      /** Whether the Pets panel is open. Not saved: it starts closed every session. */
      /** Whether the Rebirth panel is open. */
      rebirthOpen: false,
      petsOpen: false,
      /** Which pet's card the Pets panel is showing on the right, or null. */
      petsSelected: null,
      unlockedTrainers: [TRAINERS[0].id],
      /** Highest stage wall ever broken (0 = none). */
      bestWall: 0,
      /** Highest wall number ever reached in the Infinity Cave (0 = none). */
      caveBest: 0,
      /** Running power boost: `{ multiplier, until }` (until in ms), or null. */
      boost: null,
      /** Whether the OP Auto Clicker has been bought. */
      opAutoOwned: false,
      /**
       * Ids of the Bux passes the player owns (see game/passes.js).
       *
       * SECURITY: this is the only record of a real-money purchase, and it lives in
       * the same localStorage blob as everything else here, so a player can grant
       * themselves a pass by editing it. The Bloxity SDK has no entitlement lookup
       * to check against, so the fix is the game's own server: have the IAP webhook
       * record the purchase against the user id and have the Colyseus room hand the
       * owned passes back on join, exactly like `power` and `wins` will move server
       * side. Until then treat this as convenience, not proof.
       */
      ownedPasses: [],
      /** True while a Bux purchase modal is open, so a held E can't start a second. */
      purchasing: false,

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
        // The two VIP dummies are bought with Bux, and start training straight away.
        if (trainer.bux) {
          return get().buyWithBux(trainer, () => ({
            unlockedTrainers: [...get().unlockedTrainers, id],
            activeTrainer: id,
            interact: null,
          }))
        }
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
        else if (target?.kind === 'egg') get().hatchEgg(target.id)
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
      /**
       * E at an egg stand: hatch it (spends Wins) if it isn't owned yet, otherwise
       * summon its pet to follow the player - or, if it's already following, just
       * says so.
       */
      hatchEgg: (id) => {
        const { ownedPets, wins, notify } = get()
        const egg = getEgg(id)
        const pet = getPet(id)
        if (!egg || !pet) return

        // Already hatched: the stand doubles as a summon/dismiss switch for it.
        if (ownedPets.includes(id)) {
          get().togglePet(id)
          return
        }

        // The Seraph egg is bought with Bux; its pet comes out following you.
        if (egg.bux) {
          return get().buyWithBux(egg, () => ({
            ownedPets: [...get().ownedPets, id],
            equippedPets: [...get().equippedPets, id].slice(0, MAX_EQUIPPED),
          }))
        }

        if (wins < egg.cost) {
          notify(`Need ${formatNumber(egg.cost - wins)} more Wins to hatch ${egg.name}`, 'error')
          return
        }
        set({
          wins: wins - egg.cost,
          ownedPets: [...ownedPets, id],
          equippedPets: [...get().equippedPets, id].slice(0, MAX_EQUIPPED),
        })
        notify(`${egg.name} hatched into ${pet.name}! x${formatBonus(pet.winsBonus)} Wins`, 'success')
        playSound('unlock')
      },

      /**
       * Send a hatched pet out to follow, or call it back in if it already is.
       * Unknown or unhatched ids are ignored, so the Pets panel can call this
       * for any tile without checking first.
       */
      togglePet: (id) => {
        const { ownedPets, equippedPets, notify } = get()
        const pet = getPet(id)
        if (!pet || !ownedPets.includes(id)) return

        if (equippedPets.includes(id)) {
          set({ equippedPets: equippedPets.filter((p) => p !== id) })
          notify(`${pet.name} is waiting back at its egg`)
          playSound('click')
          return
        }
        if (equippedPets.length >= MAX_EQUIPPED) {
          notify(`Only ${MAX_EQUIPPED} pets can follow you at once`, 'error')
          return
        }
        set({ equippedPets: [...equippedPets, id] })
        notify(`${pet.name} is now following you! x${formatBonus(pet.winsBonus)} Wins`)
        playSound('equip')
      },

      /** Every hatched pet at once, best bonus leading the pack. */
      equipAllPets: () => {
        const { ownedPets, equippedPets, notify } = get()
        if (ownedPets.length === 0) {
          notify('Hatch an egg first — no pets yet', 'error')
          return
        }
        const all = PETS.filter((p) => ownedPets.includes(p.id))
          .sort((a, b) => b.winsBonus - a.winsBonus)
          .slice(0, MAX_EQUIPPED)
          .map((p) => p.id)
        if (all.length === equippedPets.length && all.every((id) => equippedPets.includes(id))) {
          notify('Every pet you own is already out')
          return
        }
        set({ equippedPets: all })
        notify(`${all.length} pets following you! x${formatBonus(petWinsMultiplier(all))} Wins`, 'success')
        playSound('equip')
      },

      /** Send them all home, back to 1x Wins. */
      unequipAllPets: () => {
        if (get().equippedPets.length === 0) return
        set({ equippedPets: [] })
        playSound('click')
      },

      /**
       * Open or close the Pets panel (the HUD's Pets button, and Escape).
       * Opening it lands on the pet leading the squad, so the detail card has
       * something in it rather than a gap until the first tap.
       */
      togglePetsPanel: (open) =>
        set((s) => {
          const next = open ?? !s.petsOpen
          if (!next) return { petsOpen: false }
          return { petsOpen: true, petsSelected: s.equippedPets[0] ?? s.ownedPets[0] ?? PETS[0].id }
        }),

      /** Show this pet on the Pets panel's detail card; null closes it. */
      selectPet: (id) => set({ petsSelected: id }),

      toggleRebirthPanel: (open) => set((s) => ({ rebirthOpen: open ?? !s.rebirthOpen })),

      /**
       * Spend every point of Power for a permanent multiplier on every future click.
       *
       * Only `power` is given up. Wins, swords, pets, trainers, boosts and anything
       * bought with Bux are all left exactly as they were - a button that took back
       * something the player had paid for would be a trap, and this one is meant to
       * be pressed.
       *
       * Guarded rather than trusted: the panel disables the button when it cannot be
       * afforded, but the check lives here too, so no path into this - a stale panel,
       * a double click, a future auto-rebirth - can zero someone's Power for nothing.
       */
      rebirth: () => {
        const { power, rebirths, notify } = get()
        if (!canRebirth(power, rebirths)) return
        const next = rebirths + 1
        set({ power: 0, rebirths: next, rebirthOpen: false })
        playSound('unlock')
        notify(`Rebirth ${next}! Every click is now x${rebirthMultiplier(next)} Power`, 'success')
      },

      /**
       * E at a sword pad: equip it if owned, otherwise try to buy it.
       *
       * Returns a promise only for the Bux blades, whose purchase is a round trip
       * through the portal; the Wins path is synchronous and returns nothing.
       */
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
        // The two VIP blades are bought with Bux, not Wins, and come equipped. The
        // promise is handed back rather than dropped: the E key does not care, but a
        // caller that wants to know when the modal closed can wait for it.
        if (sword.bux) {
          return get().buyWithBux(sword, () => ({ owned: [...get().owned, id], equipped: id }))
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
       * An Infinity Cave wall's health hit zero (see InfinityWall): add its Wins
       * straight away and remember how deep we've gone. No toast — these come fast,
       * and the wall's own "+N" popup already says it.
       */
      breakCaveWall: (number, gain) =>
        set((state) => ({
          wins: state.wins + Math.round(gain * petWinsMultiplier(state.equippedPets)),
          caveBest: Math.max(state.caveBest, number),
        })),

      /**
       * Held E long enough on a Win pad: pay out and rebuild the walls. Returns the
       * Wins gained, or 0 if Power is too low; the pad then sends the player home.
       */
      claimPad: (number, pad) => {
        const state = get()
        const { wins, equippedPets, notify } = state
        if (!padUnlocked(number, pad, state)) {
          if (pad.pass) notify(`${getPass(pad.pass).name} needed for this pad`, 'error')
          else notify(`Need ${formatNumber(padPower(number, pad))} Power for this Win pad`, 'error')
          return 0
        }
        const bonus = petWinsMultiplier(equippedPets)
        const gain = Math.round(padWins(number, pad) * bonus)
        // Walls stay broken a little longer; WallField starts their rebuild countdown
        // once we've actually arrived back in the lobby (see scheduleWallReset).
        set({ wins: wins + gain, nearWall: null, interact: null, holdingSince: null })
        const petNote = bonus > 1 ? ` (pets x${formatBonus(bonus)})` : ''
        notify(`+${formatNumber(gain)} Wins${petNote}! Back to the lobby`, 'success')
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

      /**
       * Buys a Bux pass (see game/passes.js). The SDK draws the confirm modal and
       * takes the payment; all we do is wait for its answer and unlock on success.
       *
       * Async, unlike every other buy here, because a real payment is a round trip
       * through the portal. `purchasing` keeps a held E from opening a second modal
       * behind the first.
       *
       * @returns {Promise<boolean>} whether the pass is now owned
       */
      buyPass: (id) => {
        const pass = getPass(id)
        if (!pass) return Promise.resolve(false)
        if (get().ownedPasses.includes(id)) return Promise.resolve(true)
        return get().buyWithBux(pass, () => ({ ownedPasses: [...get().ownedPasses, id] }))
      },

      /**
       * The shared front half of every Bux purchase: the VIP Win pad, the two Bux
       * blades, the Seraph egg and the two VIP dummies all come through here.
       *
       * The SDK owns the whole payment - it prices the SKU server-side, draws the
       * confirm modal and takes the Bux - so all this does is check somebody is
       * signed in, wait for the answer, and hand the result to `grant`.
       *
       * Async, unlike every other buy in this store, because a real payment is a
       * round trip through the portal. `purchasing` keeps a held E (or a second
       * click) from opening a modal behind the one already up.
       *
       * @param {{ sku: string, name: string, bux?: number }} item
       * @param {() => object} grant returns the state patch that hands the item over
       * @returns {Promise<boolean>} whether the player now owns it
       */
      buyWithBux: async (item, grant) => {
        const { purchasing, notify } = get()
        if (!item?.sku) return false
        if (purchasing) return false

        if (!isSignedIn()) {
          notify('Log in to Bloxity to buy with Bux', 'error')
          showLogin()
          return false
        }

        set({ purchasing: true })
        try {
          const result = await purchase(item.sku, { itemId: item.id })
          if (!result.success) {
            // "User cancelled" is the player closing the modal, not a fault.
            if (result.error && result.error !== 'User cancelled') {
              notify(result.error, 'error')
            }
            return false
          }
          // grant() re-reads the store on purpose: the await above spans a modal,
          // so anything captured before it is stale by now.
          set(grant())
          notify(`${item.name} unlocked!`, 'success')
          playSound('unlock')
          return true
        } finally {
          set({ purchasing: false })
        }
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
      version: 4,
      migrate: (state, version) => {
        if (!state) return state
        let next = state
        // v1 had a single `equippedPet`; pets come in squads now.
        if (version < 2) {
          const { equippedPet, ...rest } = next
          next = { ...rest, equippedPets: equippedPet ? [equippedPet] : [] }
        }
        // v2 predates Bux passes, so nobody who saved it owns one.
        if (version < 3) next = { ...next, ownedPasses: [] }
        // v3 predates rebirths. Everyone who saved it starts at none, which is the
        // same x1 they have been playing with - nothing they earned changes value.
        if (version < 4) next = { ...next, rebirths: 0 }
        return next
      },
      partialize: ({
        power,
        rebirths,
        wins,
        owned,
        equipped,
        ownedPets,
        equippedPets,
        unlockedTrainers,
        bestWall,
        caveBest,
        boost,
        opAutoOwned,
        ownedPasses,
      }) => ({
        power,
        rebirths,
        wins,
        owned,
        equipped,
        ownedPets,
        equippedPets,
        unlockedTrainers,
        bestWall,
        caveBest,
        boost,
        opAutoOwned,
        ownedPasses,
      }),
    },
  ),
)
