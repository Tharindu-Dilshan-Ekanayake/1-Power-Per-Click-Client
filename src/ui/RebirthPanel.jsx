import { useEffect, useState } from 'react'

import { useTouchDevice } from '../game/device'
import { formatNumber } from '../game/format'
import { useGame } from '../game/gameStore'
import {
  canRebirth,
  levelFor,
  MAX_LEVEL,
  MAX_REBIRTHS,
  rebirthMultiplier,
  rebirthPower,
} from '../game/progression'

/**
 * The Rebirth panel: give up every point of Power for a permanent multiplier on
 * every click after it.
 *
 * Laid out after the game this one takes its shape from - a "current" column, an
 * arrow, and an "after" column, so the trade reads in one glance rather than a
 * paragraph. The two rows are the two things that actually change: the multiplier,
 * and how many rebirths you have. The level cap is deliberately not one of them;
 * see game/progression.js for why moving it breaks the arithmetic this game counts
 * in.
 *
 * Nothing but Power is spent, and the panel says so on its face. A button that wipes
 * the biggest number on the screen is frightening, and a player who is not certain
 * what else goes with it simply never presses it.
 */

/** Chunky outlined game text, same as the rest of the HUD. */
const OUTLINE = {
  fontFamily: '"Arial Black", "Segoe UI Black", Impact, sans-serif',
  WebkitTextStroke: '1.5px #111',
  textShadow: '0 3px 0 rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.5)',
}
/** Small chips and badges: the same font, minus the stroke that would eat them. */
const CHIP = { ...OUTLINE, WebkitTextStroke: '0', textShadow: 'none' }
const INK = '#1b1b25'

/** Chunky outlined button: dark border, gradient face and a darker bottom lip. */
function PanelButton({ colors, onClick, disabled, className = '', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`pointer-events-auto relative cursor-pointer rounded-xl border-4 px-4 py-2 text-white transition duration-100 hover:brightness-110 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100 ${className}`}
      style={{
        ...OUTLINE,
        borderColor: INK,
        background: `linear-gradient(to bottom, ${colors[0]}, ${colors[1]})`,
        boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.22), 0 4px 0 rgba(0,0,0,0.45)',
      }}
    >
      {/* The glossy strip every button in this game wears. */}
      <span className="pointer-events-none absolute inset-x-3 top-1 h-1.5 rounded-full bg-white/35" />
      {children}
    </button>
  )
}

/** One "current" or "after" tile: an emoji and the value it stands for. */
function Tile({ emoji, value, bright, touch }) {
  return (
    <div
      className={`flex w-full items-center justify-center gap-2 rounded-xl border-4 ${
        touch ? 'py-1.5' : 'py-3'
      }`}
      style={{
        borderColor: INK,
        background: bright
          ? 'linear-gradient(to bottom, #ffd76a, #f0a000)'
          : 'linear-gradient(to bottom, #b9833f, #8a5c26)',
        boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.22)',
      }}
    >
      <span className={touch ? 'text-2xl' : 'text-4xl'} aria-hidden>
        {emoji}
      </span>
      <span className={`text-white ${touch ? 'text-2xl' : 'text-4xl'}`} style={OUTLINE}>
        {value}
      </span>
    </div>
  )
}

/** A "current -> after" row: two tiles with an arrow between them. */
function TradeRow({ emoji, from, to, touch }) {
  return (
    <div className={`flex items-center ${touch ? 'gap-1.5' : 'gap-3'}`}>
      <div className="flex flex-1 flex-col items-center gap-1">
        <span className={`text-white/80 ${touch ? 'text-xs' : 'text-lg'}`} style={CHIP}>
          Current
        </span>
        <Tile emoji={emoji} value={from} touch={touch} />
      </div>
      <span className={`text-white ${touch ? 'text-xl' : 'text-3xl'}`} style={OUTLINE} aria-hidden>
        &#9654;
      </span>
      <div className="flex flex-1 flex-col items-center gap-1">
        <span className={`text-white/80 ${touch ? 'text-xs' : 'text-lg'}`} style={CHIP}>
          After
        </span>
        <Tile emoji={emoji} value={to} bright touch={touch} />
      </div>
    </div>
  )
}

/**
 * The dialog itself, mounted only while the panel is open.
 *
 * Split out for the sake of one piece of state: the confirm step re-arms because
 * this component goes away when the panel closes, rather than because something
 * watches for the close and resets it. A half-finished confirm is never left waiting
 * for a second press the player has long since forgotten making the first one.
 */
function RebirthDialog() {
  const power = useGame((s) => s.power)
  const rebirths = useGame((s) => s.rebirths)
  const touch = useTouchDevice()
  // Two presses, always. The first only asks; nothing is spent until the second.
  const [confirming, setConfirming] = useState(false)

  // Escape closes it, like every other overlay.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape') useGame.getState().toggleRebirthPanel(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const maxedOut = rebirths >= MAX_REBIRTHS
  const need = rebirthPower(rebirths)
  const ready = canRebirth(power, rebirths)
  const fraction = maxedOut ? 1 : Math.min(1, power / need)
  const close = () => useGame.getState().toggleRebirthPanel(false)

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className={`w-full rounded-2xl border-4 ${touch ? 'max-w-sm p-2' : 'max-w-xl p-4'}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          borderColor: INK,
          background: 'linear-gradient(to bottom, #5a4a7a, #3a2f52)',
          boxShadow: '0 10px 0 rgba(0,0,0,0.45)',
        }}
      >
        {/* Header: the title, the level you are on, and the way out. */}
        <div className={`flex items-center justify-between ${touch ? 'mb-2' : 'mb-4'}`}>
          <span className={`text-white ${touch ? 'text-2xl' : 'text-4xl'}`} style={OUTLINE}>
            Rebirth
          </span>
          <div className={`flex items-center ${touch ? 'gap-2' : 'gap-3'}`}>
            <span className={`text-white/90 ${touch ? 'text-base' : 'text-2xl'}`} style={OUTLINE}>
              Level {levelFor(power)}
            </span>
            <PanelButton
              colors={['#ff6a6a', '#d02b2b']}
              onClick={close}
              className={touch ? 'text-lg' : 'text-2xl'}
            >
              &#10006;
            </PanelButton>
          </div>
        </div>

        <div className={`flex flex-col ${touch ? 'gap-2' : 'gap-3'}`}>
          <TradeRow
            emoji="⚔️"
            from={`x${rebirthMultiplier(rebirths)}`}
            to={maxedOut ? 'MAX' : `x${rebirthMultiplier(rebirths + 1)}`}
            touch={touch}
          />
          <TradeRow
            emoji="⭐"
            from={rebirths}
            to={maxedOut ? 'MAX' : rebirths + 1}
            touch={touch}
          />

          {/*
            How close the next one is, measured in Power rather than in levels. The
            level bar tops out at MAX_LEVEL long before the later rebirths are
            affordable, so a level reading would sit at "full" for hours and tell the
            player nothing about the thing they are actually waiting for.
          */}
          <div
            className={`relative overflow-hidden rounded-xl border-4 ${touch ? 'h-9' : 'h-14'}`}
            style={{ borderColor: INK, background: '#2a2140' }}
          >
            <div
              className="absolute inset-y-0 left-0 transition-[width] duration-300"
              style={{
                width: `${fraction * 100}%`,
                background: 'linear-gradient(to bottom, #c77dff, #7a42c8)',
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-white ${touch ? 'text-sm' : 'text-2xl'}`} style={OUTLINE}>
                {maxedOut
                  ? 'Every Rebirth done!'
                  : `${formatNumber(power)} / ${formatNumber(need)} Power`}
              </span>
            </div>
          </div>

          <PanelButton
            colors={confirming ? ['#ffd76a', '#f0a000'] : ['#7ce86a', '#2f9e44']}
            disabled={!ready}
            onClick={() => (confirming ? useGame.getState().rebirth() : setConfirming(true))}
            className={touch ? 'text-xl' : 'text-3xl'}
          >
            {maxedOut
              ? 'Nothing left to Rebirth'
              : !ready
                ? `Reach Level ${MAX_LEVEL} to Rebirth`
                : confirming
                  ? 'Tap again to confirm'
                  : 'Rebirth'}
          </PanelButton>

          <span
            className={`text-center text-white/75 ${touch ? 'text-[11px]' : 'text-base'}`}
            style={CHIP}
          >
            Only Power is spent. Your Wins, swords, pets and trainers all stay.
          </span>
        </div>
      </div>
    </div>
  )
}

export function RebirthPanel() {
  const open = useGame((s) => s.rebirthOpen)
  return open ? <RebirthDialog /> : null
}

/** The left-rail button that opens the panel. */
export function RebirthButton() {
  const touch = useTouchDevice()
  const power = useGame((s) => s.power)
  const rebirths = useGame((s) => s.rebirths)
  const ready = canRebirth(power, rebirths)

  return (
    <button
      type="button"
      onClick={() => useGame.getState().toggleRebirthPanel()}
      className={`pointer-events-auto relative mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl transition duration-100 hover:brightness-110 active:translate-y-0.5 ${
        touch ? 'h-11 w-11 border-2' : 'h-16 w-16 border-4'
      }`}
      style={{
        borderColor: INK,
        background: 'linear-gradient(to bottom, #c77dff, #7a42c8)',
        boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.22), 0 4px 0 rgba(0,0,0,0.45)',
      }}
    >
      <span className="pointer-events-none absolute inset-x-2 top-1 h-1.5 rounded-full bg-white/35" />
      <span className={touch ? 'text-lg' : 'text-2xl'} aria-hidden>
        🔄
      </span>
      {/* Two sizes down from the Pets tile next to it: "Rebirth" is three letters
          longer than "Pets" and ran off both sides of the button at text-sm. */}
      <span className={`leading-none text-white ${touch ? 'text-[8px]' : 'text-[11px]'}`} style={CHIP}>
        Rebirth
      </span>
      {/* The star count once there is one, and a "!" the moment another is
          affordable - a panel nobody has opened is a panel nobody knows about. */}
      {rebirths > 0 && (
        <span
          className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 px-1 text-[11px] text-white"
          style={{ ...CHIP, borderColor: INK, background: '#f0a000' }}
        >
          {rebirths}
        </span>
      )}
      {ready && (
        <span
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 animate-pulse items-center justify-center rounded-full border-2 text-[11px] text-white"
          style={{ ...CHIP, borderColor: INK, background: '#e3342f' }}
        >
          !
        </span>
      )}
    </button>
  )
}

export default RebirthPanel
