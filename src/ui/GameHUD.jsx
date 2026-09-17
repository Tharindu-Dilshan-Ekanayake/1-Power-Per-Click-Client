import { useEffect, useRef, useState } from 'react'

import { topUp, useBux } from '../bloxity/bux'
import { useTouchDevice } from '../game/device'
import { formatBonus, formatNumber } from '../game/format'
import { powerMultiplier, useGame } from '../game/gameStore'
import { petWinsMultiplier } from '../game/pets'
import {
  activeBoost,
  AUTO_CLICKERS,
  BOOSTS,
  levelFor,
  levelPower,
  MAX_LEVEL,
  rebirthMultiplier,
  WALK_SPEED,
} from '../game/progression'
import { getTrainer } from '../game/trainers'
import { PetsButton, PetsPanel } from './PetsPanel'
import { RebirthButton, RebirthPanel } from './RebirthPanel'
import { HUD_STRIP_H, reportStripHeight, useTouchScale } from './touchLayout'

/** Chunky outlined game text. */
const OUTLINE = {
  fontFamily: '"Arial Black", "Segoe UI Black", Impact, sans-serif',
  WebkitTextStroke: '1.5px #111',
  textShadow: '0 3px 0 rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.5)',
}
const ICON_SHADOW = { filter: 'drop-shadow(0 3px 0 rgba(0,0,0,0.85))' }
const INK = '#1b1b25'

/**
 * Toast notice styling per tone: the stripe and timer bar colour, the icon's
 * gradient, and the card's own background.
 */
const NOTICE = {
  success: { accent: '#5fe64c', icon: ['#eaffd8', '#5fe64c'], bg: ['#1d3a26', '#101f17'] },
  error: { accent: '#ff6b6b', icon: ['#ffdede', '#ff5a5a'], bg: ['#3d1c20', '#231216'] },
  info: { accent: '#5cc4ff', icon: ['#eaf9ff', '#5cc4ff'], bg: ['#17304a', '#111b28'] },
}

/**
 * Toast text. Deliberately not OUTLINE: a 1.5px stroke around 20px letters closes
 * up their counters and turns a sentence to mush. The card behind it is dark and
 * solid, so a soft drop shadow is all the contrast it needs.
 */
const NOTICE_TEXT = {
  fontFamily: '"Arial Black", "Segoe UI Black", Impact, sans-serif',
  textShadow: '0 2px 0 rgba(0,0,0,0.55)',
}

/** Button faces for the x2 / x4 / x8 boosts: gold, orange, red. */
const BOOST_COLORS = {
  2: ['#ffd84a', '#f0a000'],
  4: ['#ff9448', '#e2521c'],
  8: ['#ff5a5a', '#c81e1e'],
}

// --- Icons: drawn in the same outlined style as the signs, not emoji -----------------

function SwordIcon({ className = 'h-[1.3em] w-[1.3em]', style }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      style={{ ...ICON_SHADOW, ...style }}
    >
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

function TrophyIcon({ className, style }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      style={{ ...ICON_SHADOW, ...style }}
    >
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

function CursorIcon({ rainbow, className, style }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      style={{ ...ICON_SHADOW, ...style }}
    >
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

/** Bloxity's Bux gem, in the same chunky outlined style as the trophy. */
function BuxIcon({ className }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 ${className}`} style={ICON_SHADOW}>
      <defs>
        <linearGradient id="hud-bux" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bdf3ff" />
          <stop offset="1" stopColor="#0f87ff" />
        </linearGradient>
      </defs>
      <g stroke={INK} strokeWidth="8" strokeLinejoin="round">
        <path d="M28 10 H72 L94 40 L50 92 L6 40 Z" fill="url(#hud-bux)" />
        {/* One waistline only: the full facet web closes up at HUD size. */}
        <path d="M6 40 H94" fill="none" strokeWidth="6" />
      </g>
    </svg>
  )
}

/** Check / warning-triangle / info-circle, in the notice's own gradient. */
function NoticeIcon({ tone, className = 'h-7 w-7' }) {
  const [from, to] = NOTICE[tone].icon
  const gradId = `notice-grad-${tone}`
  const gradient = (
    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={from} />
      <stop offset="1" stopColor={to} />
    </linearGradient>
  )
  if (tone === 'error') {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 ${className}`} style={ICON_SHADOW}>
        <defs>{gradient}</defs>
        <path d="M50 6 L94 88 H6 Z" fill={`url(#${gradId})`} stroke={INK} strokeWidth="7" strokeLinejoin="round" />
        <rect x="44" y="34" width="12" height="30" rx="5" fill={INK} />
        <circle cx="50" cy="76" r="7" fill={INK} />
      </svg>
    )
  }
  if (tone === 'success') {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 ${className}`} style={ICON_SHADOW}>
        <defs>{gradient}</defs>
        <circle cx="50" cy="50" r="44" fill={`url(#${gradId})`} stroke={INK} strokeWidth="7" />
        <path
          d="M30 52 L44 66 L72 34"
          fill="none"
          stroke={INK}
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 ${className}`} style={ICON_SHADOW}>
      <defs>{gradient}</defs>
      <circle cx="50" cy="50" r="44" fill={`url(#${gradId})`} stroke={INK} strokeWidth="7" />
      <circle cx="50" cy="30" r="7" fill={INK} />
      <rect x="42" y="44" width="16" height="34" rx="6" fill={INK} />
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
function GameButton({ colors, onClick, className = '', style, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pointer-events-auto relative rounded-xl border-4 transition hover:brightness-110 active:translate-y-0.5 ${className}`}
      style={{
        borderColor: INK,
        background: `linear-gradient(to bottom, ${colors[0]}, ${colors[1]})`,
        boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.22), 0 4px 0 rgba(0,0,0,0.45)',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/**
 * Wins price in the top-right corner of a button.
 *
 * Shrinks on a phone along with the button it hangs off. At the desktop size it is
 * a 24px trophy sitting 16px above a button that is only 38px tall down there, which
 * is most of a second button's worth of furniture on top of the first.
 */
function PriceTag({ cost }) {
  const touch = useTouchDevice()
  const scale = useTouchScale()
  if (!touch) {
    return (
      <span className="absolute -right-2 -top-4 flex items-center gap-0.5 text-lg text-white" style={OUTLINE}>
        <TrophyIcon className="h-6 w-6" />
        {formatNumber(cost)}
      </span>
    )
  }
  const px = Math.max(13, Math.round(15 * scale))
  return (
    <span
      className="absolute flex items-center gap-0.5 text-white"
      style={{ ...OUTLINE, right: -2, top: -px, fontSize: px, WebkitTextStroke: '1px #111' }}
    >
      <TrophyIcon className="" style={{ width: px, height: px }} />
      {formatNumber(cost)}
    </span>
  )
}

/**
 * The toast that says what just happened. One card, the tone carried by a stripe
 * down its left edge, the icon in its own well, and a bar along the bottom that
 * drains so you can see it's about to go. Keyed on the message id by the caller,
 * so a new message replays the pop from the start.
 *
 * @param {{ message: { text: string, tone: 'success' | 'error' | 'info' } }} props
 */
function Notice({ message }) {
  const tone = NOTICE[message.tone]
  return (
    <div key={message.id} className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center px-4">
      <div
        className="notice-pop relative flex max-w-2xl items-center gap-3 overflow-hidden rounded-2xl border-4 py-3 pl-4 pr-5 shadow-2xl"
        style={{ borderColor: INK, background: `linear-gradient(to bottom, ${tone.bg[0]}, ${tone.bg[1]})` }}
      >
        {/* The tone, read at a glance before a word of it is. */}
        <span className="absolute inset-y-0 left-0 w-2" style={{ background: tone.accent }} />
        <span
          className="ml-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2"
          style={{ borderColor: '#00000066', background: '#00000055' }}
        >
          <NoticeIcon tone={message.tone} className="h-8 w-8" />
        </span>
        <span className="min-w-0 text-pretty text-lg leading-snug text-white sm:text-xl" style={NOTICE_TEXT}>
          {message.text}
        </span>
        {/* Drains over the toast's life, so its leaving is never a surprise. */}
        <span className="notice-timer absolute inset-x-0 bottom-0 h-1.5" style={{ background: tone.accent }} />
      </div>
    </div>
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

/**
 * Bux balance with a top-up button, under the Wins counter.
 *
 * Hidden entirely until a balance has actually been read (see bloxity/bux.js):
 * signed out there is no balance, and a "0" would read as "you're broke" rather
 * than "log in first".
 */
function BuxChip() {
  const balance = useBux((s) => s.balance)
  const busy = useBux((s) => s.busy)
  if (balance === null) return null
  return (
    <div
      className="mt-1.5 flex items-center gap-2 rounded-xl border-4 py-1 pl-2 pr-1"
      style={{
        borderColor: INK,
        background: 'linear-gradient(to bottom, #123a5e, #0a1d30)',
        boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.3), 0 4px 0 rgba(0,0,0,0.45)',
      }}
    >
      <BuxIcon className="h-8 w-8" />
      <span key={balance} className="power-bump text-3xl text-sky-200">
        {formatNumber(balance)}
      </span>
      <button
        type="button"
        onClick={() => topUp()}
        disabled={busy}
        title="Top up Bux"
        className="pointer-events-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-2 pb-0.5 text-2xl leading-none text-white transition hover:brightness-125 active:translate-y-0.5 disabled:opacity-50"
        style={{ borderColor: INK, background: 'linear-gradient(to bottom, #3fb6ff, #0f6fd8)' }}
      >
        +
      </button>
    </div>
  )
}

/**
 * Big trophy and Wins total, top left under the player card, with the pet's Wins
 * multiplier under it whenever one is out (see petWinsMultiplier), and the Bux
 * balance below that.
 */
/**
 * Wins, the pet bonus, Bux and the Pets button, down the left edge.
 *
 * Halved on a phone. At full size this rail reaches far enough down the screen to
 * meet the thumbstick, which on a phone held sideways leaves the two overlapping -
 * and of the two, the one you have to be able to hit is the stick.
 */
function WinsCounter() {
  const touch = useTouchDevice()
  const wins = useGame((s) => s.wins)
  const pets = useGame((s) => s.equippedPets)
  const bonus = petWinsMultiplier(pets)
  return (
    <div
      className={`pointer-events-none absolute z-10 flex flex-col items-start ${
        touch ? 'left-2 top-14' : 'left-4 top-20'
      }`}
      style={OUTLINE}
    >
      <div className={`flex items-center ${touch ? 'gap-1' : 'gap-2'}`}>
        <TrophyIcon className={touch ? 'h-7 w-7' : 'h-12 w-12'} />
        <span key={wins} className={`power-bump text-white ${touch ? 'text-2xl' : 'text-5xl'}`}>
          {formatNumber(wins)}
        </span>
      </div>
      {bonus > 1 && (
        <span className={`ml-1 text-lime-300 ${touch ? 'text-sm' : 'text-2xl'}`}>
          {pets.length} pets · x{formatBonus(bonus)} Wins
        </span>
      )}
      <BuxChip />
      <PetsButton />
      <RebirthButton />
    </div>
  )
}

/** Orange level bar that fills with Power; "MAX" once there's nothing left to reach. */
/**
 * Everything in the bottom panel comes in two sizes.
 *
 * The desktop sizes are what the game was drawn at - big, chunky, readable across a
 * room. On a phone held sideways the same panel is taller than the space left over
 * once the on-screen controls have theirs, so each piece here has a compact form:
 * about half the height, and the same information.
 */
/**
 * Sizes for the boost and auto-clicker buttons on a phone.
 *
 * They scale with the screen like everything else down here, but only so far: a
 * button below about forty pixels is one you miss, and five of them will not fit
 * across a narrow phone at any size worth tapping. So they stop shrinking and the
 * row scrolls sideways instead - which is the honest answer, and the one where every
 * boost is still reachable.
 */
const BUTTON_H = (scale) => Math.max(38, Math.round(40 * scale))
const BOOST_W = (scale) => Math.max(72, Math.round(78 * scale))
const AUTO_W = (scale) => Math.max(96, Math.round(104 * scale))
const ICON_PX = (scale) => Math.max(16, Math.round(18 * scale))

function LevelBar({ power }) {
  const touch = useTouchDevice()
  const scale = useTouchScale()
  const level = levelFor(power)
  const max = level >= MAX_LEVEL
  const from = levelPower(level)
  const to = levelPower(level + 1)
  const fraction = max ? 1 : Math.min(1, (power - from) / (to - from))
  return (
    <div
      className={`relative overflow-hidden rounded-xl ${touch ? 'border-2' : 'h-16 border-4'}`}
      style={{
        borderColor: INK,
        background: '#5a3208',
        boxShadow: '0 4px 0 rgba(0,0,0,0.45)',
        // Floored: below about thirty pixels the text inside stops fitting.
        ...(touch ? { height: Math.max(30, Math.round(34 * scale)) } : null),
      }}
    >
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-300"
        style={{ width: `${fraction * 100}%`, background: 'linear-gradient(to bottom, #ffd24a, #ff9a1a 60%, #f07a00)' }}
      />
      <div className="absolute inset-x-3 top-1.5 h-2 rounded-full bg-white/30" />
      <div
        className={`relative flex h-full items-center justify-between text-white ${
          touch ? 'gap-2 px-2.5 text-sm' : 'gap-3 px-5 text-3xl'
        }`}
        style={OUTLINE}
      >
        <span>Level {level}</span>
        {max ? (
          <span>MAX</span>
        ) : (
          <span className={touch ? 'text-xs' : 'text-2xl'}>{`${formatNumber(power)} / ${formatNumber(to)}`}</span>
        )}
      </div>
    </div>
  )
}

function BoostButton({ def, now }) {
  const touch = useTouchDevice()
  const scale = useTouchScale()
  const boost = useGame((s) => s.boost)
  const running = activeBoost(boost, now)?.multiplier === def.multiplier
  const left = running ? Math.max(0, Math.ceil((boost.until - now) / 1000)) : 0
  return (
    <GameButton
      colors={BOOST_COLORS[def.multiplier]}
      onClick={() => useGame.getState().buyBoost(def.multiplier)}
      className={`${touch ? 'shrink-0' : 'h-16 flex-1'} ${running ? 'ring-4 ring-lime-300' : ''}`}
      style={touch ? { width: BOOST_W(scale), height: BUTTON_H(scale), borderWidth: 2 } : undefined}
    >
      <span
        className={`flex items-center justify-center text-white ${touch ? 'gap-0.5' : 'gap-2 text-3xl'}`}
        style={touch ? { ...OUTLINE, fontSize: Math.max(13, Math.round(16 * scale)) } : OUTLINE}
      >
        <SwordIcon
          className={touch ? '' : 'h-10 w-10'}
          style={touch ? { width: ICON_PX(scale), height: ICON_PX(scale) } : undefined}
        />
        x{def.multiplier}
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
  const touch = useTouchDevice()
  const scale = useTouchScale()
  const on = useGame((s) => s.autoClick === kind)
  const owned = useGame((s) => s.opAutoOwned)
  const op = kind === 'op'
  const stateText = on ? 'On' : op ? 'Off' : 'Start!'
  const stateColor = on ? 'text-lime-400' : op ? 'text-red-500' : 'text-sky-500'
  return (
    <GameButton
      colors={op ? ['#fff07a', '#ffc21a'] : ['#ffffff', '#dfe6f0']}
      onClick={() => useGame.getState().toggleAutoClick(kind)}
      className={`${touch ? 'shrink-0' : 'h-16 w-full'} ${on ? 'ring-4 ring-lime-300' : ''}`}
      style={touch ? { width: AUTO_W(scale), height: BUTTON_H(scale), borderWidth: 2 } : undefined}
    >
      <span
        className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md text-white ${
          touch ? '-top-2 px-1 text-[9px]' : '-top-3 px-2 text-xs'
        }`}
        style={{ ...OUTLINE, background: INK, WebkitTextStroke: '0' }}
      >
        {op ? 'OP Auto Clicker' : 'Auto Clicker'}
      </span>
      <span className={`flex items-center justify-center ${touch ? 'gap-0.5 px-1' : 'gap-2 px-2'}`}>
        <CursorIcon
          rainbow={op}
          className={touch ? '' : 'h-10 w-10'}
          style={touch ? { width: ICON_PX(scale), height: ICON_PX(scale) } : undefined}
        />
        <span
          className={`${touch ? '' : 'text-3xl'} ${stateColor}`}
          style={touch ? { ...OUTLINE, fontSize: Math.max(13, Math.round(15 * scale)) } : OUTLINE}
        >
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
  const touch = useTouchDevice()
  // The panel shrinks with the controls, so the two keep their proportions and the
  // game keeps the middle of the screen (see ui/touchLayout.js).
  const scale = useTouchScale()
  // The controls sit above this panel, so they need to know how tall it came out.
  const strip = useRef(null)
  useEffect(() => {
    const el = strip.current
    if (!touch || !el) return
    const observer = new ResizeObserver(([entry]) => reportStripHeight(entry.contentRect.height))
    observer.observe(el)
    reportStripHeight(el.getBoundingClientRect().height)
    return () => observer.disconnect()
  }, [touch])
  const power = useGame((s) => s.power)
  const rebirths = useGame((s) => s.rebirths)
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
      {/* Wins, the pet bonus, Bux and the Pets button, stacked down the left rail. */}
      <WinsCounter />
      <PetsPanel />
      <RebirthPanel />
      {message && <Notice message={message} />}

      {/*
        On a phone this is a strip along the very bottom of the screen, under the
        on-screen controls rather than above them (see touchLayout.js), and its three
        columns collapse into one: side by side they want about 900px and a phone held
        sideways has 700 at best.

        Under, because the camera holds the player in the middle of the screen and
        anything parked there hides them. The one thing a player has to be able to see
        in a game about hitting things is the thing doing the hitting.

        Power, speed and the multiplier share one line; the boosts and the auto
        clickers share another that scrolls sideways when it has to, so all five stay
        reachable however narrow the screen is.
      */}
      <div
        ref={strip}
        className={`pointer-events-none absolute inset-x-0 z-10 flex flex-col px-2 ${
          touch ? 'bottom-0 items-stretch gap-1 pb-1' : 'bottom-4 items-center gap-1 px-4'
        }`}
        style={
          touch
            ? {
                paddingBottom: 'var(--safe-bottom)',
                // The controls are positioned on the promise that this is how tall
                // the strip gets; holding it here is what keeps that true.
                minHeight: Math.round(HUD_STRIP_H * scale),
                justifyContent: 'flex-end',
              }
            : undefined
        }
      >
        {level >= MAX_LEVEL ? (
          /*
            This used to read "Rebirth needed to level up!" and point at nothing:
            there was no rebirth in the game, so the one instruction it gave a player
            who had maxed the bar was an instruction they could not follow. It opens
            the panel now, and says what the trade is worth.
          */
          <button
            type="button"
            onClick={() => useGame.getState().toggleRebirthPanel(true)}
            className={`pointer-events-auto cursor-pointer text-red-400 transition hover:brightness-125 active:translate-y-0.5 ${
              touch ? 'text-center text-xs' : 'text-3xl'
            }`}
            style={OUTLINE}
          >
            Level {MAX_LEVEL} MAX &#183; Rebirth for x{rebirthMultiplier(rebirths + 1)} Power!
          </button>
        ) : (
          power === 0 && (
            <div
              className={`animate-pulse text-white ${touch ? 'text-center text-xs' : 'text-2xl'}`}
              style={OUTLINE}
            >
              {touch ? 'Tap the sword to swing!' : 'Click to swing your sword!'}
            </div>
          )
        )}

        {touch ? (
          <>
            <div className="flex items-baseline justify-center gap-3 text-white" style={OUTLINE}>
              {/* Click popups fly to this element; the value bounces as it changes. */}
              <span data-power-counter className="text-lg">
                Power:{' '}
                <span key={power} className="power-bump text-yellow-300">
                  {formatNumber(power)}
                </span>
              </span>
              <span className="flex items-center gap-0.5 text-xs text-sky-300">
                <ShoeIcon className="h-4 w-4" />
                {WALK_SPEED}
              </span>
              <span className="flex items-center gap-0.5 text-xs text-sky-300">
                <SwordIcon className="h-4 w-4" />
                {multiplier.toFixed(2)}x
              </span>
            </div>
            <LevelBar power={power} />
            {/* pt-3.5 leaves room for the price tags, which hang above each button. */}
            <div className="pointer-events-auto flex gap-1.5 overflow-x-auto pt-3.5">
              {BOOSTS.map((def) => (
                <BoostButton key={def.multiplier} def={def} now={now} />
              ))}
              <AutoClickerButton kind="op" />
              <AutoClickerButton kind="normal" />
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </>
  )
}

export default GameHUD
