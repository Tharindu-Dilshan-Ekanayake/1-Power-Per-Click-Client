import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

/** How much brighter the blade flashes at the peak of a swing. */
const FLASH_BOOST = 1.4
/** The edge strips glow a little dimmer than the blade itself, same as their base glow. */
const EDGE_RATIO = 0.8

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
  const bladeMat = useRef(null)
  const tipMat = useRef(null)
  const edgeMats = useRef([])

  useFrame(() => {
    if (!flashRef) return
    const boost = flashRef.current || 0
    const bladeI = baseGlow + boost * FLASH_BOOST
    const edgeI = baseGlow * EDGE_RATIO + boost * FLASH_BOOST * EDGE_RATIO
    if (bladeMat.current) bladeMat.current.emissiveIntensity = bladeI
    if (tipMat.current) tipMat.current.emissiveIntensity = bladeI
    for (const m of edgeMats.current) if (m) m.emissiveIntensity = edgeI
  })

  const trim = <meshStandardMaterial color={sword.guard} metalness={0.5} roughness={0.35} />

  return (
    <group scale={sword.size}>
      <mesh castShadow>
        <boxGeometry args={[0.09, 0.34, 0.09]} />
        <meshStandardMaterial color="#5a3a1e" roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.21, 0]} castShadow>
        <boxGeometry args={[0.15, 0.1, 0.15]} />
        {trim}
      </mesh>
      <mesh position={[0, 0.21, 0]} castShadow>
        <boxGeometry args={[0.48, 0.09, 0.14]} />
        {trim}
      </mesh>
      <mesh position={[0, 0.86, 0]} castShadow>
        <boxGeometry args={[0.16, 1.2, 0.05]} />
        <meshStandardMaterial
          ref={bladeMat}
          color={sword.blade}
          emissive={sword.blade}
          emissiveIntensity={baseGlow}
          metalness={0.3}
          roughness={0.35}
        />
      </mesh>
      {/* Point: a square turned 45°, centred on the blade's top edge. */}
      <mesh position={[0, 1.46, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <boxGeometry args={[0.113, 0.113, 0.05]} />
        <meshStandardMaterial
          ref={tipMat}
          color={sword.blade}
          emissive={sword.blade}
          emissiveIntensity={baseGlow}
          metalness={0.3}
          roughness={0.35}
        />
      </mesh>
      {[-1, 1].map((side, i) => (
        <mesh key={side} position={[0, 0.84, side * 0.027]}>
          <boxGeometry args={[0.04, 1.05, 0.004]} />
          <meshStandardMaterial
            ref={(m) => {
              edgeMats.current[i] = m
            }}
            color={sword.edge}
            emissive={sword.edge}
            emissiveIntensity={baseGlow * EDGE_RATIO}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  )
}

export default SwordModel
