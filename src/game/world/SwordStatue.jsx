import { Billboard, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending } from 'three'

import SwordModel from '../SwordModel'
import { radialGlowTexture } from './textures'

/**
 * A giant sword planted blade-down in a rock: the sword zone's centrepiece.
 * `position` is the top of the rock; the rock itself is part of the static map.
 *
 * @param {{ position: number[], sword: object, scale?: number }} props
 */
export function SwordStatue({ position, sword, scale = 3 }) {
  const aura = useRef(null)
  useFrame(({ clock }) => {
    if (aura.current) aura.current.opacity = 0.35 + 0.15 * Math.sin(clock.elapsedTime * 1.5)
  })

  // Grip-to-tip length; the tip sinks a little into the rock.
  const gripY = 1.52 * sword.size * scale - 0.4

  return (
    <group position={position}>
      <group position={[0, gripY, 0]} rotation={[0, Math.PI / 4, Math.PI]} scale={scale}>
        <SwordModel sword={sword} />
      </group>
      <Billboard position={[0, gripY / 2 + 0.6, 0]}>
        <mesh>
          <planeGeometry args={[3.5, gripY * 1.4]} />
          <meshBasicMaterial
            ref={aura}
            map={radialGlowTexture()}
            color={sword.blade}
            transparent
            opacity={0.4}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <Sparkles
        count={40}
        scale={[3, gripY + 1, 3]}
        position={[0, gripY / 2, 0]}
        size={6}
        speed={0.4}
        color={sword.edge}
      />
    </group>
  )
}

export default SwordStatue
