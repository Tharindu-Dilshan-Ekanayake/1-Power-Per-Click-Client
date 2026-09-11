import { EGGS } from '../eggs'
import { SWORDS } from '../swords'
import { TRAINERS } from '../trainers'
import { WALLS_PER_STAGE, wallStage, WIN_PADS } from '../walls'
import { mulberry32 } from './textures'
import {
  cabinEnd,
  cabinStart,
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
  TUNNEL_LEAD,
  WALL_GAP,
  WALL_H,
  WALL_T,
} from './themes'

/** The two small rooms off either side of every stage's cabin, and their doors' half-width. */
const VIP_DOOR = 5
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
  const winPads = []
  /** Rectangles `{ x0, x1, z0, z1, y }` with a ceiling over them (see Roofs). */
  const roofs = []

  /** Win pads in the corners in front of a wall face at `zFront`, paying out for wall `number`. */
  const addPads = (number, zFront) => {
    for (const pad of WIN_PADS) winPads.push({ number, pad, position: [pad.side * 9.9, 0, zFront + 2] })
  }
  /** Stage wall `number` with its front face at `zFront`. */
  const addWall = (number, zFront) => {
    const stage = wallStage(number)
    walls.push({ number, stage, theme: THEMES[stage - 1], zFront })
  }
  /** Dark frame across a stage corridor centred on `z`, around the doorway a wall fills. */
  const divider = (z) => {
    box(-CORRIDOR_HALF, -1, z - 1, -OPEN_HALF, WALL_H, z + 1, 'dark')
    box(OPEN_HALF, -1, z - 1, CORRIDOR_HALF, WALL_H, z + 1, 'dark')
    box(-OPEN_HALF, OPEN_H, z - 1, OPEN_HALF, WALL_H, z + 1, 'dark')
  }
  /** The two small rooms opening off either side of a cabin, centred on `vipZ`. */
  const sideRooms = (vipZ) => {
    for (const room of VIP_ROOMS) {
      const s = room.side
      const [x0, x1] = s > 0 ? [CORRIDOR_HALF + WALL_T, 26] : [-26, -CORRIDOR_HALF - WALL_T]
      const [bx0, bx1] = s > 0 ? [26, 27] : [-27, -26]
      const za = vipZ - 7
      const zb = vipZ + 7
      box(x0, -1, za, x1, 0, zb, `floor:${room.floor.join(',')}`)
      box(bx0, -1, za - 1, bx1, 10, zb + 1, `panel:${room.wall}`)
      box(Math.min(x0, x1), -1, za - 1, Math.max(x0, x1), 10, za, `panel:${room.wall}`)
      box(Math.min(x0, x1), -1, zb, Math.max(x0, x1), 10, zb + 1, `panel:${room.wall}`)
      const nx = s > 0 ? [bx0 - 0.12, bx0] : [bx1, bx1 + 0.12]
      box(nx[0], 0, za, nx[1], 0.25, zb, `neon:${room.neon}`, false)
      box(nx[0], 9.4, za, nx[1], 9.6, zb, `neon:${room.neon}`, false)
      roofs.push({ x0: Math.min(x0, bx0), x1: Math.max(x1, bx1), z0: za - 1, z1: zb + 1, y: 9.99 })

      pads.push({ position: [s * 20, 0, vipZ], color: room.pad })
      crowns.push({ position: [s * 20, 4.2, vipZ] })
      labels.push({
        lines: [room.title],
        position: [s * 25.9, 7.2, vipZ],
        rotationY: -s * (Math.PI / 2),
        size: [10, 2],
        style: { fill: ['#ffffff', room.neon] },
      })
    }
  }

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

  // --- Lobby ground ---------------------------------------------------------------
  // Grass everywhere, with tan walkways and three themed zones laid on top: swords on
  // the west side, training (north) and eggs (south) on the east. Paths and zone
  // floors are visual only, a hair above the grass, so there is nothing to trip on.
  const L = LOBBY_HALF
  const outer = L + RING * 3
  box(-outer, -1, STAGE_START, outer, 0, outer, 'grass')

  const path = (x0, z0, x1, z1) => box(x0, 0, z0, x1, 0.05, z1, 'path', false)
  const kerb = (x0, z0, x1, z1) => box(x0, 0, z0, x1, 0.12, z1, 'border', false)

  // Walkways: the main avenue from the north plaza to the gate (and on through its
  // tunnel), the plaza itself, and a cross path between the training and egg zones.
  // Half-width of the avenue: as wide as the gate's doorway (OPEN_HALF).
  const AVENUE = OPEN_HALF
  const K = AVENUE + 0.5
  const PLAZA_Z = L - 10
  const CROSS0 = -5
  const CROSS1 = 1
  path(-AVENUE, STAGE_START, AVENUE, PLAZA_Z)
  path(-L, PLAZA_Z, L, L)
  path(AVENUE, CROSS0, L, CROSS1)
  // A forecourt in front of the gate, as wide as the tower, between the zones' south
  // fences. The avenue's kerbs start where it ends.
  const FORECOURT = 4
  const towerHalf = CORRIDOR_HALF + WALL_T
  path(-towerHalf, GATE_Z, -AVENUE, GATE_Z + FORECOURT)
  path(AVENUE, GATE_Z, towerHalf, GATE_Z + FORECOURT)
  kerb(-K, GATE_Z + FORECOURT, -AVENUE, PLAZA_Z)
  kerb(AVENUE, GATE_Z + FORECOURT, K, CROSS0)
  kerb(AVENUE, CROSS1, K, PLAZA_Z)
  kerb(K, CROSS0 - 0.5, L, CROSS0)
  kerb(K, CROSS1, L, CROSS1 + 0.5)
  kerb(-L, PLAZA_Z - 0.5, -K, PLAZA_Z)
  kerb(K, PLAZA_Z - 0.5, L, PLAZA_Z)

  /** Lamp post with a glowing lantern, lining the walkways. */
  const lamp = (x, z) => {
    box(x - 0.15, 0, z - 0.15, x + 0.15, 3.6, z + 0.15, 'dark')
    box(x - 0.35, 3.6, z - 0.35, x + 0.35, 4.3, z + 0.35, 'neon:#fff1b8', false)
    box(x - 0.45, 4.3, z - 0.45, x + 0.45, 4.45, z + 0.45, 'dark', false)
  }
  // Placed clear of the zone entrances and the cross path.
  for (const z of [-26, -14, 8, 20]) lamp(-AVENUE - 1.2, z)
  for (const z of [-27, -11, 5, 20]) lamp(AVENUE + 1.2, z)
  for (const x of [13, 27]) {
    lamp(x, CROSS0 - 1.2)
    lamp(x, CROSS1 + 1.2)
  }

  /**
   * Low fence along an axis-aligned line, with gaps for entrances. `axis` is the
   * direction it runs ('x' or 'z'), `at` its fixed coordinate, `gaps` sorted
   * [from, to] ranges to leave open. One jump high, so it never traps anyone.
   */
  const fence = (axis, at, from, to, gaps, rail, post) => {
    const pieces = []
    let s = from
    for (const [g0, g1] of gaps) {
      if (g0 > s) pieces.push([s, g0])
      s = Math.max(s, g1)
    }
    if (s < to) pieces.push([s, to])
    const put = (a0, a1, y0, y1, t, m) =>
      axis === 'x' ? box(a0, y0, at - t, a1, y1, at + t, m) : box(at - t, y0, a0, at + t, y1, a1, m)
    for (const [a, b] of pieces) {
      put(a, b, 0.75, 0.95, 0.1, rail)
      put(a, b, 0.35, 0.5, 0.08, rail)
      const n = Math.max(1, Math.round((b - a) / 2.2))
      for (let k = 0; k <= n; k++) {
        const c = a + ((b - a) * k) / n
        put(c - 0.18, c + 0.18, 0, 1.1, 0.18, post)
      }
    }
  }

  /**
   * Entrance arch in a fence that runs along Z at x = `at`, with the zone's name on a
   * board across the top. `dir` is the way it faces (+1 = +X, -1 = -X).
   */
  const archGate = (at, center, width, dir, zone) => {
    const z0 = center - width / 2
    const z1 = center + width / 2
    box(at - 0.4, 0, z0 - 0.8, at + 0.4, 5.8, z0, zone.post)
    box(at - 0.4, 0, z1, at + 0.4, 5.8, z1 + 0.8, zone.post)
    box(at - 0.4, 5, z0, at + 0.4, 5.8, z1, zone.post)
    box(at - 0.42, 4.8, z0, at + 0.42, 5, z1, `neon:${zone.neon}`, false)
    box(at - 0.2, 5.8, z0 - 0.5, at + 0.2, 7.8, z1 + 0.5, zone.board)
    labels.push({
      lines: [zone.title],
      position: [at + dir * 0.22, 6.8, center],
      rotationY: (dir * Math.PI) / 2,
      size: [width + 0.4, 1.6],
      style: { fill: zone.fill },
    })
  }

  // Each zone has its own colours: floor, fence, arch and billboards. Zones start a
  // grass verge (with the lamp posts) away from the avenue.
  const ZONE_IN = AVENUE + 2
  const ZONES = {
    swords: {
      x0: -L + 1, x1: -ZONE_IN, z0: GATE_Z + FORECOURT, z1: PLAZA_Z - 2,
      floor: 'floor:#9cc2ff,#86b1f7', rail: 'floor:#3d7be8,#3d7be8', post: 'floor:#23479a,#23479a',
      board: 'floor:#3d7be8,#2f68d0', neon: '#6fb8ff', title: 'SWORDS', fill: ['#ffffff', '#cfe6ff'],
    },
    train: {
      x0: ZONE_IN, x1: L - 1, z0: CROSS1 + 2, z1: PLAZA_Z - 2,
      floor: 'floor:#ffd494,#ffc477', rail: 'floor:#ff9f1c,#ff9f1c', post: 'floor:#a85a00,#a85a00',
      board: 'floor:#ff9f1c,#f08a0a', neon: '#ffd166', title: 'TRAIN', fill: ['#fff6a8', '#ffc21a'],
    },
    eggs: {
      x0: ZONE_IN, x1: L - 1, z0: GATE_Z + FORECOURT, z1: CROSS0 - 2,
      floor: 'floor:#ffc2e6,#ffadd9', rail: 'floor:#ff5fb8,#ff5fb8', post: 'floor:#a8286e,#a8286e',
      board: 'floor:#ff5fb8,#e64aa0', neon: '#ff8fd0', title: 'EGGS', fill: ['#ffffff', '#ffd6ee'],
    },
  }
  const ENTRANCE = 7
  const midZ = (zone) => (zone.z0 + zone.z1) / 2
  /** Plain opening onto the plaza or the cross path. */
  const SIDE_GAP = [17, 23]

  for (const [name, zone] of Object.entries(ZONES)) {
    const { x0, x1, z0, z1 } = zone
    box(x0, 0, z0, x1, 0.06, z1, zone.floor, false)

    // The arch faces the avenue; the side walls of the lobby need no fence.
    const west = name === 'swords'
    const inner = west ? x1 : x0
    const c = midZ(zone)
    fence('z', inner, z0, z1, [[c - ENTRANCE / 2 - 0.8, c + ENTRANCE / 2 + 0.8]], zone.rail, zone.post)
    archGate(inner, c, ENTRANCE, west ? 1 : -1, zone)

    const northGaps = west ? [[-23, -17]] : [SIDE_GAP]
    const southGaps = name === 'train' ? [SIDE_GAP] : []
    fence('x', z1, x0, x1, northGaps, zone.rail, zone.post)
    fence('x', z0, x0, x1, southGaps, zone.rail, zone.post)
  }

  // --- Sword zone ------------------------------------------------------------------
  // Two staggered rows along the west wall: the first ten on the ground, the bigger,
  // pricier ones on a ledge behind, half a step along so each sign shows through a
  // gap. A giant sword statue stands in the middle of the zone.
  const SWORD_Z = midZ(ZONES.swords)
  const SWORD_STEP = 3.9
  const FRONT_COUNT = 10
  const LEDGE_H = 1.2
  const rowHalf = ((FRONT_COUNT - 1) * SWORD_STEP) / 2
  const frontStart = SWORD_Z + rowHalf
  const swordPads = SWORDS.map((sword, i) => {
    const back = i >= FRONT_COUNT
    const slot = back ? i - FRONT_COUNT : i
    return {
      sword,
      position: back
        ? [-(L - 2.4), LEDGE_H, frontStart - SWORD_STEP / 2 - slot * SWORD_STEP]
        : [-(L - 6.8), 0, frontStart - slot * SWORD_STEP],
    }
  })
  // The ledge is one easy jump high.
  hill(-L, SWORD_Z - rowHalf - 2.5, -(L - 4.4), SWORD_Z + rowHalf + 2.5, LEDGE_H)

  // Between the zone's entrance and the front row of swords.
  const STATUE_X = -18.5
  box(STATUE_X - 2, 0, SWORD_Z - 2, STATUE_X + 2, 1.2, SWORD_Z + 2, 'portalStone')
  box(STATUE_X - 1.2, 1.2, SWORD_Z - 1.2, STATUE_X + 1.2, 1.8, SWORD_Z + 1.2, 'portalStone')
  const statue = { position: [STATUE_X, 1.8, SWORD_Z], swordId: 'diamond' }
  for (const [dx, dz] of [[-2.6, 1.8], [2.4, -2.2], [1.8, 2.6]]) {
    crystals.push({ position: [STATUE_X + dx, 0, SWORD_Z + dz], color: '#7fdcff', scale: 0.8 })
  }

  // --- Training zone ---------------------------------------------------------------
  // Two rows of four facing the avenue, the pricier row along the wall with its signs
  // raised. Pads are turned to face -X, which puts each dummy (DUMMY_OFFSET_Z in the
  // pad's own frame) on the wall side of its pad.
  const TRAIN_Z = midZ(ZONES.train)
  const TRAINER_STEP = 4
  const PER_ROW = 4
  const trainerPads = TRAINERS.map((trainer, i) => {
    const front = i < PER_ROW
    const slot = front ? i : i - PER_ROW
    return {
      trainer,
      position: [front ? L - 13.2 : L - 5.2, 0, TRAIN_Z + (front ? 4.5 : 6.5) - slot * TRAINER_STEP],
      rotationY: -Math.PI / 2,
      labelY: front ? 4.9 : 6.4,
    }
  })

  // --- Egg zone --------------------------------------------------------------------
  // Two rows of four, the pricier row on a ledge along the wall.
  const EGG_Z = midZ(ZONES.eggs)
  const EGG_STEP = 4.5
  const eggStands = EGGS.map((egg, i) => {
    const front = i < PER_ROW
    const slot = front ? i : i - PER_ROW
    const rowTop = EGG_Z + 6.75
    return {
      egg,
      position: front
        ? [L - 12, 0, rowTop - EGG_STEP / 2 - slot * EGG_STEP]
        : [L - 4, LEDGE_H, rowTop - slot * EGG_STEP],
    }
  })
  hill(L - 8, EGG_Z - 9, L, EGG_Z + 9, LEDGE_H)

  /**
   * Checkered billboard on two tall black posts, standing against a side wall.
   * `fx` is the x of its front face and `dir` the way it faces (+1 = +X, -1 = -X).
   */
  const sideBillboard = (fx, dir, cz, y0, w, h, material, text, fill) => {
    /** x-range from `a` to `b` units behind the front face. */
    const behind = (a, b) => {
      const p = fx - dir * a
      const q = fx - dir * b
      return [Math.min(p, q), Math.max(p, q)]
    }
    const [bx0, bx1] = behind(0, 0.3)
    const [fx0, fx1] = behind(0.3, 0.6)
    const [px0, px1] = behind(0.6, 1.1)
    for (const pz of [cz - w / 2 + 0.7, cz + w / 2 - 0.7]) {
      box(px0, 0, pz - 0.3, px1, y0 + h, pz + 0.3, 'dark')
    }
    box(fx0, y0 - 0.3, cz - w / 2 - 0.3, fx1, y0 + h + 0.3, cz + w / 2 + 0.3, 'dark')
    box(bx0, y0, cz - w / 2, bx1, y0 + h, cz + w / 2, material)
    labels.push({
      lines: [text],
      position: [fx + dir * 0.02, y0 + h / 2, cz],
      rotationY: (dir * Math.PI) / 2,
      size: [w * 0.9, h * 0.8],
      style: { fill },
    })
  }

  // Billboards against the side walls, raised clear of the signs in front of them.
  const WALL_FACE = L - 0.6
  // [offset from the zone centre, is the big middle board]
  for (const [dz, big] of [[12, false], [0, true], [-12, false]]) {
    sideBillboard(-WALL_FACE, 1, SWORD_Z + dz, big ? 9.2 : 8.4, big ? 11 : 9, big ? 4 : 3.5,
      ZONES.swords.board, 'SWORDS', ZONES.swords.fill)
  }
  for (const dz of [5, -5]) {
    sideBillboard(WALL_FACE, -1, TRAIN_Z + dz, 7.6, 8, 3.4, ZONES.train.board, 'TRAIN', ZONES.train.fill)
    sideBillboard(WALL_FACE, -1, EGG_Z + dz * 1.1, 8, 8, 3.4, ZONES.eggs.board, 'EGGS', ZONES.eggs.fill)
  }

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
  // The first of stage 1's ten walls. No Win pads out here: they're in the cabins.
  // Its "STAGE 1" sign is drawn live (see GateSign), so it can also show the
  // walls-rebuild countdown; not pushed onto the static `labels` list.
  addWall(1, GATE_Z)

  // --- Stage corridors --------------------------------------------------------------
  const CH = CORRIDOR_HALF
  for (let k = 1; k <= STAGE_COUNT; k++) {
    const theme = THEMES[k - 1]
    const z0 = stageStart(k)
    const z1 = z0 - STAGE_LEN
    // Doors in both side walls, halfway along the cabin, into its two small rooms.
    const vipZ = (cabinStart(k) + cabinEnd(k)) / 2
    const opening = [vipZ - VIP_DOOR, vipZ + VIP_DOOR]

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
      // Wall over the door into the side room, and a floor under it: the door is cut
      // through the whole thickness of the side wall, which would otherwise leave a
      // hole between the corridor floor and the room's.
      box(xa, 8, opening[0], xb, WALL_H, opening[1], `panel:${theme.side}`)
      box(xa, -1, opening[0], xb, 0, opening[1], `floor:${theme.floor.join(',')}`)
      box(xa - 0.2, WALL_H, z1, xb + 0.2, WALL_H + 0.6, z0, 'dark')

      // Terrain beyond the corridor walls, so it reads as a canyon from above.
      const [hx0, hx1] = side < 0 ? [-26, -14] : [14, 26]
      const hillTop = Math.min(z0, -(LOBBY_HALF + RING * 3))
      const ranges = [
        [z1, vipZ - 8],
        [vipZ + 8, hillTop],
      ]
      for (const [ra, rb] of ranges) {
        for (const [a, b] of segments(ra, rb)) {
          const h = pick([13, 14, 15, 16, 17])
          hill(hx0, a, hx1, b, h)
          if (rand() < 0.35) tree((hx0 + hx1) / 2 + (rand() - 0.5) * 4, h, (a + b) / 2, pick([1, 1.2]))
        }
      }

      crystals.push({ position: [side * (CH - 2), 0, cabinStart(k) - 3], color: theme.neon, scale: 0.9 })
    }

    // A ceiling over it all. The tunnel: the stage's first wall sits in the gate it's
    // entered through, and the other nine follow straight after, one every WALL_GAP.
    roofs.push({ x0: -CH, x1: CH, z0: z1, z1: z0, y: WALL_H - 0.01 })
    for (let j = 1; j < WALLS_PER_STAGE; j++) {
      const front = z0 - TUNNEL_LEAD - (j - 1) * WALL_GAP
      divider(front - 1)
      addWall((k - 1) * WALLS_PER_STAGE + 1 + j, front)
    }

    // Past the tenth wall: the cabin, with a small room either side.
    sideRooms(vipZ)

    if (k < STAGE_COUNT) {
      // The next stage's gate closes the far end of the cabin; in front of it, the
      // Win pads for cashing in this stage's walls.
      const gateFront = cabinEnd(k)
      divider(gateFront - 1)
      addWall(k * WALLS_PER_STAGE + 1, gateFront)
      addPads(k * WALLS_PER_STAGE + 1, gateFront)
      labels.push({
        lines: [`STAGE ${k + 1}`],
        position: [0, 11, gateFront + 0.12],
        size: [9, 1.6],
        style: { fill: ['#fff6a8', '#ffc21a'] },
      })
    }
  }

  // --- The end of the line ----------------------------------------------------------
  box(-CH - WALL_T, -1, END_Z - 2, CH + WALL_T, WALL_H, END_Z, 'dark')
  // One last pair of Win pads, for clearing every wall.
  addPads(STAGE_COUNT * WALLS_PER_STAGE + 1, END_Z)
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

  // Lands in the last stage's cabin.
  const lastStage = [0, 2, cabinStart(STAGE_COUNT) - 6]
  // At the north end of the central path, behind the spawn, facing the gate.
  arch(0, L - 3, 'z')
  // Only opens once you've broken your way into the last stage yourself.
  const lastStageWall = STAGE_COUNT * WALLS_PER_STAGE
  portals.push({ position: [0, 0, L - 3], rotationY: Math.PI, target: lastStage, requiresWall: lastStageWall })
  labels.push({
    lines: ['LAST STAGE'],
    position: [0, 8.2, L - 4.05],
    rotationY: Math.PI,
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

  // --- Welcome board at the north end, beside the portal ---------------------------
  // Posts sit behind the board so their faces don't fight with its front.
  box(10.4, 0, L - 2.4, 11.2, 9, L - 1.8, 'trunk')
  box(20.8, 0, L - 2.4, 21.6, 9, L - 1.8, 'trunk')
  box(10, 2.6, L - 3, 22, 8.6, L - 2.4, 'trunk')
  labels.push({
    lines: [
      { text: 'WELCOME!', scale: 1.5, fill: ['#fff6a8', '#ffc21a'] },
      'WASD run  -  Shift sprint  -  Space jump',
      `Break ${WALLS_PER_STAGE} walls with your sword to enter a stage`,
      'Hold E on a Win pad to cash in',
      { text: `Purple portal = last stage (after wall ${lastStageWall})`, fill: '#e2b8ff' },
    ],
    position: [16, 5.6, L - 3.04],
    rotationY: Math.PI,
    size: [11.4, 5.6],
    style: { bg: '#6b4424', border: '#4a2c14' },
  })

  return {
    blocks,
    walls,
    winPads,
    roofs,
    portals,
    pads,
    crowns,
    crystals,
    labels,
    swordPads,
    trainerPads,
    eggStands,
    statue,
  }
}
