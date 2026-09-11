import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, DoubleSide, Euler, Matrix4, Quaternion, Vector3 } from 'three'

import { formatNumber } from '../format'
import { useGame } from '../gameStore'
import { playSound } from '../sound'
import { WALL_REGEN, wallHp } from '../walls'
import {
  createDynamicLabel,
  createHpBar,
  createWallNumber,
  glowFrameTexture,
  HP_BAR_ASPECT,
  radialGlowTexture,
  wallTexture,
} from './textures'
import { FRAME_COLOR, OPEN_H, OPEN_HALF } from './themes'

const WIDTH = OPEN_HALF * 2
const DEPTH = 0.6
/** Local z of the slab's centre; the doorway's front face is at z = 0. */
const WALL_Z = -0.45
const BAR = 0.5
const FRAME_W = WIDTH + BAR
const FRAME_H = OPEN_H + BAR / 2
const GLOW_MARGIN = 3
const BAR_W = WIDTH * 0.64
const BAR_H = BAR_W / HP_BAR_ASPECT
const BAR_Y = OPEN_H * 0.36

/**
 * How far in front of or behind the wall a swing still reaches it. In a tunnel the
 * next wall's reach ends inside this wall's frame, so it can't be hit through this
 * one; and a broken wall ignores the player (see onNear), so it never steals hits.
 */
const REACH = 3.2
/** Delay from click to impact, so the hit lands mid-chop rather than on the wind-up. */
const HIT_DELAY_S = 0.12
const SHAKE_S = 0.25
const FLASH_S = 0.2
/** Hits weaker than this fraction of the wall's health can't outpace its healing. */
const WEAK_HIT = 0.1
const DEBRIS_COUNT = 48
const GRAVITY = -18
const POPUP_COUNT = 6
const POPUP_S = 0.9

// Scratch objects for the debris matrices.
const _m = new Matrix4()
const _p = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()
const _e = new Euler()
const _c = new Color()

/**
 * The solid, numbered wall that fills a stage doorway. Stand within reach and click
 * to hit it with your sword: each hit deals your current Power as damage, and the
 * wall heals between hits, so a tougher wall needs more Power. At 0 health it
 * shatters and lets you through, and stays down until you're back in the lobby.
 *
 * @param {{ number: number, stage: number, theme: object, zFront: number }} props
 *   `zFront` is the z of the doorway's front (+Z) face.
 */
export function StageWall({ number, stage, theme, zFront }) {
  const maxHp = wallHp(number)
  // Shared by the whole stage; the number is this wall's own.
  const surface = wallTexture(stage, theme.wall)
  const numberMap = useMemo(() => createWallNumber(number), [number])
  const glow = glowFrameTexture(FRAME_COLOR, FRAME_W, FRAME_H, GLOW_MARGIN)
  const glowStrength = theme.wall.glow ?? 0

  const bar = useMemo(() => createHpBar(), [])
  const popupLabels = useMemo(
    () => Array.from({ length: POPUP_COUNT }, () => createDynamicLabel({ aspect: 2.4, width: 256 })),
    [],
  )
  useEffect(
    () => () => {
      bar.texture.dispose()
      numberMap.dispose()
      popupLabels.forEach((label) => label.texture.dispose())
    },
    [bar, numberMap, popupLabels],
  )

  /** The front and back surface materials, pulsed and flashed every frame. */
  const surfaces = useRef([])
  const slab = useRef(null)
  const glowRef = useRef(null)
  const impact = useRef(null)
  const impactMaterial = useRef(null)
  const debrisMesh = useRef(null)
  const popups = useRef([])

  const broken = useGame((s) => !!s.brokenWalls[number])
  // Hit state lives in a ref: it changes every frame and must not re-render.
  const fx = useRef({
    hp: maxHp,
    shown: -1,
    seenSwing: -Infinity,
    impactAt: 0,
    side: 1,
    hitX: 0,
    hitAt: -Infinity,
    broken: false,
    warnedAt: -Infinity,
    nextDebris: 0,
    nextPopup: 0,
    popupAt: [],
    popupX: [],
    popupSide: [],
    debris: Array.from({ length: DEBRIS_COUNT }, () => ({
      born: -Infinity,
      life: 1,
      size: 0,
      alive: false,
      p: new Vector3(),
      v: new Vector3(),
      spin: new Vector3(),
    })),
  })

  // Debris starts hidden, each chunk in one of the wall's colours.
  useLayoutEffect(() => {
    const mesh = debrisMesh.current
    if (!mesh) return
    const palette = theme.wall.palette
    _m.makeScale(0, 0, 0)
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      mesh.setMatrixAt(i, _m)
      mesh.setColorAt(i, _c.set(palette[i % palette.length]))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [theme])

  /** Throws `count` chunks: small chips at the hit point, or big ones over the whole wall. */
  const spawnDebris = (s, now, count, big) => {
    for (let n = 0; n < count; n++) {
      const d = s.debris[s.nextDebris]
      s.nextDebris = (s.nextDebris + 1) % DEBRIS_COUNT
      const r = Math.random
      // Mostly towards the player; a shattering wall throws some the other way too.
      const out = big && r() < 0.35 ? -s.side : s.side
      d.born = now
      d.alive = true
      d.life = big ? 1.2 + r() * 0.6 : 0.6 + r() * 0.3
      d.size = big ? 0.35 + r() * 0.55 : 0.12 + r() * 0.16
      if (big) d.p.set((r() - 0.5) * WIDTH * 0.9, 0.5 + r() * (OPEN_H - 1), WALL_Z + out * 0.2)
      else d.p.set(s.hitX + (r() - 0.5) * 1.2, 1.8 + r() * 1.4, WALL_Z + s.side * (DEPTH / 2 + 0.05))
      d.v.set((r() - 0.5) * (big ? 6 : 4), (big ? 2 : 3) + r() * 4, out * (big ? 2 + r() * 5 : 1.5 + r() * 2.5))
      d.spin.set(r() * 12 - 6, r() * 12 - 6, r() * 12 - 6)
    }
  }

  const showDamage = (s, now, damage) => {
    const i = s.nextPopup
    s.nextPopup = (i + 1) % POPUP_COUNT
    s.popupAt[i] = now
    s.popupX[i] = s.hitX + (Math.random() - 0.5) * 1.5
    s.popupSide[i] = s.side
    popupLabels[i].draw({ lines: [{ text: `-${formatNumber(damage)}`, icon: 'sword', fill: ['#ffffff', '#ffb347'] }] })
  }

  useFrame(({ camera, clock }, delta) => {
    const now = performance.now() / 1000
    const s = fx.current
    const game = useGame.getState()
    const near = game.nearWall?.number === number
    // Follow the store: a rebuilt wall comes back at full health.
    const isBroken = !!game.brokenWalls[number]
    if (s.broken && !isBroken) s.hp = maxHp
    s.broken = isBroken

    // A fresh swing within reach: queue the impact, on whichever side the player is.
    if (!s.broken && near && game.swingAt > s.seenSwing && now - game.swingAt < 0.2) {
      s.seenSwing = game.swingAt
      s.impactAt = game.swingAt + HIT_DELAY_S
      const at = game.swingPos
      s.side = at && at[2] < zFront + WALL_Z ? -1 : 1
      s.hitX = at ? Math.max(-OPEN_HALF + 1.5, Math.min(OPEN_HALF - 1.5, at[0])) : 0
    }

    if (s.impactAt && now >= s.impactAt) {
      s.impactAt = 0
      if (!s.broken) {
        const damage = game.power
        s.hp -= damage
        s.hitAt = now
        spawnDebris(s, now, 6, false)
        showDamage(s, now, damage)
        if (s.hp <= 0) {
          s.hp = 0
          s.broken = true
          spawnDebris(s, now, DEBRIS_COUNT - 8, true)
          playSound('wallBreak')
          game.breakWall(number)
        } else {
          playSound('wallHit', { strength: Math.min(1, (damage / maxHp) * 4) })
          if (damage < maxHp * WEAK_HIT && now - s.warnedAt > 2) {
            s.warnedAt = now
            game.notify(`Wall ${number} is too strong! Get about ${formatNumber(Math.ceil(maxHp * WEAK_HIT))} Power`, 'error')
          }
        }
      }
    }

    // Heals all the time, so hits have to outpace it.
    if (!s.broken && s.hp < maxHp) s.hp = Math.min(maxHp, s.hp + maxHp * WALL_REGEN * delta)
    const shown = Math.ceil(s.hp)
    if (shown !== s.shown) {
      s.shown = shown
      bar.draw(shown, maxHp)
    }

    // Shake, flash and the pulsing neon.
    const t = now - s.hitAt
    const flash = t < FLASH_S ? 1 - t / FLASH_S : 0
    if (slab.current) slab.current.position.x = t < SHAKE_S ? Math.sin(t * 80) * 0.12 * (1 - t / SHAKE_S) : 0
    if (impact.current) impact.current.position.set(s.hitX, 2.6, WALL_Z + s.side * (DEPTH / 2 + 0.08))
    if (impactMaterial.current) impactMaterial.current.opacity = flash
    const emissive = glowStrength * (0.8 + 0.2 * Math.sin(clock.elapsedTime * 1.5 + number)) + flash * 0.35
    for (const material of surfaces.current) if (material) material.emissiveIntensity = emissive
    if (glowRef.current) glowRef.current.opacity = 0.8 + 0.2 * Math.sin(clock.elapsedTime * 2.2 + number)

    // Debris: simple ballistic arcs that stop at the floor and shrink away.
    const mesh = debrisMesh.current
    if (mesh) {
      let dirty = false
      for (let i = 0; i < DEBRIS_COUNT; i++) {
        const d = s.debris[i]
        if (!d.alive) continue
        const age = now - d.born
        dirty = true
        if (age > d.life) {
          d.alive = false
          mesh.setMatrixAt(i, _m.makeScale(0, 0, 0))
          continue
        }
        const size = d.size * Math.min(1, (d.life - age) / (d.life * 0.3))
        _p.set(
          d.p.x + d.v.x * age,
          Math.max(size / 2, d.p.y + d.v.y * age + 0.5 * GRAVITY * age * age),
          d.p.z + d.v.z * age,
        )
        _q.setFromEuler(_e.set(d.spin.x * age, d.spin.y * age, d.spin.z * age))
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(size)))
      }
      if (dirty) mesh.instanceMatrix.needsUpdate = true
    }

    popups.current.forEach((popup, i) => {
      if (!popup) return
      const age = now - (s.popupAt[i] ?? -Infinity)
      popup.visible = age >= 0 && age < POPUP_S
      if (!popup.visible) return
      popup.position.set(s.popupX[i], 4.4 + age * 2, WALL_Z + s.popupSide[i] * 1.2)
      popup.material.opacity = 1 - (age / POPUP_S) ** 2
      popup.quaternion.copy(camera.quaternion)
    })
  })

  const onNear = ({ other }) => {
    if (other.rigidBodyObject?.name !== 'player') return
    const game = useGame.getState()
    // A broken wall is just a doorway; don't let it steal hits from the next one.
    if (game.brokenWalls[number]) return
    game.setNearWall(number, zFront + WALL_Z)
    // Only until it's been broken once; after that the player knows what to do.
    if (!fx.current.broken && game.bestWall < number) {
      game.notify(`Wall ${number} - ${formatNumber(maxHp)} HP. Click to hit it with your sword!`)
    }
  }
  const onFar = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().clearNearWall(number)
  }

  return (
    <group position={[0, 0, zFront]}>
      <group ref={slab} visible={!broken}>
        <mesh position={[0, OPEN_H / 2, WALL_Z]} castShadow receiveShadow>
          <boxGeometry args={[WIDTH, OPEN_H, DEPTH]} />
          <meshStandardMaterial color={theme.wall.gap} roughness={0.9} />
        </mesh>

        {/* The same face, number and health bar on both sides. */}
        {[1, -1].map((face, i) => (
          <group
            key={face}
            position={[0, 0, WALL_Z + face * (DEPTH / 2 + 0.01)]}
            rotation={[0, face > 0 ? 0 : Math.PI, 0]}
          >
            <mesh position={[0, OPEN_H / 2, 0]}>
              <planeGeometry args={[WIDTH, OPEN_H]} />
              {/* Emissive is always on, so a hit can flash the surface white. */}
              <meshStandardMaterial
                ref={(el) => {
                  surfaces.current[i] = el
                }}
                map={surface}
                emissiveMap={surface}
                emissive="#ffffff"
                emissiveIntensity={glowStrength}
                roughness={0.9}
              />
            </mesh>
            <mesh position={[0, OPEN_H / 2, 0.01]}>
              <planeGeometry args={[WIDTH, OPEN_H]} />
              <meshBasicMaterial map={numberMap} transparent depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh position={[0, BAR_Y, 0.02]}>
              <planeGeometry args={[BAR_W, BAR_H]} />
              <meshBasicMaterial map={bar.texture} transparent depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        ))}

        <mesh ref={impact}>
          <planeGeometry args={[4.5, 4.5]} />
          <meshBasicMaterial
            ref={impactMaterial}
            map={radialGlowTexture()}
            color="#fff3c4"
            transparent
            opacity={0}
            blending={AdditiveBlending}
            depthWrite={false}
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>

      <instancedMesh ref={debrisMesh} args={[undefined, undefined, DEBRIS_COUNT]} frustumCulled={false} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>

      {popupLabels.map((label, i) => (
        <mesh
          key={i}
          ref={(el) => {
            popups.current[i] = el
          }}
          visible={false}
          renderOrder={2}
        >
          <planeGeometry args={[2.6, 1.08]} />
          <meshBasicMaterial map={label.texture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}

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

      <RigidBody type="fixed" colliders={false}>
        {/* Solid until broken. */}
        {!broken && <CuboidCollider args={[OPEN_HALF, OPEN_H / 2, DEPTH / 2]} position={[0, OPEN_H / 2, WALL_Z]} />}
        <CuboidCollider
          sensor
          args={[OPEN_HALF, OPEN_H / 2, REACH]}
          position={[0, OPEN_H / 2, WALL_Z]}
          onIntersectionEnter={onNear}
          onIntersectionExit={onFar}
        />
      </RigidBody>
    </group>
  )
}

export default StageWall
