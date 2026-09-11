import { Billboard, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { AdditiveBlending, Vector3 } from 'three'

import { formatNumber } from '../format'
import { useGame } from '../gameStore'
import { DUMMY_OFFSET_Z } from '../trainers'
import { Label } from './Effects'
import InteractPrompt from './InteractPrompt'
import PadGlow from './PadGlow'
import { labelTexture, radialGlowTexture, shade, studTexture, targetTexture } from './textures'

/** Delay from click to impact, so the hit lands mid-chop rather than on the wind-up. */
const HIT_DELAY_S = 0.12
const WOBBLE_S = 0.6
const FLASH_S = 0.3
const POPUP_S = 0.9
/** Popups are pooled; this many can be on screen at once. */
const POPUP_COUNT = 6
const HEAD_Y = 3.05
/** How brightly the pad's glow shines: dim while locked, brightest while training. */
const STATUS_GLOW = {
  active: 1.2,
  unlocked: 0.85,
  affordable: 0.85,
  locked: 0.45,
}

const _up = new Vector3(0, 1, 0)

// Small canvas: a new texture is cached for every distinct gain shown.
const popupTexture = (gain) =>
  labelTexture({ lines: [{ text: `+${formatNumber(gain)}`, fill: ['#fff6a8', '#ffc21a'] }], aspect: 2, width: 256 })

/**
 * A training dummy on its pad. Stepping on an unlocked pad starts training; on a
 * locked one an E prompt offers to unlock it, and only E spends the Wins. Every
 * click while training makes the dummy wobble, flashes the target and floats up a
 * "+N" for the Power gained.
 *
 * @param {{ trainer: object, position: number[], rotationY?: number, labelY?: number }} props
 *   The dummy stands on the pad's local -Z side; `rotationY` turns the whole pad.
 */
export function TrainingDummy({ trainer, position, rotationY = 0, labelY = 4.9 }) {
  const status = useGame((s) =>
    s.activeTrainer === trainer.id
      ? 'active'
      : s.unlockedTrainers.includes(trainer.id)
        ? 'unlocked'
        : s.wins >= trainer.cost
          ? 'affordable'
          : 'locked',
  )
  const active = status === 'active'
  const offered = useGame((s) => s.interact?.kind === 'trainer' && s.interact.id === trainer.id)

  const dummy = useRef(null)
  const flash = useRef(null)
  const padMaterial = useRef(null)
  const popups = useRef([])
  const fx = useRef({ seenSwing: -Infinity, hitAt: -Infinity, next: 0, spawned: [] })

  useFrame(({ camera, clock }) => {
    const now = performance.now() / 1000
    const s = fx.current
    const game = useGame.getState()

    // A fresh swing while training here: queue the impact and a number popup. The
    // freshness check stops a swing made before stepping on from counting as a hit.
    if (game.activeTrainer === trainer.id && game.swingAt > s.seenSwing && now - game.swingAt < 0.2) {
      s.seenSwing = game.swingAt
      s.hitAt = game.swingAt + HIT_DELAY_S
      const i = s.next
      s.next = (i + 1) % POPUP_COUNT
      s.spawned[i] = s.hitAt
      const mesh = popups.current[i]
      if (mesh) {
        mesh.material.map = popupTexture(game.lastGain)
        mesh.userData.x = (Math.random() - 0.5) * 1.4
      }
    }

    // Knocked back, then a damped rock about the base.
    const t = now - s.hitAt
    if (dummy.current) {
      dummy.current.rotation.x = t >= 0 && t < WOBBLE_S ? -0.3 * Math.exp(-t * 6) * Math.cos(t * 22) : 0
    }
    if (flash.current) flash.current.opacity = t >= 0 && t < FLASH_S ? 1 - t / FLASH_S : 0
    if (padMaterial.current) {
      padMaterial.current.emissiveIntensity = active
        ? 0.6 + 0.25 * Math.sin(clock.elapsedTime * 5)
        : status === 'locked'
          ? 0.08
          : 0.3
    }

    popups.current.forEach((mesh, i) => {
      if (!mesh) return
      const age = now - (s.spawned[i] ?? -Infinity)
      mesh.visible = age >= 0 && age < POPUP_S
      if (!mesh.visible) return
      mesh.position.set(mesh.userData.x ?? 0, HEAD_Y + 0.8 + age * 1.8, DUMMY_OFFSET_Z + 0.6)
      mesh.material.opacity = 1 - (age / POPUP_S) ** 2
      // Face the camera: undo the pad's own turn, then apply the camera's rotation.
      mesh.quaternion.setFromAxisAngle(_up, -rotationY).multiply(camera.quaternion)
    })
  })

  const onEnter = ({ other }) => {
    // Local -Z (towards the dummy) is world yaw rotationY + π.
    if (other.rigidBodyObject?.name === 'player') useGame.getState().enterTrainer(trainer.id, rotationY + Math.PI)
  }
  const onExit = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().leaveTrainer(trainer.id)
  }

  const statusLine =
    status === 'active'
      ? { text: 'TRAINING!', fill: '#7dff6a' }
      : status === 'unlocked'
        ? { text: trainer.cost === 0 ? 'FREE' : 'UNLOCKED', fill: '#7fd8ff' }
        : {
            text: `${formatNumber(trainer.cost)} Wins`,
            icon: 'trophy',
            fill: status === 'affordable' ? ['#fff6a8', '#ffc21a'] : ['#ffd0d0', '#ff7a7a'],
          }

  const body = (
    <meshStandardMaterial map={studTexture([trainer.color], { cells: 1, studsPerCell: 2 })} roughness={0.7} />
  )

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Studded square tile on a darker trim. */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[3.6, 0.16, 3.6]} />
        <meshStandardMaterial color={shade(trainer.color, -0.45)} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[3.1, 0.2, 3.1]} />
        <meshStandardMaterial
          ref={padMaterial}
          map={studTexture([trainer.color], { cells: 1, studsPerCell: 6 })}
          emissive={trainer.color}
          emissiveIntensity={0.3}
          roughness={0.6}
        />
      </mesh>

      {/* Neon rim and rings rising off the pad, in its colour. */}
      <PadGlow
        color={trainer.color}
        size={3.6}
        y={0.235}
        rise={2.6}
        level={STATUS_GLOW[status]}
        sparkles={active ? 10 : 5}
        phase={position[2]}
      />

      {/* The dummy pivots at its base, so the wobble rocks it like a punching bag. */}
      <group ref={dummy} position={[0, 0, DUMMY_OFFSET_Z]}>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 0.2, 1.2]} />
          <meshStandardMaterial color="#3a3a44" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.8, 0]} castShadow>
          <boxGeometry args={[0.3, 1.2, 0.3]} />
          <meshStandardMaterial color="#7b4b27" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.9, 0]} castShadow>
          <boxGeometry args={[1.3, 1.1, 0.7]} />
          {body}
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.9, 2.1, 0]} castShadow>
            <boxGeometry args={[0.5, 0.35, 0.35]} />
            {body}
          </mesh>
        ))}
        <mesh position={[0, HEAD_Y, 0]} castShadow>
          <boxGeometry args={[1.2, 1.2, 0.5]} />
          {body}
        </mesh>
        <mesh position={[0, HEAD_Y, 0.26]}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial map={targetTexture()} transparent roughness={0.6} />
        </mesh>
        <mesh position={[0, HEAD_Y, 0.3]}>
          <planeGeometry args={[2.6, 2.6]} />
          <meshBasicMaterial
            ref={flash}
            map={radialGlowTexture()}
            color="#fff3b0"
            transparent
            opacity={0}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      {active && (
        <Sparkles
          count={24}
          scale={[2.6, 3.2, 2.6]}
          position={[0, 1.8, DUMMY_OFFSET_Z]}
          size={5}
          speed={0.8}
          color={trainer.color}
        />
      )}

      {Array.from({ length: POPUP_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            popups.current[i] = el
          }}
          visible={false}
        >
          <planeGeometry args={[1.6, 0.8]} />
          <meshBasicMaterial map={popupTexture(1)} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}

      <Billboard position={[0, labelY, DUMMY_OFFSET_Z]}>
        <Label
          lines={[
            { text: `${trainer.multiplier}x`, icon: 'sword', scale: 1.25, fill: ['#ffffff', '#ffe9a8'] },
            statusLine,
          ]}
          position={[0, 0, 0]}
          size={[3.4, 1.6]}
          style={{ width: 512 }}
        />
      </Billboard>

      {offered && (status === 'affordable' || status === 'locked') && (
        <InteractPrompt
          position={[0, 2.4, DUMMY_OFFSET_Z / 2]}
          action="Unlock"
          title={`${trainer.multiplier}x Training`}
          detail={`🏆 ${formatNumber(trainer.cost)} Wins${status === 'locked' ? ' · not enough Wins' : ''}`}
          tone={status === 'affordable' ? 'normal' : 'warn'}
        />
      )}

      <RigidBody type="fixed" colliders={false}>
        {/* Solid dummy, so you can't walk through it. */}
        <CuboidCollider args={[0.65, 1.8, 0.4]} position={[0, 1.8, DUMMY_OFFSET_Z]} />
        <CuboidCollider
          sensor
          args={[1.6, 1, 1.6]}
          position={[0, 1, 0]}
          onIntersectionEnter={onEnter}
          onIntersectionExit={onExit}
        />
      </RigidBody>
    </group>
  )
}

export default TrainingDummy
