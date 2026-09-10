/**
 * Blocky sword built from boxes, in world units. The grip is at the origin and the
 * blade points up +Y, so holders only need to rotate it.
 *
 * @param {{ sword: import('./swords').SWORDS[number] }} props
 */
export function SwordModel({ sword }) {
  const glow = sword.glow ?? 0
  const blade = (
    <meshStandardMaterial
      color={sword.blade}
      emissive={sword.blade}
      emissiveIntensity={glow}
      metalness={0.3}
      roughness={0.35}
    />
  )
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
        {blade}
      </mesh>
      {/* Point: a square turned 45°, centred on the blade's top edge. */}
      <mesh position={[0, 1.46, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <boxGeometry args={[0.113, 0.113, 0.05]} />
        {blade}
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 0.84, side * 0.027]}>
          <boxGeometry args={[0.04, 1.05, 0.004]} />
          <meshStandardMaterial
            color={sword.edge}
            emissive={sword.edge}
            emissiveIntensity={glow * 0.8}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  )
}

export default SwordModel
