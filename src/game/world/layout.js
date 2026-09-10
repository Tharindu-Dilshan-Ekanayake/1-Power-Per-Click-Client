import { mulberry32 } from './textures'
import {
  CORRIDOR_HALF,
  END_Z,
  GATE_Z,
  LOBBY_HALF,
  OPEN_H,
  OPEN_HALF,
  RING,
  SPAWN,
  STAGE_COUNT,
  STAGE_LEN,
  STAGE_START,
  stageStart,
  THEMES,
  WALL_H,
  WALL_T,
  wallHp,
} from './themes'

/** Stage 1's two VIP rooms, centred halfway down the corridor. */
const VIP_Z = stageStart(1) - STAGE_LEN / 2
const VIP_ROOMS = [
  { side: 1, title: 'SUPER VIP', floor: ['#b57cff', '#9d5cf0'], wall: '#7a4cc8', neon: '#d59bff', pad: '#4fd8ff' },
  { side: -1, title: 'VIP ZONE', floor: ['#ffb347', '#f59b25'], wall: '#c07a2a', neon: '#ffd166', pad: '#ffe14a' },
]

/** Splits [a, b] into chunks of at most `len`. */
function segments(a, b, len = 8) {
  const out = []
  for (let s = a; s < b - 0.01; s += len) out.push([s, Math.min(b, s + len)])
  return out
}

/**
 * Builds the whole map as plain data. Static geometry is a flat list of boxes
 * (merged into a handful of meshes at render time); everything animated is listed
 * separately for its own component.
 */
export function buildLayout() {
  const rand = mulberry32(1337)
  const pick = (list) => list[Math.floor(rand() * list.length)]

  /** `{ p: centre, s: size, m: material key, c: has a collider }` */
  const blocks = []
  const walls = []
  const portals = []
  const pads = []
  const crowns = []
  const crystals = []
  const labels = []

  const box = (x0, y0, z0, x1, y1, z1, m, c = true) => {
    blocks.push({
      p: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
      s: [x1 - x0, y1 - y0, z1 - z0],
      m,
      c,
    })
  }

  /** Voxel tree: trunk plus two stacked leaf cubes. All solid, so you can climb it. */
  const tree = (x, y, z, s = 1) => {
    const top = y + 3 * s
    box(x - 0.45 * s, y, z - 0.45 * s, x + 0.45 * s, top, z + 0.45 * s, 'trunk')
    box(x - 1.7 * s, top - 0.4 * s, z - 1.7 * s, x + 1.7 * s, top + 2 * s, z + 1.7 * s, 'leaves')
    box(x - 1.1 * s, top + 2 * s, z - 1.1 * s, x + 1.1 * s, top + 3.4 * s, z + 1.1 * s, 'leavesLight')
  }

  /** A column of terrain: dirt sides with a grass cap. */
  const hill = (x0, z0, x1, z1, h) => {
    box(x0, -2, z0, x1, h - 0.5, z1, 'dirt')
    box(x0, h - 0.5, z0, x1, h, z1, 'grass')
  }

  const mushroom = (x, z) => {
    box(x - 0.15, 0, z - 0.15, x + 0.15, 0.5, z + 0.15, 'stem', false)
    box(x - 0.45, 0.5, z - 0.45, x + 0.45, 0.85, z + 0.45, 'mushroomCap', false)
  }

  // --- Lobby ground ---------------------------------------------------------------
  const outer = LOBBY_HALF + RING * 3
  box(-outer, -1, STAGE_START, outer, 0, outer, 'path')

  // Four grass lawns with brown kerbs, leaving a cross of path between them.
  // Visual only: they sit a hair above the path, so there is nothing to trip on.
  const lawnLo = 6
  const lawnHi = LOBBY_HALF - 6
  const lawns = []
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const [x0, x1] = sx > 0 ? [lawnLo, lawnHi] : [-lawnHi, -lawnLo]
      const [z0, z1] = sz > 0 ? [lawnLo, lawnHi] : [-lawnHi, -lawnLo]
      lawns.push({ x0, x1, z0, z1, sx, sz })
      box(x0, 0, z0, x1, 0.06, z1, 'grass', false)
      const k = 0.6
      box(x0 - k, 0, z0 - k, x1 + k, 0.12, z0, 'border', false)
      box(x0 - k, 0, z1, x1 + k, 0.12, z1 + k, 'border', false)
      box(x0 - k, 0, z0, x0, 0.12, z1, 'border', false)
      box(x1, 0, z0, x1 + k, 0.12, z1, 'border', false)
    }
  }

  // Lawn dressing: trees at the outer corners, mushrooms scattered about.
  for (const { x0, x1, z0, z1, sx, sz } of lawns) {
    const farX = sx > 0 ? x1 - 5 : x0 + 5
    const farZ = sz > 0 ? z1 - 5 : z0 + 5
    tree(farX, 0, farZ, 1.1)
    if (!(sx > 0 && sz > 0)) {
      tree(farX - sx * 13, 0, farZ, 0.9)
      tree(farX, 0, farZ - sz * 12, 1)
    }
    for (let i = 0; i < 6; i++) {
      mushroom(x0 + 2 + rand() * (x1 - x0 - 4), z0 + 2 + rand() * (z1 - z0 - 4))
    }
  }

  // A small jump course of coloured pillars on the north-east lawn.
  const course = [
    [12, 12, 1.2, 'red'],
    [15.5, 15, 2.2, 'yellow'],
    [19, 18, 3.2, 'blue'],
    [22.5, 21, 4.2, 'purple'],
    [26, 24, 5.2, 'green'],
    [29.5, 27, 6.2, 'orange'],
  ]
  for (const [x, z, h, m] of course) box(x - 1.25, 0, z - 1.25, x + 1.25, h, z + 1.25, m)
  box(31.5, 0, 29, 35.5, 7.2, 33, 'yellow')
  crystals.push({ position: [33.5, 7.2, 31], color: '#ffd23f', scale: 1.1 })

  // --- Terraces around the lobby --------------------------------------------------
  // Three rings: two low steps you can jump up, then a tall cliff that bounds the map.
  const ringHeight = [
    () => pick([1.0, 1.2, 1.2]),
    () => pick([2.2, 2.4, 2.4]),
    () => pick([7, 8, 9, 10, 11, 12]),
  ]
  const gateHalf = CORRIDOR_HALF + WALL_T
  for (let r = 0; r < 3; r++) {
    const s0 = LOBBY_HALF + r * RING
    const s1 = s0 + RING
    const strips = [
      ...segments(-s1, s1).map(([a, b]) => [a, s0, b, s1]),
      ...[
        [-s1, -gateHalf],
        [gateHalf, s1],
      ].flatMap(([a0, a1]) => segments(a0, a1).map(([a, b]) => [a, -s1, b, -s0])),
      ...segments(-s0, s0).map(([a, b]) => [s0, a, s1, b]),
      ...segments(-s0, s0).map(([a, b]) => [-s1, a, -s0, b]),
    ]
    for (const [x0, z0, x1, z1] of strips) {
      const h = ringHeight[r]()
      hill(x0, z0, x1, z1, h)
      const cx = (x0 + x1) / 2 + (rand() - 0.5) * 2
      const cz = (z0 + z1) / 2 + (rand() - 0.5) * 2
      if (r > 0 && rand() < (r === 1 ? 0.2 : 0.45)) tree(cx, h, cz, pick([0.9, 1, 1.15]))
      else if (r < 2 && rand() < 0.12) crystals.push({ position: [cx, h, cz], color: '#7fdcff', scale: 0.8 })
    }
  }

  // --- Gate tower (holds wall 1) --------------------------------------------------
  const GZ0 = STAGE_START
  const GZ1 = GATE_Z
  box(-gateHalf, -1, GZ0, -OPEN_HALF, 14, GZ1, 'dark')
  box(OPEN_HALF, -1, GZ0, gateHalf, 14, GZ1, 'dark')
  box(-OPEN_HALF, OPEN_H, GZ0, OPEN_HALF, 14, GZ1, 'dark')
  box(-12, 14, GZ0 + 1, 12, 16, GZ1 - 1, 'dark')
  box(-9, 16, GZ0 + 1.5, 9, 18, GZ1 - 1.5, 'dark')
  box(-6, 18, GZ0 + 2, 6, 20, GZ1 - 2, 'dark')
  walls.push({ number: 1, theme: THEMES[0], zFront: GATE_Z, hp: wallHp(1) })
  labels.push({
    lines: ['STAGE 1'],
    position: [0, 12, GATE_Z + 0.12],
    size: [13, 3],
    style: { fill: ['#fff6a8', '#ffc21a'], bg: '#15151c', border: '#ffc21a' },
  })

  // --- Stage corridors --------------------------------------------------------------
  const CH = CORRIDOR_HALF
  for (let k = 1; k <= STAGE_COUNT; k++) {
    const theme = THEMES[k - 1]
    const z0 = stageStart(k)
    const z1 = z0 - STAGE_LEN
    const opening = k === 1 ? [VIP_Z - 5, VIP_Z + 5] : null

    /** Calls fn(za, zb) for the stretches of this stage's side wall not cut by a door. */
    const alongWall = (fn) => {
      if (!opening) return fn(z1, z0)
      fn(z1, opening[0])
      fn(opening[1], z0)
    }

    box(-CH, -1, z1, CH, 0, z0, `floor:${theme.floor.join(',')}`)

    for (const side of [-1, 1]) {
      const xin = side * CH
      const xout = side * (CH + WALL_T)
      const [xa, xb] = side < 0 ? [xout, xin] : [xin, xout]
      const [na, nb] = side < 0 ? [xin, xin + 0.12] : [xin - 0.12, xin]
      alongWall((za, zb) => {
        box(xa, -1, za, xb, WALL_H, zb, `panel:${theme.side}`)
        box(na, 0, za, nb, 0.25, zb, `neon:${theme.neon}`, false)
        box(na, WALL_H - 0.6, za, nb, WALL_H - 0.4, zb, `neon:${theme.neon}`, false)
      })
      if (opening) box(xa, 8, opening[0], xb, WALL_H, opening[1], `panel:${theme.side}`)
      box(xa - 0.2, WALL_H, z1, xb + 0.2, WALL_H + 0.6, z0, 'dark')

      // Pillars every 11 units, skipping any doorway.
      for (let z = z0 - 5.5; z > z1; z -= 11) {
        if (opening && z > opening[0] - 1 && z < opening[1] + 1) continue
        const [pa, pb] = side < 0 ? [xin, xin + 0.8] : [xin - 0.8, xin]
        box(pa, 0, z - 0.8, pb, WALL_H, z + 0.8, 'dark')
      }

      // Terrain beyond the corridor walls, so it reads as a canyon from above.
      const [hx0, hx1] = side < 0 ? [-26, -14] : [14, 26]
      const hillTop = Math.min(z0, -(LOBBY_HALF + RING * 3))
      const ranges = opening
        ? [
            [z1, VIP_Z - 8],
            [VIP_Z + 8, hillTop],
          ]
        : [[z1, hillTop]]
      for (const [ra, rb] of ranges) {
        for (const [a, b] of segments(ra, rb)) {
          const h = pick([13, 14, 15, 16, 17])
          hill(hx0, a, hx1, b, h)
          if (rand() < 0.35) tree((hx0 + hx1) / 2 + (rand() - 0.5) * 4, h, (a + b) / 2, pick([1, 1.2]))
        }
      }

      crystals.push({ position: [side * (CH - 2), 0, z0 - 3], color: theme.neon, scale: 0.9 })
    }

    if (k < STAGE_COUNT) {
      // Divider holding the next stage's wall.
      box(-CH, -1, z1 - 1, -OPEN_HALF, WALL_H, z1 + 1, 'dark')
      box(OPEN_HALF, -1, z1 - 1, CH, WALL_H, z1 + 1, 'dark')
      box(-OPEN_HALF, OPEN_H, z1 - 1, OPEN_HALF, WALL_H, z1 + 1, 'dark')
      walls.push({ number: k + 1, theme: THEMES[k], zFront: z1 + 1, hp: wallHp(k + 1) })
      labels.push({
        lines: [`STAGE ${k + 1}`],
        position: [0, 11, z1 + 1.12],
        size: [9, 1.6],
        style: { fill: ['#fff6a8', '#ffc21a'] },
      })
    }
  }

  // --- The end of the line ----------------------------------------------------------
  box(-CH - WALL_T, -1, END_Z - 2, CH + WALL_T, WALL_H, END_Z, 'dark')
  for (const [a, b] of segments(-26, 26)) hill(a, END_Z - 14, b, END_Z - 2, pick([14, 15, 16]))
  labels.push({
    lines: ['MORE STAGES', 'COMING SOON'],
    position: [0, 10.4, END_Z + 0.05],
    size: [14, 3],
    style: { fill: ['#ffffff', '#bfe9ff'] },
  })

  // --- Portals ---------------------------------------------------------------------
  /** Stone arch around a portal. `facing` is the axis the portal's front faces along (+). */
  const arch = (cx, cz, facing) => {
    const place = (u0, u1, y0, y1, d0, d1) =>
      facing === 'x'
        ? box(cx + d0, y0, cz + u0, cx + d1, y1, cz + u1, 'portalStone')
        : box(cx + u0, y0, cz + d0, cx + u1, y1, cz + d1, 'portalStone')
    place(-5, -3.6, 0, 8.8, -1, 1)
    place(3.6, 5, 0, 8.8, -1, 1)
    place(-5, 5, 7.6, 8.8, -1, 1)
    place(-5.6, -3, 0, 1.4, -1.4, 1.4)
    place(3, 5.6, 0, 1.4, -1.4, 1.4)
  }

  const lastStage = [0, 2, stageStart(STAGE_COUNT) - 6]
  arch(-41, 0, 'x')
  portals.push({ position: [-41, 0, 0], rotationY: Math.PI / 2, target: lastStage })
  labels.push({
    lines: ['LAST STAGE'],
    position: [-39.95, 8.2, 0],
    rotationY: Math.PI / 2,
    size: [8.4, 1],
    style: { fill: ['#f3dcff', '#c07bff'] },
  })

  arch(0, END_Z + 1, 'z')
  portals.push({ position: [0, 0, END_Z + 1], rotationY: 0, target: SPAWN })
  labels.push({
    lines: ['BACK TO LOBBY'],
    position: [0, 8.2, END_Z + 2.05],
    size: [8.4, 1],
    style: { fill: ['#f3dcff', '#c07bff'] },
  })

  // --- VIP rooms (stage 1) ----------------------------------------------------------
  for (const room of VIP_ROOMS) {
    const s = room.side
    const [x0, x1] = s > 0 ? [CH + WALL_T, 26] : [-26, -CH - WALL_T]
    const [bx0, bx1] = s > 0 ? [26, 27] : [-27, -26]
    const za = VIP_Z - 7
    const zb = VIP_Z + 7
    box(x0, -1, za, x1, 0, zb, `floor:${room.floor.join(',')}`)
    box(bx0, -1, za - 1, bx1, 10, zb + 1, `panel:${room.wall}`)
    box(Math.min(x0, x1), -1, za - 1, Math.max(x0, x1), 10, za, `panel:${room.wall}`)
    box(Math.min(x0, x1), -1, zb, Math.max(x0, x1), 10, zb + 1, `panel:${room.wall}`)
    const nx = s > 0 ? [bx0 - 0.12, bx0] : [bx1, bx1 + 0.12]
    box(nx[0], 0, za, nx[1], 0.25, zb, `neon:${room.neon}`, false)
    box(nx[0], 9.4, za, nx[1], 9.6, zb, `neon:${room.neon}`, false)

    pads.push({ position: [s * 20, 0, VIP_Z], color: room.pad })
    crowns.push({ position: [s * 20, 4.2, VIP_Z] })
    labels.push({
      lines: [room.title],
      position: [s * 25.9, 7.2, VIP_Z],
      rotationY: -s * (Math.PI / 2),
      size: [10, 2],
      style: { fill: ['#ffffff', room.neon] },
    })
  }

  // --- Welcome board at the east end of the cross path -----------------------------
  box(40.4, 0, -5.6, 41, 9, -4.8, 'trunk')
  box(40.4, 0, 4.8, 41, 9, 5.6, 'trunk')
  box(40.4, 2.6, -6, 41, 8.6, 6, 'trunk')
  labels.push({
    lines: [
      { text: 'WELCOME!', scale: 1.5, fill: ['#fff6a8', '#ffc21a'] },
      'WASD run  -  Shift sprint  -  Space jump',
      'Walk through the glowing walls',
      `to explore all ${STAGE_COUNT} stages`,
      { text: 'Purple portal = last stage', fill: '#e2b8ff' },
    ],
    position: [40.36, 5.6, 0],
    rotationY: -Math.PI / 2,
    size: [11.4, 5.6],
    style: { bg: '#6b4424', border: '#4a2c14' },
  })

  return { blocks, walls, portals, pads, crowns, crystals, labels }
}
