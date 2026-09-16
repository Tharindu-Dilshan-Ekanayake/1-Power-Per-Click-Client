import { Environment, Lightformer } from '@react-three/drei'
import { Canvas, useFrame, useStore } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { useBloxity } from '../bloxity/BloxityContext'
import FollowCamera from './FollowCamera'
import { useLoading } from './loadingStore'
import NetSync from './NetSync'
import PetCompanion from './PetCompanion'
import Player from './Player'
import RemotePlayers from './RemotePlayers'
import { qualityOf, useSettings } from './settings'
import SwingInput from './SwingInput'
import { SPAWN } from './world/themes'
import World, { SunLight } from './world/World'

/**
 * Turns the shadow map on and off as the graphics level changes. The Canvas only
 * reads its `shadows` prop when it builds the renderer, so switching levels mid-
 * session has to reach `gl.shadowMap` directly - and every material already in the
 * scene needs a recompile to pick the change up.
 */
function ShadowToggle({ enabled }) {
  // Read through the store rather than useThree's selector: the renderer is being
  // reconfigured here, not rendered from, and hook-returned values are read-only.
  const store = useStore()
  useEffect(() => {
    const { gl, scene } = store.getState()
    if (gl.shadowMap.enabled === enabled) return
    gl.shadowMap.enabled = enabled
    gl.shadowMap.needsUpdate = true
    scene.traverse((o) => {
      if (!o.material) return
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true
    })
  }, [enabled, store])
  return null
}

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
  // Graphics level, pushed in from the portal's pause menu (see game/settings.js).
  const quality = useSettings((s) => s.quality)
  const { dpr, shadows } = qualityOf(quality)

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
    // Everything the settings drive (audio graph, renderer, camera) exists by now.
    game.applySettings()
    game.loadingEnd()
  }, [avatarReady, game])

  // The first frame usually renders before the avatar finishes downloading, so the
  // frame callback alone isn't enough — close the loading screen here too.
  useEffect(() => {
    if (!avatarReady || loadingEnded.current) return
    loadingEnded.current = true
    game.applySettings()
    game.loadingEnd()
  }, [avatarReady, game])

  useEffect(() => {
    game.loadingStep('Preparing scene…')
  }, [game])

  return (
    <Canvas
      shadows={shadows}
      dpr={dpr}
      camera={{ position: [0, 5, 40], fov: 60, far: 1200 }}
      onCreated={({ gl }) => gl.setClearColor('#bfe4ff')}
    >
      <ShadowToggle enabled={shadows} />
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
          <PetCompanion bodyRef={playerBodyRef} />
          {/* The other players in our lobby, and sending ours (after each physics step). */}
          <RemotePlayers />
          <NetSync bodyRef={playerBodyRef} />
          {/* Inside Physics: the camera raycasts against the world so it can't be
              pushed through a stage wall. It no-ops until the player body exists. */}
          <FollowCamera bodyRef={playerBodyRef} />
        </Physics>
      </Suspense>

      <SwingInput bodyRef={playerBodyRef} />
      <FirstFrameSignal onFirstFrame={handleFirstFrame} />
    </Canvas>
  )
}

export default GameScene
