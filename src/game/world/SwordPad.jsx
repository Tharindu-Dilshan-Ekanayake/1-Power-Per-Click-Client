import { Billboard, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { AdditiveBlending } from 'three'

import { formatNumber } from '../format'
import { useGame } from '../gameStore'
import SwordModel from '../SwordModel'
import { Label } from './Effects'
import InteractPrompt from './InteractPrompt'
import { radialGlowTexture, shade } from './textures'

/** Pad colour: red not owned (pulsing when affordable), yellow owned, purple equipped. */
const STATUS_COLOR = {
  equipped: '#b05cff',
  owned: '#ffd23f',
  affordable: '#ff3b3b',
  locked: '#d9302b',
}

const GOLD = ['#fff6a8', '#ffc21a']
const PAD_TOP = 0.26
/** Shop swords are shown bigger than held ones so the row reads from the path. */
const DISPLAY_SCALE = 1.35

/**
 * Shop slot: a sword standing upright on a glowing hexagon pad, with its price,
 * name and power floating above. Walking up to it shows an E prompt to buy the
 * sword, or equip it if already owned.
 *
 * @param {{ sword: object, position: number[] }} props
 */
export function SwordPad({ sword, position }) {
  const status = useGame((s) =>
    s.equipped === sword.id
      ? 'equipped'
      : s.owned.includes(sword.id)
        ? 'owned'
        : s.wins >= sword.cost
          ? 'affordable'
          : 'locked',
  )
  const swordRef = useRef(null)
  const padMaterial = useRef(null)
  const aura = useRef(null)

  const glow = sword.glow ?? 0
  /** Pommel-to-tip height of the displayed sword. */
  const height = 1.78 * sword.size * DISPLAY_SCALE
  const baseY = PAD_TOP + 0.3 * sword.size * DISPLAY_SCALE

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (swordRef.current) {
      swordRef.current.rotation.y += delta * 0.5
      swordRef.current.position.y = baseY + Math.sin(t * 1.4 + position[0]) * 0.08
    }
    if (padMaterial.current) {
      padMaterial.current.emissiveIntensity =
        status === 'affordable' ? 0.45 + 0.25 * Math.sin(t * 4) : status === 'locked' ? 0.12 : 0.35
    }
    if (aura.current) aura.current.opacity = 0.3 + 0.12 * Math.sin(t * 2 + position[0])
  })

  const inRange = useGame((s) => s.interact?.kind === 'sword' && s.interact.id === sword.id)

  const onEnter = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().setInteract('sword', sword.id)
  }
  const onExit = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().clearInteract('sword', sword.id)
  }

  const price = sword.cost === 0 ? 'Free' : `🏆 ${formatNumber(sword.cost)} Wins`
  const prompt = {
    equipped: { action: 'Equipped', tone: 'done', detail: 'In your hand' },
    owned: { action: 'Equip', tone: 'normal', detail: 'You own this sword' },
    affordable: { action: 'Buy', tone: 'normal', detail: price },
    locked: { action: 'Buy', tone: 'warn', detail: `${price} · not enough Wins` },
  }[status]

  const color = STATUS_COLOR[status]
  const priceLine =
    status === 'equipped'
      ? { text: 'EQUIPPED', fill: ['#f0dcff', '#c07bff'] }
      : status === 'owned'
        ? { text: 'OWNED', fill: GOLD }
        : sword.cost === 0
          ? { text: 'FREE', fill: ['#ffffff', '#b8ffb0'] }
          : { text: `${formatNumber(sword.cost)} Wins`, icon: 'trophy', fill: GOLD }

  return (
    <group position={position}>
      {/* Hexagon pad: dark rim with a glowing top. */}
      <mesh position={[0, 0.09, 0]} rotation={[0, Math.PI / 6, 0]} receiveShadow>
        <cylinderGeometry args={[1.6, 1.7, 0.18, 6]} />
        <meshStandardMaterial color={shade(color, -0.45)} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[0, Math.PI / 6, 0]} receiveShadow>
        <cylinderGeometry args={[1.3, 1.4, 0.12, 6]} />
        <meshStandardMaterial
          ref={padMaterial}
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          roughness={0.5}
        />
      </mesh>

      <group ref={swordRef} position={[0, baseY, 0]} scale={DISPLAY_SCALE}>
        <SwordModel sword={sword} />
      </group>

      {glow > 0 && (
        <>
          <Billboard position={[0, PAD_TOP + height * 0.55, 0]}>
            <mesh>
              <planeGeometry args={[1.6 * sword.size, height * 1.25]} />
              <meshBasicMaterial
                ref={aura}
                map={radialGlowTexture()}
                color={sword.blade}
                transparent
                opacity={0.35}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </Billboard>
          <Sparkles
            count={14}
            scale={[1.2, height, 1.2]}
            position={[0, PAD_TOP + height / 2, 0]}
            size={4}
            speed={0.5}
            color={sword.edge}
          />
        </>
      )}

      <Billboard position={[0, PAD_TOP + height + 1.15, 0]}>
        <Label
          lines={[
            priceLine,
            { text: sword.name, scale: 1.3 },
            { text: `+${formatNumber(sword.power)} Power`, fill: ['#ff9a9a', '#ff3030'] },
          ]}
          position={[0, 0, 0]}
          size={[3.8, 1.9]}
          style={{ width: 512 }}
        />
      </Billboard>

      {inRange && <InteractPrompt position={[0, 2.2, 0]} title={sword.name} {...prompt} />}

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          sensor
          args={[1.7, 1, 1.7]}
          position={[0, 1, 0]}
          onIntersectionEnter={onEnter}
          onIntersectionExit={onExit}
        />
      </RigidBody>
    </group>
  )
}

export default SwordPad
