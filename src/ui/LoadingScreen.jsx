import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

import { useBloxity } from '../bloxity/BloxityContext'
import { useLoading } from '../game/loadingStore'

/** Chunky outlined game text, as in the HUD. */
const OUTLINE = {
  fontFamily: '"Arial Black", "Segoe UI Black", Impact, sans-serif',
  WebkitTextStroke: '2px #111',
  textShadow: '0 4px 0 rgba(0,0,0,0.85), 0 0 10px rgba(0,0,0,0.5)',
}

/** Past this, the game opens even if the avatar is still downloading (a stand-in is shown). */
const AVATAR_TIMEOUT_MS = 15000
/** Past this, a "still loading" note appears. */
const SLOW_MS = 12000
const FADE_MS = 600
const TIP_MS = 3200

const TIPS = [
  'Break 10 walls to reach the next stage!',
  'Hold E on a Win pad to cash in your Wins.',
  'Stand on a Train pad and it swings for you.',
  'Better swords give more Power per click.',
  'Broken walls rebuild when you go back to the lobby.',
]

function Sword() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="loading-swing h-24 w-24 drop-shadow-[0_5px_0_rgba(0,0,0,0.8)]">
      <defs>
        <linearGradient id="loading-blade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#8fd3ff" />
        </linearGradient>
      </defs>
      <g stroke="#1b1b25" strokeWidth="5" strokeLinejoin="round">
        <path d="M50 4 L59 17 L59 62 L41 62 L41 17 Z" fill="url(#loading-blade)" />
        <rect x="27" y="62" width="46" height="10" rx="3" fill="#ffc93c" />
        <rect x="44" y="72" width="12" height="16" fill="#8a5a2b" />
        <rect x="40" y="86" width="20" height="9" rx="4" fill="#ffc93c" />
      </g>
    </svg>
  )
}

/**
 * Full-screen loading screen over the game: title, a swinging sword, a progress bar
 * and tips. Fades out once the map has been drawn and the avatar is ready (or after
 * AVATAR_TIMEOUT_MS, with a stand-in body in its place).
 */
export function LoadingScreen() {
  const world = useLoading((s) => s.world)
  const avatar = useLoading((s) => s.avatar)
  const { status } = useBloxity()
  const { progress: downloaded, active } = useProgress()

  const [avatarTimedOut, setAvatarTimedOut] = useState(false)
  const [slow, setSlow] = useState(false)
  const [tip, setTip] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const timers = [
      setTimeout(() => setAvatarTimedOut(true), AVATAR_TIMEOUT_MS),
      setTimeout(() => setSlow(true), SLOW_MS),
    ]
    const tips = setInterval(() => setTip((i) => (i + 1) % TIPS.length), TIP_MS)
    return () => {
      timers.forEach(clearTimeout)
      clearInterval(tips)
    }
  }, [])

  const done = world && (avatar || avatarTimedOut)

  // Let the bar reach the end, then fade, then unmount.
  useEffect(() => {
    if (!done) return
    const fade = setTimeout(() => setLeaving(true), 450)
    const remove = setTimeout(() => setGone(true), 450 + FADE_MS)
    return () => {
      clearTimeout(fade)
      clearTimeout(remove)
    }
  }, [done])

  if (gone) return null

  const connected = status === 'ready' || status === 'error'
  const progress = done
    ? 1
    : 0.08 +
      (connected ? 0.12 : 0) +
      (world ? 0.45 : 0) +
      (avatar ? 0.35 : 0.3 * (active ? downloaded / 100 : 0))
  const step = done
    ? "Let's go!"
    : !world
      ? 'Building the world…'
      : !avatar
        ? 'Loading your avatar…'
        : 'Almost there…'

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6 text-center transition-opacity"
      style={{
        opacity: leaving ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`,
        pointerEvents: leaving ? 'none' : 'auto',
        background: 'radial-gradient(circle at 50% 35%, #5b8cff 0%, #3b2a8f 55%, #170f3a 100%)',
      }}
    >
      <Sword />
      <div style={OUTLINE} className="leading-none">
        <div className="text-6xl text-yellow-300 sm:text-7xl">+1 POWER</div>
        <div className="mt-2 text-4xl text-white sm:text-5xl">PER CLICK</div>
      </div>

      <div className="w-full max-w-md">
        <div className="relative h-9 overflow-hidden rounded-xl border-4 border-[#1b1b25] bg-[#3a2a12] shadow-[0_5px_0_rgba(0,0,0,0.6)]">
          <div
            className="loading-stripes h-full rounded-md bg-gradient-to-b from-yellow-300 to-orange-500 transition-[width] duration-500 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-lg text-white" style={OUTLINE}>
            {Math.round(progress * 100)}%
          </div>
        </div>
        <div className="mt-3 text-xl text-white" style={OUTLINE}>
          {step}
        </div>
      </div>

      <div key={tip} className="tip-fade max-w-md text-base font-semibold text-sky-100">
        💡 {TIPS[tip]}
      </div>
      {slow && !done && (
        <div className="text-sm text-white/70">Slow connection? Still loading, hang on…</div>
      )}
    </div>
  )
}

export default LoadingScreen
