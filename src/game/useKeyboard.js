import { useEffect } from 'react'

import { releaseAll, setKeyboardJump, setKeyboardMove, setKeyboardSprint } from './input'

/**
 * Turns the keyboard into movement (see game/input.js).
 *
 * Nothing is returned and nothing re-renders: the keys are held in a module, which
 * is where the frame loop reads them, so a walk across the lobby costs no renders at
 * all. It is a hook only so that the listeners come and go with the scene.
 */
const KEY_MAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
}

export function useKeyboard() {
  useEffect(() => {
    const held = { forward: false, backward: false, left: false, right: false }

    const push = () => {
      setKeyboardMove(
        (held.right ? 1 : 0) - (held.left ? 1 : 0),
        (held.backward ? 1 : 0) - (held.forward ? 1 : 0),
      )
    }

    const set = (code, value) => {
      const action = KEY_MAP[code]
      if (!action) return
      if (action === 'jump') setKeyboardJump(value)
      else if (action === 'sprint') setKeyboardSprint(value)
      else {
        held[action] = value
        push()
      }
    }

    const onKeyDown = (e) => {
      if (KEY_MAP[e.code]) e.preventDefault() // stop Space scrolling the page
      set(e.code, true)
    }
    const onKeyUp = (e) => set(e.code, false)
    // Alt-tabbing away mid-run otherwise leaves a key stuck down.
    const onBlur = () => {
      for (const action of Object.keys(held)) held[action] = false
      releaseAll()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      onBlur()
    }
  }, [])
}

export default useKeyboard
