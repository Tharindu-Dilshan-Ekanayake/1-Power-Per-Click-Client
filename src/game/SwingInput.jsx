import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { useGame } from './gameStore'
import { AUTO_CLICKERS } from './progression'
import { playSound } from './sound'

/** Seconds between automatic swings while standing on a training pad. */
const AUTO_TRAIN_S = 0.4
const _screen = new Vector3()

/**
 * A click popup's start point and how far it flies to reach the HUD's Power counter,
 * in screen pixels.
 */
function popupPath(x, y) {
  const counter = document.querySelector('[data-power-counter]')?.getBoundingClientRect()
  const tx = counter ? counter.left + counter.width / 2 : window.innerWidth / 2
  const ty = counter ? counter.top + counter.height / 2 : window.innerHeight - 60
  return { x, y, dx: tx - x, dy: ty - y }
}

/**
 * Sword swings. Left-click on the game view swings once (right-click stays with the
 * camera, and HUD elements sit above the canvas so they never reach this); standing
 * on a training pad swings automatically. Each swing sends a "⚔ +N" popup to the
 * Power counter: from the click, or from the player for automatic swings.
 *
 * @param {{ bodyRef: React.MutableRefObject<any> }} props
 */
export function SwingInput({ bodyRef }) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const autoTimer = useRef(0)

  useEffect(() => {
    const el = gl.domElement
    const onPointerDown = (e) => {
      if (e.button !== 0) return
      // The player's position lets a stage wall tell which side it was hit from.
      const p = bodyRef.current?.translation()
      useGame.getState().swing(popupPath(e.clientX, e.clientY), p && [p.x, p.y, p.z])
      playSound('swing')
    }
    el.addEventListener('pointerdown', onPointerDown)
    return () => el.removeEventListener('pointerdown', onPointerDown)
  }, [gl, bodyRef])

  useFrame((_state, delta) => {
    // Training and the auto clickers both swing on a timer; the fastest one wins.
    const game = useGame.getState()
    let interval = Infinity
    if (game.activeTrainer) interval = AUTO_TRAIN_S
    if (game.autoClick !== 'off') interval = Math.min(interval, AUTO_CLICKERS[game.autoClick].interval)
    if (interval === Infinity) {
      autoTimer.current = 0
      return
    }
    autoTimer.current += delta
    if (autoTimer.current < interval) return
    autoTimer.current = 0

    // Start the popup at the player's chest on screen.
    const rect = gl.domElement.getBoundingClientRect()
    let x = rect.left + rect.width / 2
    let y = rect.top + rect.height * 0.55
    const p = bodyRef.current?.translation()
    if (p) {
      _screen.set(p.x, p.y + 1.2, p.z).project(camera)
      x = rect.left + ((_screen.x + 1) / 2) * rect.width
      y = rect.top + ((1 - _screen.y) / 2) * rect.height
    }
    useGame.getState().swing(popupPath(x + (Math.random() - 0.5) * 60, y), p && [p.x, p.y, p.z])
    // Quieter than a click: these repeat for as long as you train.
    playSound('swing', { gain: 0.45 })
  })

  return null
}

export default SwingInput
