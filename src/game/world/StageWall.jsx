import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending } from 'three'

import { glowFrameTexture, wallOverlayTexture, wallTexture } from './textures'
import { FRAME_COLOR, OPEN_H, OPEN_HALF } from './themes'

const WIDTH = OPEN_HALF * 2
const BAR = 0.5
const FRAME_W = WIDTH + BAR
const FRAME_H = OPEN_H + BAR / 2
const GLOW_MARGIN = 3

/**
 * The glowing, numbered wall that fills a stage doorway. Purely visual for now: it
 * has no collider, so the player can walk straight through to the next stage.
 *
 * @param {{ number: number, theme: object, zFront: number, hp: number }} props
 *   `zFront` is the z of the doorway's front (+Z) face.
 */
export function StageWall({ number, theme, zFront, hp }) {
  const surface = wallTexture(number, theme.wall)
  const overlay = wallOverlayTexture(number, hp)
  const glow = glowFrameTexture(FRAME_COLOR, FRAME_W, FRAME_H, GLOW_MARGIN)
  const glowStrength = theme.wall.glow ?? 0

  const glowRef = useRef(null)
  const surfaceRef = useRef(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (glowRef.current) glowRef.current.opacity = 0.8 + 0.2 * Math.sin(t * 2.2 + number)
    if (surfaceRef.current && glowStrength > 0) {
      surfaceRef.current.emissiveIntensity = glowStrength * (0.8 + 0.2 * Math.sin(t * 1.5 + number))
    }
  })

  const surfaceMaterial = (ref) => (
    <meshStandardMaterial
      ref={ref}
      map={surface}
      emissiveMap={glowStrength > 0 ? surface : null}
      emissive={glowStrength > 0 ? '#ffffff' : '#000000'}
      emissiveIntensity={glowStrength}
      roughness={0.9}
    />
  )

  return (
    <group position={[0, 0, zFront]}>
      <mesh position={[0, OPEN_H / 2, -0.45]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, OPEN_H, 0.6]} />
        <meshStandardMaterial color={theme.wall.gap} roughness={0.9} />
      </mesh>

      {/* Textured faces, front and back. */}
      <mesh position={[0, OPEN_H / 2, -0.14]}>
        <planeGeometry args={[WIDTH, OPEN_H]} />
        {surfaceMaterial(surfaceRef)}
      </mesh>
      <mesh position={[0, OPEN_H / 2, -0.76]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[WIDTH, OPEN_H]} />
        {surfaceMaterial(null)}
      </mesh>

      {/* Number and health bar. */}
      <mesh position={[0, OPEN_H / 2, -0.12]}>
        <planeGeometry args={[WIDTH, OPEN_H]} />
        <meshBasicMaterial map={overlay} transparent depthWrite={false} toneMapped={false} />
      </mesh>

      {/* Neon frame: solid bars plus a pulsing additive halo. */}
      {[
        [-(WIDTH + BAR) / 2, FRAME_H / 2, BAR, FRAME_H],
        [(WIDTH + BAR) / 2, FRAME_H / 2, BAR, FRAME_H],
        [0, OPEN_H + BAR / 2, FRAME_W + BAR, BAR],
        [0, 0.05, FRAME_W, 0.1],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.05]}>
          <boxGeometry args={[w, h, 0.3]} />
          <meshBasicMaterial color="#d8feff" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, FRAME_H / 2, 0.22]}>
        <planeGeometry args={[FRAME_W + GLOW_MARGIN * 2, FRAME_H + GLOW_MARGIN * 2]} />
        <meshBasicMaterial
          ref={glowRef}
          map={glow}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

export default StageWall
