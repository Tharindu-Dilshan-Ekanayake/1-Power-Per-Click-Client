import { Html } from '@react-three/drei'

import { useGame } from '../gameStore'

const DETAIL_TONE = {
  normal: 'text-amber-200',
  warn: 'text-red-300',
  done: 'text-lime-300',
}

/**
 * "Press E" card floating by whatever the player can act on. Clicking the card does
 * the same as pressing E.
 *
 * @param {{ position: number[], action: string, title: string, detail?: string,
 *           tone?: 'normal' | 'warn' | 'done' }} props
 */
export function InteractPrompt({ position, action, title, detail, tone = 'normal' }) {
  return (
    <Html position={position} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
      <button
        type="button"
        onClick={() => useGame.getState().interactNow()}
        className="prompt-pop pointer-events-auto flex items-center gap-3 whitespace-nowrap rounded-2xl border-2 border-white/40 bg-slate-900/80 px-3 py-2 text-left text-white shadow-xl backdrop-blur"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border-b-4 border-slate-400 bg-white text-xl font-black text-slate-900">
          E
        </span>
        <span className="leading-tight">
          <span className="block text-lg font-black">{action}</span>
          <span className="block text-sm font-semibold text-white/80">{title}</span>
          {detail && <span className={`block text-xs font-bold ${DETAIL_TONE[tone]}`}>{detail}</span>}
        </span>
      </button>
    </Html>
  )
}

export default InteractPrompt
