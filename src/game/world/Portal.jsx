import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { AdditiveBlending, DoubleSide } from 'three'

import { useGame } from '../gameStore'
import { radialGlowTexture, swirlTexture } from './textures'

const CENTER_Y = 4.2
const RADIUS = 3.3

/**
 * Swirling purple portal. Walking into it teleports the player to `target`.
 * The stone arch around it is part of the static map (see layout.js).
 *
 * @param {{ position: number[], rotationY?: number, target: number[], requiresWall?: number }} props
 *   With `requiresWall`, it only works once that stage wall has been broken.
 */
export function Portal({ position, rotationY = 0, target, requiresWall = 0 }) {
  const front = useRef(null)
  const back = useRef(null)
  const halo = useRef(null)

  useFrame(({ clock }, delta) => {
    if (front.current) front.current.rotation.z -= delta * 1.6
    if (back.current) back.current.rotation.z += delta * 0.9
    if (halo.current) halo.current.opacity = 0.55 + 0.2 * Math.sin(clock.elapsedTime * 2)
  })

  const onEnter = ({ other }) => {
    if (other.rigidBodyObject?.name !== 'player' || !other.rigidBody) return
    const game = useGame.getState()
    if (game.bestWall < requiresWall) {
      game.notify(`Break wall ${requiresWall} to unlock this portal`, 'error')
      return
    }
    other.rigidBody.setTranslation({ x: target[0], y: target[1], z: target[2] }, true)
    other.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh ref={front} position={[0, CENTER_Y, 0.05]}>
        <circleGeometry args={[RADIUS, 48]} />
        <meshBasicMaterial
          map={swirlTexture()}
          transparent
          side={DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={back} position={[0, CENTER_Y, 0.1]} scale={0.75}>
        <circleGeometry args={[RADIUS, 48]} />
        <meshBasicMaterial
          map={swirlTexture()}
          transparent
          opacity={0.6}
          blending={AdditiveBlending}
          side={DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, CENTER_Y, 0.6]}>
        <planeGeometry args={[11, 11]} />
        <meshBasicMaterial
          ref={halo}
          map={radialGlowTexture()}
          color="#b35cff"
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <Sparkles
        count={50}
        scale={[6, 7, 2]}
        position={[0, CENTER_Y, 0.8]}
        size={6}
        speed={0.5}
        color="#e3b8ff"
      />
      <pointLight color="#b35cff" intensity={25} distance={16} position={[0, CENTER_Y, 2]} />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          sensor
          args={[RADIUS, RADIUS + 0.4, 0.5]}
          position={[0, CENTER_Y, 0]}
          onIntersectionEnter={onEnter}
        />
      </RigidBody>
    </group>
  )
}

export default Portal
