import { Sparkles } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BackSide, DoubleSide } from 'three'

import { beamTexture, labelTexture, mulberry32, skyTexture } from './textures'

/** Gradient sky dome that follows the camera, so it never clips at the far stages. */
export function Sky() {
  const ref = useRef(null)
  const camera = useThree((s) => s.camera)
  useFrame(() => ref.current?.position.copy(camera.position))
  return (
    <mesh ref={ref} renderOrder={-1}>
      <sphereGeometry args={[500, 32, 16]} />
      <meshBasicMaterial
        map={skyTexture()}
        side={BackSide}
        fog={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

/** Endless grass far below the map, so nothing looks like it floats over a void. */
export function Backdrop() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, -250]}>
      <planeGeometry args={[3000, 3000]} />
      <meshStandardMaterial color="#4cae45" roughness={1} />
    </mesh>
  )
}

const CLOUD_SPAN = 700

/** Puffy clouds drifting slowly across the sky. */
export function Clouds() {
  const group = useRef(null)
  const clouds = useMemo(() => {
    const rand = mulberry32(42)
    return Array.from({ length: 16 }, () => ({
      position: [(rand() - 0.5) * CLOUD_SPAN, 60 + rand() * 35, -650 + rand() * 850],
      puffs: Array.from({ length: 4 + Math.floor(rand() * 3) }, (_, i) => ({
        offset: [i * 7 - 10 + rand() * 4, rand() * 3, (rand() - 0.5) * 8],
        radius: 6 + rand() * 5,
      })),
    }))
  }, [])

  useFrame((_state, delta) => {
    if (!group.current) return
    for (const cloud of group.current.children) {
      cloud.position.x += delta * 2
      if (cloud.position.x > CLOUD_SPAN / 2) cloud.position.x -= CLOUD_SPAN
    }
  })

  return (
    <group ref={group}>
      {clouds.map((cloud, i) => (
        <group key={i} position={cloud.position}>
          {cloud.puffs.map((puff, j) => (
            <mesh key={j} position={puff.offset} scale={[puff.radius, puff.radius * 0.6, puff.radius]}>
              <icosahedronGeometry args={[1, 2]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** Glowing floor pad with a light beam and rising sparkles. */
export function GlowPad({ position, color, radius = 1.8, beamHeight = 6 }) {
  const beam = useRef(null)
  useFrame(({ clock }) => {
    if (beam.current) beam.current.opacity = 0.45 + 0.15 * Math.sin(clock.elapsedTime * 2.4)
  })
  return (
    <group position={position}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[radius, radius, 0.12, 40]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.7, radius * 0.8, 40]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[0, beamHeight / 2, 0]}>
        <cylinderGeometry args={[radius * 0.95, radius, beamHeight, 40, 1, true]} />
        <meshBasicMaterial
          ref={beam}
          map={beamTexture()}
          color={color}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <Sparkles
        count={30}
        scale={[radius * 2, beamHeight, radius * 2]}
        position={[0, beamHeight / 2, 0]}
        size={5}
        speed={0.6}
        color={color}
      />
    </group>
  )
}

/** Floating, spinning gold crown. */
export function Crown({ position }) {
  const ref = useRef(null)
  useFrame(({ clock }, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.8
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.6) * 0.25
  })
  const gold = <meshStandardMaterial color="#ffc93c" metalness={0.6} roughness={0.25} emissive="#7a5200" emissiveIntensity={0.5} />
  return (
    <group ref={ref} position={position}>
      <mesh>
        <cylinderGeometry args={[1, 1, 0.7, 24, 1, true]} />
        <meshStandardMaterial color="#ffc93c" metalness={0.6} roughness={0.25} emissive="#7a5200" emissiveIntensity={0.5} side={DoubleSide} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <group key={i} position={[Math.cos(a), 0, Math.sin(a)]}>
            <mesh position={[0, 0.75, 0]}>
              <coneGeometry args={[0.28, 0.8, 12]} />
              {gold}
            </mesh>
            <mesh position={[0, 1.2, 0]}>
              <sphereGeometry args={[0.13, 12, 8]} />
              <meshStandardMaterial color="#ff3b6b" emissive="#ff3b6b" emissiveIntensity={0.6} />
            </mesh>
            <mesh position={[0, 0, 0]} scale={1.02}>
              <sphereGeometry args={[0.12, 12, 8]} />
              <meshStandardMaterial color="#3bb8ff" emissive="#3bb8ff" emissiveIntensity={0.6} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

const CRYSTAL_SHARDS = [
  { offset: [0, 0, 0], scale: 1, tilt: [0, 0, 0] },
  { offset: [0.55, 0, 0.2], scale: 0.65, tilt: [0.1, 0, -0.35] },
  { offset: [-0.45, 0, -0.25], scale: 0.55, tilt: [-0.15, 0, 0.4] },
]

/** Cluster of glowing crystal shards. */
export function Crystal({ position, color, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      {CRYSTAL_SHARDS.map((shard, i) => (
        <mesh
          key={i}
          position={[shard.offset[0], 1.1 * shard.scale, shard.offset[2]]}
          rotation={shard.tilt}
          scale={[0.55 * shard.scale, 1.4 * shard.scale, 0.55 * shard.scale]}
          castShadow
        >
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.45}
            roughness={0.15}
            metalness={0.1}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}

/** A flat sign with canvas-rendered text. */
export function Label({ lines, position, rotationY = 0, size, style }) {
  const texture = labelTexture({ lines, aspect: size[0] / size[1], ...style })
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  )
}
