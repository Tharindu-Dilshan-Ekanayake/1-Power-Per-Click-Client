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

/** Power, Wins, the equipped sword, and toast messages. */
export function GameHUD() {
  const power = useGame((s) => s.power)
  const wins = useGame((s) => s.wins)
  const equipped = useGame((s) => s.equipped)
  const message = useGame((s) => s.message)
  const activeTrainer = useGame((s) => s.activeTrainer)
  const sword = getSword(equipped)
  const trainer = getTrainer(activeTrainer)

  return (
    <>
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
        <div className="text-4xl text-white">
          Power: <span className="text-yellow-300">{formatNumber(power)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 text-xl">
          <span className="text-amber-300">{formatNumber(wins)} Wins</span>
          <span className="text-sky-300">
            {sword.name} +{formatNumber(sword.power)}/click
          </span>
          {trainer && <span className="text-lime-300">Training {trainer.multiplier}x</span>}
        </div>
      </div>
    </>
  )
}

export default GameHUD
