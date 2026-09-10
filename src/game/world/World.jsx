import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Object3D } from 'three'

import { Backdrop, Clouds, Crown, Crystal, GlowPad, Label, Sky } from './Effects'
import { buildLayout } from './layout'
import Portal from './Portal'
import StageWall from './StageWall'
import StaticBlocks from './StaticBlocks'
import SwordPad from './SwordPad'
import TrainingDummy from './TrainingDummy'

/**
 * The whole map: the lobby, the gate, and every stage corridor behind it.
 * Must be rendered inside <Physics>.
 */
export function World() {
  const layout = useMemo(() => buildLayout(), [])
  return (
    <>
      <Sky />
      <Clouds />
      <Backdrop />
      <StaticBlocks blocks={layout.blocks} />
      {layout.walls.map((wall) => (
        <StageWall key={wall.number} {...wall} />
      ))}
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
