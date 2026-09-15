import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

import { useGame } from './gameStore'
import { getPet } from './pets'
import { PLAYER_HEIGHT } from './Player'
import { PetModel } from './world/PetModel'

/** How far behind the player the pet settles once it catches up. */
const HEEL_DISTANCE = 1.7
/** And a little off to one side, so it isn't lined up dead behind the sword arm. */
const SIDE_OFFSET = 0.4
/** It only starts moving once further than this from its heel spot. */
const FOLLOW_SLACK = 0.6
/** Higher = snappier catch-up. */
const FOLLOW_SMOOTHING = 5
const TURN_SMOOTHING = 6
/** Below this speed the player's turned in place, not walking - keep facing put. */
const TURN_SPEED = 0.5

const _playerPos = new Vector3()
const _heelPos = new Vector3()
const _dir = new Vector3()
const _before = new Vector3()
const _targetQuat = new Quaternion()
const _up = new Vector3(0, 1, 0)

/**
 * The equipped pet, trotting along behind the player. A ref-driven group, not
 * physics-backed: it just chases a spot behind-and-beside the player's capsule,
 * reading the same Rapier body FollowCamera does. Facing comes from the body's
 * own velocity (like RemotePlayers does for the avatar) rather than the pet's
 * own past movement, so it can't fall into a feedback loop and spin in place
 * once it's caught up.
 *
 * @param {{ bodyRef: React.MutableRefObject<any> }} props
 */
export function PetCompanion({ bodyRef }) {
  const equippedId = useGame((s) => s.equippedPet)
  const groupRef = useRef(null)
  const initialised = useRef(false)
  const facing = useRef(0)
  /** Handed to PetModel so its legs trot in step with how fast it's actually moving. */
  const walkRef = useRef({ speed: 0 })

  const pet = equippedId ? getPet(equippedId) : null

  useFrame((state, delta) => {
    const body = bodyRef.current
    const group = groupRef.current
    if (!body || !group || !pet) return

    const p = body.translation()
    const v = body.linvel()
    _playerPos.set(p.x, p.y - PLAYER_HEIGHT / 2, p.z)

    if (Math.hypot(v.x, v.z) > TURN_SPEED) facing.current = Math.atan2(v.x, v.z)

    // Heel spot: behind wherever the player's facing, offset a little to one
    // side, so the pet reads as a companion beside their heel rather than
    // riding directly in their tracks (and the sword's swing arc).
    _dir.set(Math.sin(facing.current), 0, Math.cos(facing.current))
    _heelPos.copy(_playerPos).addScaledVector(_dir, -HEEL_DISTANCE)
    _heelPos.x += Math.cos(facing.current) * SIDE_OFFSET
    _heelPos.z -= Math.sin(facing.current) * SIDE_OFFSET

    if (!initialised.current) {
      group.position.copy(_heelPos)
      initialised.current = true
      walkRef.current.speed = 0
    } else if (group.position.distanceTo(_heelPos) > FOLLOW_SLACK) {
      _before.copy(group.position)
      group.position.lerp(_heelPos, 1 - Math.pow(0.001, delta * (FOLLOW_SMOOTHING / 10)))
      walkRef.current.speed = delta > 0 ? _before.distanceTo(group.position) / delta : 0
    } else {
      walkRef.current.speed = 0
    }

    // Feet on the ground: the bob and bounce are the pet's own, from its gait
    // (see PetModel), not a hover applied from out here.
    group.position.y = _playerPos.y

    _targetQuat.setFromAxisAngle(_up, facing.current)
    group.quaternion.slerp(_targetQuat, 1 - Math.pow(0.001, delta * (TURN_SMOOTHING / 10)))
  })

  if (!pet) return null

  return (
    <group ref={groupRef} scale={1}>
      <PetModel pet={pet} walkRef={walkRef} />
      {(pet.glow ?? 0) > 0 && (
        <Sparkles count={8} scale={[0.9, 0.9, 0.9]} position={[0, 0.35, 0]} size={2.5} speed={0.4} color={pet.colors.accent} />
      )}
    </group>
  )
}

export default PetCompanion
