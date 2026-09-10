import { Environment, Lightformer } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { useBloxity } from '../bloxity/BloxityContext'
import FollowCamera from './FollowCamera'
import { useLoading } from './loadingStore'
import Player from './Player'
import SwingInput from './SwingInput'
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

/** Tells the loading screen the map has been drawn (mounted after World, in its Suspense). */
function WorldReady() {
  useFrame(() => {
    const loading = useLoading.getState()
    if (!loading.world) loading.worldReady()
  })
  return null
}

/**
 * Soft reflections and fill light, built from a few light panels in the scene
 * itself. drei's `preset="city"` downloads an HDR file from an external CDN, and
 * until it arrives (or forever, if that host is slow or blocked) everything in the
 * same Suspense stays invisible.
 */
function LocalEnvironment() {
  return (
    <Environment resolution={64} frames={1} environmentIntensity={0.35}>
      <color attach="background" args={['#9fc6e8']} />
      <Lightformer form="rect" intensity={2} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
      <Lightformer
        form="rect"
        intensity={1}
        color="#ffe9c4"
        position={[10, 3, 0]}
        rotation-y={-Math.PI / 2}
        scale={[20, 5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={0.6}
        color="#bfe0ff"
        position={[-10, 3, 0]}
        rotation-y={Math.PI / 2}
        scale={[20, 5, 1]}
      />
    </Environment>
  )
}

export function GameScene() {
  const { game } = useBloxity()
  const playerBodyRef = useRef(null)

  const [avatarReady, setAvatarReady] = useState(false)
  const loadingEnded = useRef(false)

  const handleAvatarReady = useCallback(() => {
    setAvatarReady(true)
    useLoading.getState().avatarReady()
  }, [])

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

      <LocalEnvironment />
      <Suspense fallback={null}>
        <Physics gravity={[0, -18, 0]}>
          <World bodyRef={playerBodyRef} />
          <WorldReady />
          <Player
            bodyRef={playerBodyRef}
            position={SPAWN}
            onAvatarReady={handleAvatarReady}
          />
        </Physics>
      </Suspense>

      <FollowCamera bodyRef={playerBodyRef} />
      <SwingInput bodyRef={playerBodyRef} />
      <FirstFrameSignal onFirstFrame={handleFirstFrame} />
    </Canvas>
  )
}

export default GameScene
