/** Static control hints, top left under the Wins counter. */
export function Controls() {
  const rows = [
    ['W A S D', 'move'],
    ['Space', 'jump'],
    ['Shift', 'sprint'],
    ['Left-click', 'swing sword / hit walls'],
    ['E', 'buy / unlock / equip / open'],
    ['Train pad', 'swings for you'],
    ['Hold E', 'cash in at a Win pad'],
    ['Right-drag', 'rotate camera'],
    ['Scroll', 'zoom'],
    ['M', 'sound on / off'],
  ]

  return (
    <div className="">
      {/* {rows.map(([key, action]) => (
       <div key={key}>
        <span className="font-semibold text-white">{key}</span> {action}
        </div>
      ))} */}
      
    </div>
  )
}

export default Controls
