import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier'
import { Suspense, useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

import { AvatarBoundary, StandInBody } from './AvatarBoundary'
import { useGame } from './gameStore'
import PlayerAvatar from './PlayerAvatar'
import { WALK_SPEED } from './progression'
import useKeyboard from './useKeyboard'

// Capsule roughly matching the humanoid. Rapier's capsule args are the half-height of
// the *cylindrical* section plus the radius, so total height = 2*(halfHeight+radius).
const CAPSULE_RADIUS = 0.35
const CAPSULE_HALF_HEIGHT = 0.55
const PLAYER_HEIGHT = 2 * (CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS)

/** World units per second; the HUD shows it as WALK_SPEED (16 → 6). */
const MOVE_SPEED = WALK_SPEED * (6 / 16)
const SPRINT_MULTIPLIER = 1.6
/**
 * Upward speed set on jump. Set directly rather than applied as an impulse so the
 * height doesn't depend on the collider's mass: v²/2g ≈ 1.6 units at gravity 18,
 * enough to hop onto the 1.2-unit terrace steps.
 */
const JUMP_VELOCITY = 7.6
/** Length of one sword swing animation. */
export const SWING_DURATION_S = 0.35
/** Falling below this puts the player back at their spawn point. */
const FALL_LIMIT_Y = -25
/** Extra ray length past the capsule bottom; tolerates small ground gaps. */
const GROUND_RAY_SLACK = 0.15
/** Stops one long Space press from re-triggering the moment the ray re-hits. */
const JUMP_COOLDOWN_S = 0.25

// Scratch objects, reused each frame so the loop allocates nothing.
const _input = new Vector3()
const _move = new Vector3()
const _camForward = new Vector3()
const _camRight = new Vector3()
const _rayOrigin = new Vector3()
const _targetQuat = new Quaternion()
const _up = new Vector3(0, 1, 0)

/**
 * The player: a dynamic Rapier capsule with the assembled Bloxity avatar as its
 * visual mesh. The avatar is a child of the RigidBody, so R3F/Rapier keeps the mesh
 * on the body transform automatically — no manual per-frame copying.
 *
 * @param {{ position?: [number,number,number], onAvatarReady?: () => void,
 *           bodyRef?: React.MutableRefObject<any> }} props
 */
export function Player({ position = [0, 3, 0], onAvatarReady, bodyRef: externalBodyRef }) {
  // The follow camera needs to read this body's transform, so the scene may own the
  // ref. Fall back to a local one when used standalone.
  const localBodyRef = useRef(null)
  const bodyRef = externalBodyRef || localBodyRef
  const visualRef = useRef(null)
  const keys = useKeyboard()
  const { rapier, world } = useRapier()

  const jumpCooldown = useRef(0)

  /**
   * Motion state handed to the avatar so it can pose itself. A ref, not state:
   * this is written every frame and must not trigger a re-render.
   */
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: MOVE_SPEED })

  /**
   * Grounded check: cast a short ray straight down from the capsule centre and see
   * whether it hits anything before clearing the capsule's own bottom. Without this
   * the player can jump indefinitely in mid-air.
   */
  // Plain function, not useCallback: it's only ever called from useFrame, so a stable
  // identity buys nothing.
  const isGrounded = () => {
    const body = bodyRef.current
    if (!body) return false

    const pos = body.translation()
    _rayOrigin.set(pos.x, pos.y, pos.z)

    const ray = new rapier.Ray(_rayOrigin, { x: 0, y: -1, z: 0 })
    const maxDistance = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS + GROUND_RAY_SLACK

    const hit = world.castRay(
      ray,
      maxDistance,
      true, // solid
      undefined,
      undefined,
      undefined,
      body, // exclude our own body, or we just hit ourselves
    )

    return hit !== null && hit.timeOfImpact <= maxDistance
  }

  useFrame((state, delta) => {
    const body = bodyRef.current
    if (!body) return

    jumpCooldown.current = Math.max(0, jumpCooldown.current - delta)

    const k = keys.current

    // Evaluated once per frame now: both the jump gate and the avatar's pose need it.
    const grounded = isGrounded()

    // --- Horizontal movement, relative to camera yaw -----------------------------
    _input.set(
      (k.right ? 1 : 0) - (k.left ? 1 : 0),
      0,
      (k.backward ? 1 : 0) - (k.forward ? 1 : 0),
    )

    const linvel = body.linvel()

    if (_input.lengthSq() > 0) {
      _input.normalize()

      // Flatten the camera's forward onto the ground plane so W always means
      // "away from the camera", the standard 3rd-person runner feel.
      state.camera.getWorldDirection(_camForward)
      _camForward.y = 0
      _camForward.normalize()

      // Screen-right, derived from that flattened forward.
      _camRight.crossVectors(_camForward, _up).normalize()

      // Build the move vector from the camera basis directly rather than rotating
      // the raw input by a yaw angle - the yaw form silently mirrored both axes,
      // sending W toward the camera and A to the right.
      // input.z is -1 for W (forward), input.x is +1 for D (right).
      _move
        .set(0, 0, 0)
        .addScaledVector(_camForward, -_input.z)
        .addScaledVector(_camRight, _input.x)
        .normalize()

      const speed = MOVE_SPEED * (k.sprint ? SPRINT_MULTIPLIER : 1)

      // Set velocity directly rather than accumulating impulses: gives crisp,
      // predictable runner control and no drift. Y is left to gravity.
      body.setLinvel({ x: _move.x * speed, y: linvel.y, z: _move.z * speed }, true)

      // Face the direction of travel.
      if (visualRef.current) {
        _targetQuat.setFromAxisAngle(_up, Math.atan2(_move.x, _move.z))
        visualRef.current.quaternion.slerp(_targetQuat, 1 - Math.pow(0.001, delta))
      }
    } else {
      // Damp horizontal motion to a stop; don't touch the fall speed.
      body.setLinvel({ x: linvel.x * 0.8, y: linvel.y, z: linvel.z * 0.8 }, true)

      // Training: turn to face the dummy. Beside a stage wall: turn to face the wall.
      const game = useGame.getState()
      if (visualRef.current && (game.activeTrainer || game.nearWall)) {
        const yaw = game.activeTrainer
          ? game.trainYaw
          : body.translation().z > game.nearWall.z
            ? Math.PI
            : 0
        _targetQuat.setFromAxisAngle(_up, yaw)
        visualRef.current.quaternion.slerp(_targetQuat, 1 - Math.pow(0.001, delta))
      }
    }

    // --- Jump --------------------------------------------------------------------
    if (k.jump && jumpCooldown.current === 0 && grounded) {
      const v = body.linvel()
      body.setLinvel({ x: v.x, y: JUMP_VELOCITY, z: v.z }, true)
      jumpCooldown.current = JUMP_COOLDOWN_S
    }

    if (body.translation().y < FALL_LIMIT_Y) {
      body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }

    // --- Publish motion state for the avatar's pose -------------------------------
    const nowVel = body.linvel()
    const motion = motionRef.current
    motion.time += delta
    motion.speed = Math.hypot(nowVel.x, nowVel.z)
    motion.grounded = grounded
    motion.maxSpeed = MOVE_SPEED * (k.sprint ? SPRINT_MULTIPLIER : 1)
    motion.swing = (performance.now() / 1000 - useGame.getState().swingAt) / SWING_DURATION_S
  })

  return (
    <RigidBody
      ref={bodyRef}
      position={position}
      colliders={false}
      mass={1}
      // Locking rotation keeps the capsule upright; facing is handled on the mesh.
      enabledRotations={[false, false, false]}
      friction={0.2}
      linearDamping={0.1}
      ccd
      name="player"
    >
      <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} />
      {/* Avatar origin is at the feet; the capsule origin is at its centre. */}
      <group ref={visualRef} position={[0, -PLAYER_HEIGHT / 2, 0]}>
        {/* The avatar downloads on its own, so the body (and the camera following
            it) work straight away; a stand-in shows until it arrives, or for good
            if it can't be loaded. */}
        <AvatarBoundary
          onError={onAvatarReady}
          fallback={<StandInBody height={PLAYER_HEIGHT} />}
        >
          <Suspense fallback={<StandInBody height={PLAYER_HEIGHT} />}>
            <PlayerAvatar
              onReady={onAvatarReady}
              targetHeight={PLAYER_HEIGHT}
              motionRef={motionRef}
            />
          </Suspense>
        </AvatarBoundary>
      </group>
    </RigidBody>
  )
}

export { PLAYER_HEIGHT }
export default Player
