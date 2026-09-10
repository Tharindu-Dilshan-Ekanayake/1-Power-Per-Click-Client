import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo } from 'react'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { getMaterial, worldBoxGeometry } from './materials'

/**
 * Renders the map's static boxes. Blocks sharing a material are merged into a single
 * mesh (their UVs are already world-space, so studs stay aligned), which keeps the
 * whole map to a couple of dozen draw calls. Solid blocks each get a cuboid collider
 * on one fixed body.
 *
 * @param {{ blocks: { p: number[], s: number[], m: string, c: boolean }[] }} props
 */
export function StaticBlocks({ blocks }) {
  const meshes = useMemo(() => {
    const byMaterial = new Map()
    for (const block of blocks) {
      if (!byMaterial.has(block.m)) byMaterial.set(block.m, [])
      byMaterial.get(block.m).push(block)
    }
    return [...byMaterial].map(([key, list]) => {
      const { material, tile, shadow } = getMaterial(key)
      const parts = list.map((b) => worldBoxGeometry(b.s, b.p, tile))
      const geometry = mergeGeometries(parts)
      for (const part of parts) part.dispose()
      return { key, geometry, material, shadow }
    })
  }, [blocks])

  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes])

  const solid = useMemo(() => blocks.filter((b) => b.c), [blocks])

  return (
    <>
      {meshes.map((m) => (
        <mesh
          key={m.key}
          geometry={m.geometry}
          material={m.material}
          castShadow={m.shadow}
          receiveShadow={m.shadow}
        />
      ))}
      <RigidBody type="fixed" colliders={false} name="map">
        {solid.map((b, i) => (
          <CuboidCollider key={i} args={[b.s[0] / 2, b.s[1] / 2, b.s[2] / 2]} position={b.p} />
        ))}
      </RigidBody>
    </>
  )
}

export default StaticBlocks
