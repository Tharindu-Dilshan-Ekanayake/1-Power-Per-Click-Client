import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { Object3D } from 'three'

import { useGame } from '../gameStore'
import { getSword } from '../swords'
import { Backdrop, Clouds, Crown, Crystal, GlowPad, Label, Sky } from './Effects'
import EggStand from './EggStand'
import GateSign from './GateSign'
import { buildLayout } from './layout'
import Portal from './Portal'
import Roofs from './Roofs'
import StageWall from './StageWall'
import StaticBlocks from './StaticBlocks'
import SwordPad from './SwordPad'
import SwordStatue from './SwordStatue'
import { GATE_Z, SPAWN } from './themes'
import TrainingDummy from './TrainingDummy'
import WinPad from './WinPad'

/** Walls and Win pads are only mounted within this distance (along z) of the player. */
const WALL_VIEW = 110
/** The mounted set is re-centred each time the player crosses a band this long. */
const WALL_BAND = 20
/** This far into the lobby, every broken wall rebuilds. */
const LOBBY_RESET_Z = GATE_Z + 6

/**
 * The stage walls and Win pads near the player. There are well over a hundred of
 * each, so only the nearby ones are mounted; broken-wall state lives in the store,
 * so a wall remounts as it was. Walking back into the lobby starts a short countdown
 * (shown above stage 1's gate, the only broken wall visible from there) before every
 * broken wall rebuilds.
 */
function WallField({ walls, winPads, bodyRef }) {
  const [band, setBand] = useState(() => Math.round(SPAWN[2] / WALL_BAND))

  useFrame(() => {
    const game = useGame.getState()
    if (game.wallsResetAt !== null && performance.now() / 1000 >= game.wallsResetAt) game.resetWalls()

    const p = bodyRef.current?.translation()
    if (!p) return
    const next = Math.round(p.z / WALL_BAND)
    if (next !== band) setBand(next)
    if (p.z > LOBBY_RESET_Z) game.scheduleWallReset()
    else game.cancelWallReset()
  })

  const z = band * WALL_BAND
  const near = (at) => Math.abs(at - z) < WALL_VIEW
  return (
    <>
      {walls
        .filter((wall) => near(wall.zFront))
        .map((wall) => (
          <StageWall key={wall.number} {...wall} />
        ))}
      {winPads
        .filter((pad) => near(pad.position[2]))
        .map((pad) => (
          <WinPad key={`${pad.number}:${pad.pad.id}`} {...pad} />
        ))}
    </>
  )
}

/**
 * The whole map: the lobby, the gate, and every stage corridor behind it.
 * Must be rendered inside <Physics>. `bodyRef` is the player's body.
 */
export function World({ bodyRef }) {
  const layout = useMemo(() => buildLayout(), [])
  return (
    <>
      <Sky />
      <Clouds />
      <Backdrop />
      <StaticBlocks blocks={layout.blocks} />
      <Roofs roofs={layout.roofs} />
      <WallField walls={layout.walls} winPads={layout.winPads} bodyRef={bodyRef} />
      <GateSign />
      {layout.portals.map((portal, i) => (
        <Portal key={i} {...portal} />
      ))}
      {layout.pads.map((pad, i) => (
        <GlowPad key={i} {...pad} />
      ))}
      {layout.crowns.map((crown, i) => (
        <Crown key={i} {...crown} />
      ))}
      {layout.crystals.map((crystal, i) => (
        <Crystal key={i} {...crystal} />
      ))}
      {layout.labels.map((label, i) => (
        <Label key={i} {...label} />
      ))}
      {layout.swordPads.map((pad) => (
        <SwordPad key={pad.sword.id} {...pad} />
      ))}
      {layout.trainerPads.map((pad) => (
        <TrainingDummy key={pad.trainer.id} {...pad} />
      ))}
      {layout.eggStands.map((stand) => (
        <EggStand key={stand.egg.id} {...stand} />
      ))}
      <SwordStatue position={layout.statue.position} sword={getSword(layout.statue.swordId)} />
    </>
  )
}

const SUN_OFFSET = [30, 50, 20]
const SHADOW_EXTENT = 45

/**
 * Directional sunlight whose shadow camera follows the player. The map is far bigger
 * than one shadow map can cover crisply, so only the area around the player casts.
 *
 * @param {{ bodyRef: React.MutableRefObject<any> }} props
 */
export function SunLight({ bodyRef }) {
  const light = useRef(null)
  const target = useMemo(() => new Object3D(), [])

  useFrame(() => {
    const body = bodyRef.current
    if (!body || !light.current) return
    const p = body.translation()
    light.current.position.set(p.x + SUN_OFFSET[0], p.y + SUN_OFFSET[1], p.z + SUN_OFFSET[2])
    target.position.set(p.x, p.y, p.z)
    target.updateMatrixWorld()
  })

  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        castShadow
        intensity={1.7}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={160}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  )
}

export default World
