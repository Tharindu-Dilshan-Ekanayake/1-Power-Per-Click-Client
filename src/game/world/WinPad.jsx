import { Billboard, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { AdditiveBlending, DoubleSide } from 'three'

import { formatNumber } from '../format'
import { useGame } from '../gameStore'
import { HOLD_S, padPower, padWins } from '../walls'
import { Label } from './Effects'
import InteractPrompt, { HOLD_RING } from './InteractPrompt'
import { beamTexture, radialGlowTexture, shade, studTexture } from './textures'
import { SPAWN } from './themes'

const SIZE = 3.2
const BEAM_H = 3.2

/**
 * A glowing Win pad in front of a stage wall. Step on it and hold E: a ring fills
 * around the key, then you're paid the pad's Wins and sent back to the lobby, where
 * every broken wall rebuilds.
 *
 * @param {{ number: number, pad: object, position: number[] }} props
 *   `number` is the wall it stands before; `pad` is an entry of WIN_PADS.
 */
export function WinPad({ number, pad, position }) {
  const key = `${number}:${pad.id}`
  const needed = padPower(number, pad)
  const gain = padWins(number, pad)
  const unlocked = useGame((s) => s.power >= needed)
  const inRange = useGame((s) => s.interact?.kind === 'pad' && s.interact.id === key)

  const top = useRef(null)
  const halo = useRef(null)
  const beam = useRef(null)
  const ring = useRef(null)
  /** The player's rigid body, from the sensor, for the trip home. */
  const playerBody = useRef(null)

  useFrame(({ clock }) => {
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3 + number)
    if (top.current) top.current.emissiveIntensity = unlocked ? (inRange ? 1.1 : 0.75) + 0.15 * pulse : 0.12
    if (halo.current) halo.current.opacity = unlocked ? 0.55 + 0.2 * pulse : 0.1
    if (beam.current) beam.current.opacity = unlocked ? 0.22 + 0.1 * pulse : 0

    const game = useGame.getState()
    const held = game.interact?.kind === 'pad' && game.interact.id === key && game.holdingSince !== null
    const progress = held ? (performance.now() / 1000 - game.holdingSince) / HOLD_S : 0
    if (ring.current) ring.current.style.strokeDashoffset = String(HOLD_RING * (1 - Math.min(1, progress)))

    if (progress >= 1) {
      const body = playerBody.current
      if (game.claimPad(number, pad) && body) {
        body.setTranslation({ x: SPAWN[0], y: SPAWN[1], z: SPAWN[2] }, true)
        body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      } else {
        game.interactEnd()
      }
    }
  })

  const onEnter = ({ other }) => {
    if (other.rigidBodyObject?.name !== 'player') return
    playerBody.current = other.rigidBody
    useGame.getState().setInteract('pad', key)
  }
  const onExit = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().clearInteract('pad', key)
  }

  const map = studTexture([pad.color], { cells: 1, studsPerCell: 6 })

  return (
    <group position={position}>
      {/* Dark trim, then the bright studded tile. */}
      <mesh position={[0, 0.07, 0]} receiveShadow>
        <boxGeometry args={[SIZE + 0.4, 0.14, SIZE + 0.4]} />
        <meshStandardMaterial color={shade(pad.color, -0.55)} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[SIZE, 0.14, SIZE]} />
        <meshStandardMaterial
          ref={top}
          map={map}
          color={unlocked ? '#ffffff' : '#8a8a8a'}
          emissive={pad.color}
          emissiveMap={map}
          emissiveIntensity={0.75}
          roughness={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* Soft glow on the floor around it and a faint square beam. */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SIZE * 2.4, SIZE * 2.4]} />
        <meshBasicMaterial
          ref={halo}
          map={radialGlowTexture()}
          color={pad.color}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.23 + BEAM_H / 2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[(SIZE / 2) * Math.SQRT2 * 0.95, (SIZE / 2) * Math.SQRT2, BEAM_H, 4, 1, true]} />
        <meshBasicMaterial
          ref={beam}
          map={beamTexture()}
          color={pad.color}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {unlocked && (
        <Sparkles
          count={18}
          scale={[SIZE, BEAM_H, SIZE]}
          position={[0, BEAM_H / 2, 0]}
          size={5}
          speed={0.6}
          color={pad.color}
        />
      )}

      <Billboard position={[0, 3.2, 0]}>
        <Label
          lines={[
            { text: `+${formatNumber(gain)} Wins`, icon: 'trophy', fill: unlocked ? pad.fill : ['#e0e0e0', '#9a9a9a'] },
            unlocked
              ? { text: 'HOLD E TO CLAIM', scale: 0.55, fill: '#ffffff' }
              : { text: `NEED ${formatNumber(needed)} POWER`, scale: 0.55, fill: '#ff8a8a' },
          ]}
          position={[0, 0, 0]}
          size={[3.8, 1.5]}
          style={{ width: 384 }}
        />
      </Billboard>

      {inRange && (
        <InteractPrompt
          position={[0, 1.2, 0]}
          hold
          ringRef={ring}
          action={unlocked ? 'Hold E' : 'Locked'}
          title={`+${formatNumber(gain)} Wins`}
          detail={unlocked ? 'Cash in and go back to the lobby' : `Need ${formatNumber(needed)} Power`}
          tone={unlocked ? 'normal' : 'warn'}
        />
      )}

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          sensor
          args={[SIZE / 2, 1, SIZE / 2]}
          position={[0, 1, 0]}
          onIntersectionEnter={onEnter}
          onIntersectionExit={onExit}
        />
      </RigidBody>
    </group>
  )
}

export default WinPad
