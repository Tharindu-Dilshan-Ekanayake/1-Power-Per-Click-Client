import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { BoxGeometry } from 'three'

import { geometry, merge } from './world/geometry'

/** How much brighter the blade flashes at the peak of a swing. */
const FLASH_BOOST = 1.4
/** The edge strips glow a little dimmer than the blade itself, same as their base glow. */
const EDGE_RATIO = 0.8

/**
 * The sword's boxes, grouped by which material they take and merged into one
 * geometry each.
 *
 * Every sword in the game is the same shape - only the colours and the overall
 * `size` scale change - so this is built once and shared by all of them: the
 * twenty-six on the shop pads, the statue, the one in your hand and one per remote
 * player. As seven separate meshes apiece that came to nearly two hundred draw
 * calls standing in the lobby.
 */
const swordParts = () =>
  geometry('sword', () => {
    const box = (w, h, d, x, y, z, rz = 0) => {
      const g = new BoxGeometry(w, h, d)
      if (rz) g.rotateZ(rz)
      g.translate(x, y, z)
      return g
    }
    return {
      grip: box(0.09, 0.34, 0.09, 0, 0, 0),
      trim: merge([box(0.15, 0.1, 0.15, 0, -0.21, 0), box(0.48, 0.09, 0.14, 0, 0.21, 0)]),
      // Blade, plus the point: a square turned 45°, centred on the blade's top edge.
      blade: merge([box(0.16, 1.2, 0.05, 0, 0.86, 0), box(0.113, 0.113, 0.05, 0, 1.46, 0, Math.PI / 4)]),
      edges: merge([box(0.04, 1.05, 0.004, 0, 0.84, -0.027), box(0.04, 1.05, 0.004, 0, 0.84, 0.027)]),
    }
  })

/**
 * Blocky sword built from boxes, in world units. The grip is at the origin and the
 * blade points up +Y, so holders only need to rotate it.
 *
 * @param {{ sword: import('./swords').SWORDS[number], minGlow?: number,
 *           flashRef?: React.MutableRefObject<number> }} props
 *   `minGlow` lights up even a plain blade a little (the shop display uses it).
 *   `flashRef`, when given, is read every frame (not passed as a prop, so a swing
 *   doesn't re-render the whole sword 60 times a second): its `.current` (0-1)
 *   briefly brightens the blade as it swings, fading back to its resting glow.
 */
export function SwordModel({ sword, minGlow = 0, flashRef }) {
  const baseGlow = Math.max(sword.glow ?? 0, minGlow)
  const parts = swordParts()
  const bladeMat = useRef(null)
  const edgeMat = useRef(null)

  useFrame(() => {
    if (!flashRef) return
    const boost = flashRef.current || 0
    if (bladeMat.current) bladeMat.current.emissiveIntensity = baseGlow + boost * FLASH_BOOST
    if (edgeMat.current) edgeMat.current.emissiveIntensity = (baseGlow + boost * FLASH_BOOST) * EDGE_RATIO
  })

  return (
    <group scale={sword.size}>
      <mesh geometry={parts.grip} castShadow>
        <meshStandardMaterial color="#5a3a1e" roughness={0.8} />
      </mesh>
      <mesh geometry={parts.trim} castShadow>
        <meshStandardMaterial color={sword.guard} metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh geometry={parts.blade} castShadow>
        <meshStandardMaterial
          ref={bladeMat}
          color={sword.blade}
          emissive={sword.blade}
          emissiveIntensity={baseGlow}
          metalness={0.3}
          roughness={0.35}
        />
      </mesh>
      <mesh geometry={parts.edges}>
        <meshStandardMaterial
          ref={edgeMat}
          color={sword.edge}
          emissive={sword.edge}
          emissiveIntensity={baseGlow * EDGE_RATIO}
          roughness={0.3}
        />
      </mesh>
    </group>
  )
}

export default SwordModel
