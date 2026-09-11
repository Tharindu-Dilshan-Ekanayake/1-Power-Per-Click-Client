import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

import { remoteStates, useLobby } from '../net/lobbyClient'
import { playTrack } from '../net/snapshots'
import { AvatarBoundary, StandInBody } from './AvatarBoundary'
import { PLAYER_HEIGHT, SWING_DURATION_S } from './Player'
import PlayerAvatar from './PlayerAvatar'
import { Label } from './world/Effects'

const _quat = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _sample = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }

/**
 * Another player in our lobby, played back smoothly from the positions they send:
 * drawn a little behind real time, between the two positions around that moment,
 * with a delay that adapts to how late their updates arrive (see snapshots.js).
 * Facing, walk cycle and jumps come from that same smooth motion. No collider:
 * players pass through each other.
 */
function RemotePlayer({ id, player }) {
  const body = useRef(null)
  const visual = useRef(null)
  // maxSpeed a little under the walk speed (6), so small wobbles in their played-back
  // speed don't shrink the stride; a sprint is past it too, so both get the full cycle.
  const motion = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: 5.5, swing: Infinity })
  const swing = useRef({ sw: null, at: -Infinity })

  useFrame((_state, delta) => {
    const track = remoteStates.get(id)
    const group = body.current
    if (!track || !group) return

    const now = performance.now()
    const s = playTrack(track, now, delta * 1000, _sample)
    group.position.set(s.x, s.y, s.z)

    const m = motion.current
    const horizontal = Math.hypot(s.vx, s.vz)
    m.time += delta
    m.speed += (horizontal - m.speed) * (1 - Math.exp(-delta * 12))
    m.grounded = Math.abs(s.vy) < 1.5
    if (visual.current && horizontal > 0.5) {
      _quat.setFromAxisAngle(_up, Math.atan2(s.vx, s.vz))
      visual.current.quaternion.slerp(_quat, 1 - Math.pow(0.001, delta))
    }

    // A new swing count means they just swung.
    const sw = swing.current
    if (track.sw !== sw.sw) {
      if (sw.sw !== null) sw.at = now / 1000
      sw.sw = track.sw
    }
    m.swing = (now / 1000 - sw.at) / SWING_DURATION_S
  })

  const standIn = <StandInBody height={PLAYER_HEIGHT} />
  return (
    <group ref={body}>
      <group ref={visual} position={[0, -PLAYER_HEIGHT / 2, 0]}>
        <AvatarBoundary fallback={standIn}>
          <Suspense fallback={standIn}>
            <PlayerAvatar
              remote
              equipped={player.avatar?.equipped ?? null}
              proportions={player.avatar?.proportions}
              swordId={player.sword}
              targetHeight={PLAYER_HEIGHT}
              motionRef={motion}
            />
          </Suspense>
        </AvatarBoundary>
      </group>
      <Billboard position={[0, PLAYER_HEIGHT / 2 + 0.55, 0]}>
        <Label lines={[player.name]} position={[0, 0, 0]} size={[3, 0.6]} style={{ width: 512 }} />
      </Billboard>
    </group>
  )
}

/** Everyone else in our lobby. */
export function RemotePlayers() {
  const players = useLobby((s) => s.players)
  return Object.entries(players).map(([id, player]) => <RemotePlayer key={id} id={id} player={player} />)
}

export default RemotePlayers
