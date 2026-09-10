/** Static control hints, top left under the Wins counter. */
export function Controls() {
  const rows = [
    ['W A S D', 'move'],
    ['Space', 'jump'],
    ['Shift', 'sprint'],
    ['Left-click', 'swing sword / hit walls'],
    ['E', 'buy / equip / open'],
    ['Train pad', 'swings for you'],
    ['Hold E', 'cash in at a Win pad'],
    ['Right-drag', 'rotate camera'],
    ['Scroll', 'zoom'],
  ]

  return (
    <div className="pointer-events-none absolute left-4 top-40 z-10 rounded-xl bg-black/50 px-3 py-2 text-xs text-white/80 backdrop-blur">
      {rows.map(([key, action]) => (
        <div key={key}>
          <span className="font-semibold text-white">{key}</span> {action}
        </div>
      ))}
    </div>
  )
}

export default Controls
