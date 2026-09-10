import { Billboard, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { AdditiveBlending } from 'three'

import { formatNumber } from '../format'
import { useGame } from '../gameStore'
import { Label } from './Effects'
import InteractPrompt from './InteractPrompt'
import { radialGlowTexture, shade } from './textures'

/** Voxel egg silhouette, bottom to top: [width, height, colour index]. */
const LAYERS = [
  [1.1, 0.3, 0],
  [1.6, 0.35, 0],
  [1.9, 0.4, 1],
  [2.0, 0.45, 0],
  [1.9, 0.4, 0],
  [1.6, 0.35, 1],
  [1.2, 0.3, 0],
  [0.7, 0.25, 0],
]
/** Centre height of each layer. */
const LAYER_Y = LAYERS.map(([, h], i) => LAYERS.slice(0, i).reduce((sum, [, lh]) => sum + lh, 0) + h / 2)
const EGG_HEIGHT = LAYERS.reduce((sum, [, h]) => sum + h, 0)
/** Accent spots poking out of the widest layer: [x, z]. */
const SPOTS = [
  [1.0, 0.35],
  [-1.0, -0.4],
  [0.3, 1.0],
  [-0.4, -1.0],
]
const WIDEST = 3
const STAND_TOP = 0.42
const LIFT = 0.25
const GOLD = ['#fff6a8', '#ffc21a']

function EggModel({ egg }) {
  const glow = egg.glow ?? 0
  const materials = egg.colors.map((color) => (
    <meshStandardMaterial key={color} color={color} emissive={color} emissiveIntensity={glow} roughness={0.5} />
  ))
  return (
    <group>
      {LAYERS.map(([w, h, ci], i) => (
        <mesh key={i} position={[0, LAYER_Y[i], 0]} castShadow>
          <boxGeometry args={[w, h, w]} />
          {materials[ci]}
        </mesh>
      ))}
      {SPOTS.map(([x, z], i) => (
        <mesh key={`spot-${i}`} position={[x, LAYER_Y[WIDEST], z]}>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          {materials[1]}
        </mesh>
      ))}
    </group>
  )
}

/**
 * An egg spinning over a glowing round stand, with its name and price above.
 * Walking up to it shows an E prompt to open it; hatching isn't built yet, so for
 * now opening just says so.
 *
 * @param {{ egg: object, position: number[] }} props
 */
export function EggStand({ egg, position }) {
  const eggRef = useRef(null)
  const aura = useRef(null)
  const glow = egg.glow ?? 0

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (eggRef.current) {
      eggRef.current.rotation.y += delta * 0.6
      eggRef.current.position.y = STAND_TOP + LIFT + Math.sin(t * 1.5 + position[2]) * 0.12
    }
    if (aura.current) aura.current.opacity = 0.3 + 0.12 * Math.sin(t * 2 + position[2])
  })

  const inRange = useGame((s) => s.interact?.kind === 'egg' && s.interact.id === egg.id)

  const onEnter = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().setInteract('egg', egg.id)
  }
  const onExit = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().clearInteract('egg', egg.id)
  }

  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.7, 0.3, 24]} />
        <meshStandardMaterial color={shade(egg.colors[1], -0.35)} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[1.25, 1.35, 0.12, 24]} />
        <meshStandardMaterial color={egg.colors[0]} emissive={egg.colors[0]} emissiveIntensity={0.4} />
      </mesh>

      <group ref={eggRef} position={[0, STAND_TOP + LIFT, 0]}>
        <EggModel egg={egg} />
      </group>

      {glow > 0 && (
        <>
          <Billboard position={[0, STAND_TOP + EGG_HEIGHT / 2, 0]}>
            <mesh>
              <planeGeometry args={[3.4, EGG_HEIGHT * 1.6]} />
              <meshBasicMaterial
                ref={aura}
                map={radialGlowTexture()}
                color={egg.colors[0]}
                transparent
                opacity={0.35}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </Billboard>
          <Sparkles
            count={16}
            scale={[2.6, EGG_HEIGHT + 1, 2.6]}
            position={[0, STAND_TOP + EGG_HEIGHT / 2, 0]}
            size={4}
            speed={0.5}
            color={egg.colors[1]}
          />
        </>
      )}

      <Billboard position={[0, STAND_TOP + EGG_HEIGHT + 1.3, 0]}>
        <Label
          lines={[
            { text: egg.name, scale: 1.2 },
            { text: `${formatNumber(egg.cost)} Wins`, icon: 'trophy', fill: GOLD },
          ]}
          position={[0, 0, 0]}
          size={[3.6, 1.5]}
          style={{ width: 512 }}
        />
      </Billboard>

      <RigidBody type="fixed" colliders={false}>
        {/* Solid stand and egg, plus a wider sensor for walking up to it. */}
        <CuboidCollider args={[1.1, 1.6, 1.1]} position={[0, 1.6, 0]} />
        <CuboidCollider
          sensor
          args={[2, 1, 2]}
          position={[0, 1, 0]}
          onIntersectionEnter={onEnter}
          onIntersectionExit={onExit}
        />
      </RigidBody>

      {inRange && (
        <InteractPrompt
          position={[0, 1.8, 0]}
          action="Open"
          title={egg.name}
          detail={`🏆 ${formatNumber(egg.cost)} Wins`}
        />
      )}
    </group>
  )
}

export default EggStand
