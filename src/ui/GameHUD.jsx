import { useEffect, useState } from 'react'

import { formatNumber } from '../game/format'
import { powerMultiplier, useGame } from '../game/gameStore'
import { activeBoost, AUTO_CLICKERS, BOOSTS, levelFor, levelPower, MAX_LEVEL, WALK_SPEED } from '../game/progression'
import { getTrainer } from '../game/trainers'

/** Chunky outlined game text. */
const OUTLINE = {
  fontFamily: '"Arial Black", "Segoe UI Black", Impact, sans-serif',
  WebkitTextStroke: '1.5px #111',
  textShadow: '0 3px 0 rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.5)',
}
const ICON_SHADOW = { filter: 'drop-shadow(0 3px 0 rgba(0,0,0,0.85))' }
const INK = '#1b1b25'

const TONE = {
  success: 'text-lime-300',
  error: 'text-red-400',
  info: 'text-white',
}

/** Button faces for the x2 / x4 / x8 boosts: gold, orange, red. */
const BOOST_COLORS = {
  2: ['#ffd84a', '#f0a000'],
  4: ['#ff9448', '#e2521c'],
  8: ['#ff5a5a', '#c81e1e'],
}

// --- Icons: drawn in the same outlined style as the signs, not emoji -----------------

function SwordIcon({ className = 'h-[1.3em] w-[1.3em]' }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 ${className}`} style={ICON_SHADOW}>
      <defs>
        <linearGradient id="hud-blade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#8fd3ff" />
        </linearGradient>
      </defs>
      <g transform="rotate(45 50 50)" stroke={INK} strokeWidth="6" strokeLinejoin="round">
        <path d="M50 4 L59 17 L59 62 L41 62 L41 17 Z" fill="url(#hud-blade)" />
        <rect x="27" y="62" width="46" height="10" rx="3" fill="#ffc93c" />
        <rect x="44" y="72" width="12" height="16" fill="#8a5a2b" />
        <rect x="40" y="86" width="20" height="9" rx="4" fill="#ffc93c" />
      </g>
    </svg>
  )
}

function TrophyIcon({ className }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 ${className}`} style={ICON_SHADOW}>
      <defs>
        <linearGradient id="hud-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3a0" />
          <stop offset="1" stopColor="#f0a800" />
        </linearGradient>
      </defs>
      <g stroke="#2a1a00" strokeWidth="7" strokeLinejoin="round">
        <path d="M24 16 Q6 18 12 34 Q18 46 32 44 M76 16 Q94 18 88 34 Q82 46 68 44" fill="none" />
        <path d="M22 10 H78 L74 44 Q50 68 26 44 Z" fill="url(#hud-gold)" />
        <rect x="42" y="58" width="16" height="16" fill="url(#hud-gold)" />
        <rect x="26" y="74" width="48" height="16" rx="3" fill="url(#hud-gold)" />
      </g>
    </svg>
  )
}

function ShoeIcon({ className }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 ${className}`} style={ICON_SHADOW}>
      <g stroke={INK} strokeWidth="6" strokeLinejoin="round">
        <path d="M10 66 L14 32 Q30 38 40 28 L54 44 Q72 50 88 56 Q95 61 92 70 L12 70 Z" fill="#ff3b4a" />
        <path d="M10 70 H92 V80 H10 Z" fill="#ffffff" />
      </g>
    </svg>
  )
}

function CursorIcon({ rainbow, className }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 ${className}`} style={ICON_SHADOW}>
      <defs>
        <linearGradient id="hud-rainbow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3b6b" />
          <stop offset="0.25" stopColor="#ffb13b" />
          <stop offset="0.5" stopColor="#5aff6a" />
          <stop offset="0.75" stopColor="#3bb8ff" />
          <stop offset="1" stopColor="#b35cff" />
        </linearGradient>
      </defs>
      <path
        d="M22 8 L22 80 L40 64 L52 92 L66 86 L54 58 L78 58 Z"
        fill={rainbow ? 'url(#hud-rainbow)' : '#ffffff'}
        stroke={INK}
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// --- Pieces --------------------------------------------------------------------------

/** A clock that ticks every second, for boost countdowns. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Chunky outlined button: dark border, gradient face and a darker bottom lip. */
function GameButton({ colors, onClick, className = '', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pointer-events-auto relative rounded-xl border-4 transition hover:brightness-110 active:translate-y-0.5 ${className}`}
      style={{
        borderColor: INK,
        background: `linear-gradient(to bottom, ${colors[0]}, ${colors[1]})`,
        boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.22), 0 4px 0 rgba(0,0,0,0.45)',
      }}
    >
      {children}
    </button>
  )
}

/** Wins price in the top-right corner of a button. */
function PriceTag({ cost }) {
  return (
    <span className="absolute -right-2 -top-4 flex items-center gap-0.5 text-lg text-white" style={OUTLINE}>
      <TrophyIcon className="h-6 w-6" />
      {formatNumber(cost)}
    </span>
  )
}

/** "⚔ +N" popups: each pops up where it started, then flies into the Power counter. */
function ClickPopups() {
  const popups = useGame((s) => s.popups)
  return popups.map((p) => (
    <div
      key={p.id}
      className="click-popup pointer-events-none z-20 flex items-center gap-1 whitespace-nowrap text-4xl text-yellow-300"
      style={{ ...OUTLINE, left: p.x, top: p.y, '--dx': `${p.dx}px`, '--dy': `${p.dy}px` }}
    >
      <SwordIcon />
      <span>+{formatNumber(p.gain)}</span>
    </div>
  ))
}

/** Big trophy and Wins total, top left under the player card. */
function WinsCounter() {
  const wins = useGame((s) => s.wins)
  return (
    <div className="pointer-events-none absolute left-4 top-20 z-10 flex items-center gap-2" style={OUTLINE}>
      <TrophyIcon className="h-12 w-12" />
      <span key={wins} className="power-bump text-5xl text-white">
        {formatNumber(wins)}
      </span>
    </div>
  )
}

/** Orange level bar that fills with Power; "MAX" once there's nothing left to reach. */
function LevelBar({ power }) {
  const level = levelFor(power)
  const max = level >= MAX_LEVEL
  const from = levelPower(level)
  const to = levelPower(level + 1)
  const fraction = max ? 1 : Math.min(1, (power - from) / (to - from))
  return (
    <div
      className="relative h-16 overflow-hidden rounded-xl border-4"
      style={{ borderColor: INK, background: '#5a3208', boxShadow: '0 4px 0 rgba(0,0,0,0.45)' }}
    >
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-300"
        style={{ width: `${fraction * 100}%`, background: 'linear-gradient(to bottom, #ffd24a, #ff9a1a 60%, #f07a00)' }}
      />
      <div className="absolute inset-x-3 top-1.5 h-2 rounded-full bg-white/30" />
      <div className="relative flex h-full items-center justify-between gap-3 px-5 text-3xl text-white" style={OUTLINE}>
        <span>Level {level}</span>
        {max ? <span>MAX</span> : <span className="text-2xl">{`${formatNumber(power)} / ${formatNumber(to)}`}</span>}
      </div>
    </div>
  )
}

function BoostButton({ def, now }) {
  const boost = useGame((s) => s.boost)
  const running = activeBoost(boost, now)?.multiplier === def.multiplier
  const left = running ? Math.max(0, Math.ceil((boost.until - now) / 1000)) : 0
  return (
    <GameButton
      colors={BOOST_COLORS[def.multiplier]}
      onClick={() => useGame.getState().buyBoost(def.multiplier)}
      className={`h-16 flex-1 ${running ? 'ring-4 ring-lime-300' : ''}`}
    >
      <span className="flex items-center justify-center gap-2 text-3xl text-white" style={OUTLINE}>
        <SwordIcon className="h-10 w-10" />x{def.multiplier}
      </span>
      {running ? (
        <span
          className="absolute -right-2 -top-4 rounded-md border-2 bg-lime-500 px-1.5 text-base text-white"
          style={{ ...OUTLINE, borderColor: INK }}
        >
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </span>
      ) : (
        <PriceTag cost={def.cost} />
      )}
    </GameButton>
  )
}

function AutoClickerButton({ kind }) {
  const on = useGame((s) => s.autoClick === kind)
  const owned = useGame((s) => s.opAutoOwned)
  const op = kind === 'op'
  const stateText = on ? 'On' : op ? 'Off' : 'Start!'
  const stateColor = on ? 'text-lime-400' : op ? 'text-red-500' : 'text-sky-500'
  return (
    <GameButton
      colors={op ? ['#fff07a', '#ffc21a'] : ['#ffffff', '#dfe6f0']}
      onClick={() => useGame.getState().toggleAutoClick(kind)}
      className={`h-16 w-full ${on ? 'ring-4 ring-lime-300' : ''}`}
    >
      <span
        className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 text-xs text-white"
        style={{ ...OUTLINE, background: INK, WebkitTextStroke: '0' }}
      >
        {op ? 'OP Auto Clicker' : 'Auto Clicker'}
      </span>
      <span className="flex items-center justify-center gap-2 px-2">
        <CursorIcon rainbow={op} className="h-10 w-10" />
        <span className={`text-3xl ${stateColor}`} style={OUTLINE}>
          {stateText}
        </span>
      </span>
      {op && !owned && <PriceTag cost={AUTO_CLICKERS.op.cost} />}
    </GameButton>
  )
}

/**
 * The HUD: toasts, click popups, the Wins counter, and the bottom panel with Power,
 * the level bar, boosts and auto clickers. Also handles E (tap, or hold on Win pads).
 */
export function GameHUD() {
  const power = useGame((s) => s.power)
  const boost = useGame((s) => s.boost)
  const message = useGame((s) => s.message)
  const activeTrainer = useGame((s) => s.activeTrainer)
  const now = useNow()

  const level = levelFor(power)
  const multiplier = powerMultiplier({ power, boost }, now) * (getTrainer(activeTrainer)?.multiplier ?? 1)

  // E acts on whatever is in range (see the prompts in the world); Win pads need it held.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'KeyE' && !e.repeat) useGame.getState().interactStart()
    }
    const onKeyUp = (e) => {
      if (e.code === 'KeyE') useGame.getState().interactEnd()
    }
    const onBlur = () => useGame.getState().interactEnd()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return (
    <>
      <ClickPopups />
      <WinsCounter />
      {message && (
        <div
          key={message.id}
          className={`pointer-events-none absolute inset-x-0 top-24 z-10 px-4 text-center text-2xl ${TONE[message.tone]}`}
          style={OUTLINE}
        >
          {message.text}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex flex-col items-center gap-1 px-4">
        {level >= MAX_LEVEL ? (
          <div className="text-3xl text-red-500" style={OUTLINE}>
            Rebirth needed to level up!
          </div>
        ) : (
          power === 0 && (
            <div className="animate-pulse text-2xl text-white" style={OUTLINE}>
              Click to swing your sword!
            </div>
          )
        )}
        {/* Click popups fly to this element; the value bounces each time it changes. */}
        <div data-power-counter className="text-4xl text-white" style={OUTLINE}>
          Power:{' '}
          <span key={power} className="power-bump text-yellow-300">
            {formatNumber(power)}
          </span>
        </div>

        <div className="mt-1 flex w-full max-w-4xl items-stretch gap-3">
          <div className="flex w-44 shrink-0 flex-col items-end justify-start gap-1 pt-2 text-2xl text-sky-300" style={OUTLINE}>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <ShoeIcon className="h-8 w-8" />
              Speed: {WALK_SPEED}
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <SwordIcon className="h-8 w-8" />
              {multiplier.toFixed(2)}x Power
            </span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <LevelBar power={power} />
            <div className="flex gap-3">
              {BOOSTS.map((def) => (
                <BoostButton key={def.multiplier} def={def} now={now} />
              ))}
            </div>
          </div>

          <div className="flex w-48 shrink-0 flex-col gap-4">
            <AutoClickerButton kind="op" />
            <AutoClickerButton kind="normal" />
          </div>
        </div>
      </div>
    </>
  )
}

export default GameHUD
