import { useTouchDevice } from '../game/device'

/** [key, what it does] — the whole control scheme, in the order you meet it. */
const ROWS = [
  ['W  S', 'walk forward / back'],
  ['A  D', 'turn the camera'],
  ['Space', 'jump'],
  ['Shift', 'sprint'],
  ['Left-click', 'swing sword / hit walls'],
  ['E', 'buy / unlock / equip / open'],
  ['Hold E', 'cash in at a Win pad'],
  ['Right-drag', 'turn the camera'],
  ['Scroll', 'zoom'],
  ['M', 'sound on / off'],
]

/**
 * Control hints, down the left side.
 *
 * Sat at bottom-4 to begin with and landed straight on top of the Speed / Power
 * readout, which is anchored to the same corner - hence the clearance below, which
 * is roughly the height of the whole bottom HUD block (Power line, level bar and
 * the boost row under it).
 *
 * Deliberately quiet: low contrast, and nothing here is interactive, so the block
 * stays out of the way of clicks on the canvas behind it.
 */
export function Controls() {
  // Nothing here applies to a phone, and the list stands exactly where the
  // thumbstick goes. TouchControls is the control scheme there.
  const touch = useTouchDevice()
  if (touch) return null

  return (
    <div className="pointer-events-none absolute bottom-60 left-4 z-10 flex flex-col gap-0.5 text-sm text-white/70">
      {ROWS.map(([key, action]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span
            className="min-w-20 rounded border border-white/25 bg-black/35 px-1.5 py-0.5 text-center font-semibold text-white"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
          >
            {key}
          </span>
          <span style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>{action}</span>
        </div>
      ))}
    </div>
  )
}

export default Controls
