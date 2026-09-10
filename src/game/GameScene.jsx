import { Environment } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { useBloxity } from '../bloxity/BloxityContext'
import FollowCamera from './FollowCamera'
import Player from './Player'
import { SPAWN } from './world/themes'
import World, { SunLight } from './world/World'

/**
 * Fires `onFirstFrame` after the renderer has actually drawn once.
 * `loadingEnd()` should mean "the player can see the game", not "React mounted".
 */
function FirstFrameSignal({ onFirstFrame }) {
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    fired.current = true
    onFirstFrame()
  })
  return null
}

export function GameScene() {
  const { game } = useBloxity()
  const playerBodyRef = useRef(null)

  const [avatarReady, setAvatarReady] = useState(false)
  const loadingEnded = useRef(false)

  const handleAvatarReady = useCallback(() => setAvatarReady(true), [])

  // Only end the loading screen once the avatar has finished assembling *and* a
  // frame has rendered with it in place.
  const handleFirstFrame = useCallback(() => {
    if (loadingEnded.current || !avatarReady) return
    loadingEnded.current = true
    game.loadingEnd()
  }, [avatarReady, game])

  // The first frame usually renders before the avatar finishes downloading, so the
  // frame callback alone isn't enough — close the loading screen here too.
  useEffect(() => {
    if (!avatarReady || loadingEnded.current) return
    loadingEnded.current = true
    game.loadingEnd()
  }, [avatarReady, game])

  useEffect(() => {
    game.loadingStep('Preparing scene…')
  }, [game])

  return (
    <Canvas
      shadows
      camera={{ position: [0, 5, 40], fov: 60, far: 1200 }}
      onCreated={({ gl }) => gl.setClearColor('#bfe4ff')}
    >
      <fog attach="fog" args={['#cfeaff', 140, 420]} />
      <hemisphereLight args={['#d6ecff', '#6b8f5a', 0.7]} />
      <SunLight bodyRef={playerBodyRef} />

      <Suspense fallback={null}>
        <Environment preset="city" environmentIntensity={0.35} />
        <Physics gravity={[0, -18, 0]}>
          <World />
          <Player
            bodyRef={playerBodyRef}
            position={SPAWN}
            onAvatarReady={handleAvatarReady}
          />
        </Physics>
      </Suspense>

      <FollowCamera bodyRef={playerBodyRef} />
      <FirstFrameSignal onFirstFrame={handleFirstFrame} />
    </Canvas>
  )
}

export default GameScene
