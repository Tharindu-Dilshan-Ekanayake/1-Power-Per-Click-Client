import { useEffect } from 'react'

import { formatNumber } from '../game/format'
import { useGame } from '../game/gameStore'
import { getSword } from '../game/swords'
import { getTrainer } from '../game/trainers'

/** Chunky outlined game text. */
const OUTLINE = {
  fontFamily: '"Arial Black", "Segoe UI Black", Impact, sans-serif',
  WebkitTextStroke: '1.5px #111',
  textShadow: '0 3px 0 rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.5)',
}

const TONE = {
  success: 'text-lime-300',
  error: 'text-red-400',
  info: 'text-white',
}

/**
 * Chunky outlined sword in the game's own style (matches the icons on the signs),
 * sized to the surrounding text. Used instead of an emoji, which renders
 * differently, and often small and grey, on every platform.
 */
function SwordIcon() {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="h-[1.3em] w-[1.3em] shrink-0"
      style={{ filter: 'drop-shadow(0 3px 0 rgba(0,0,0,0.85))' }}
    >
      <defs>
        <linearGradient id="popup-blade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#8fd3ff" />
        </linearGradient>
      </defs>
      <g transform="rotate(45 50 50)" stroke="#1b1b25" strokeWidth="6" strokeLinejoin="round">
        <path d="M50 4 L59 17 L59 62 L41 62 L41 17 Z" fill="url(#popup-blade)" />
        <rect x="27" y="62" width="46" height="10" rx="3" fill="#ffc93c" />
        <rect x="44" y="72" width="12" height="16" fill="#8a5a2b" />
        <rect x="40" y="86" width="20" height="9" rx="4" fill="#ffc93c" />
      </g>
    </svg>
  )
}

/** "+N" popups: each pops up where it started, then flies into the Power counter. */
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

/** Power, Wins, the equipped sword, toast messages and click popups; handles E. */
export function GameHUD() {
  const power = useGame((s) => s.power)
  const wins = useGame((s) => s.wins)
  const equipped = useGame((s) => s.equipped)
  const message = useGame((s) => s.message)
  const activeTrainer = useGame((s) => s.activeTrainer)
  const sword = getSword(equipped)
  const trainer = getTrainer(activeTrainer)

  // E acts on whatever sword or egg is in range (see the prompts in the world).
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'KeyE' && !e.repeat) useGame.getState().interactNow()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <ClickPopups />
      {message && (
        <div
          key={message.id}
          className={`pointer-events-none absolute inset-x-0 top-24 z-10 px-4 text-center text-2xl ${TONE[message.tone]}`}
          style={OUTLINE}
        >
          {message.text}
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-1 px-4 text-center"
        style={OUTLINE}
      >
        {power === 0 && (
          <div className="animate-pulse text-xl text-white">Click to swing your sword!</div>
        )}
        {/* Click popups fly to this element; the value bounces each time it changes. */}
        <div data-power-counter className="text-4xl text-white">
          Power:{' '}
          <span key={power} className="power-bump text-yellow-300">
            {formatNumber(power)}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 text-xl">
          <span className="text-amber-300">{formatNumber(wins)} Wins</span>
          <span className="text-sky-300">
            {sword.name} +{formatNumber(sword.power)}/click
          </span>
          {trainer && <span className="text-lime-300">Auto-training {trainer.multiplier}x</span>}
        </div>
      </div>
    </>
  )
}

export default GameHUD
