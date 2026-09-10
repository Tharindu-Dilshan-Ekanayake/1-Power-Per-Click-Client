import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

/**
 * Procedural canvas textures. Everything is drawn at runtime, so the map ships with
 * no image assets, and each texture is generated once and shared.
 */

/** One stud, in world units. Studded textures are authored against this pitch. */
export const STUD = 0.35

/** World size of one repeat of the panel texture. */
export const PANEL_TILE = 4

const FONT = '"Arial Black", "Segoe UI Black", Impact, sans-serif'

const textureCache = new Map()

function cached(key, make) {
  let texture = textureCache.get(key)
  if (!texture) {
    texture = make()
    textureCache.set(key, texture)
  }
  return texture
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return [canvas, canvas.getContext('2d')]
}

function finish(canvas, { repeat = true } = {}) {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  if (repeat) texture.wrapS = texture.wrapT = RepeatWrapping
  return texture
}

/** Small deterministic PRNG, so the map and its textures look the same every load. */
export function mulberry32(seed) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Lighten (amount > 0) or darken (amount < 0) a hex colour; returns a CSS colour. */
export function shade(hex, amount) {
  const f = (c) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

function disc(ctx, x, y, r, fill) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

// --- Studded plates -------------------------------------------------------------

/**
 * Brick-toy studs on a plate. With two colours the cells alternate as a checker.
 * One repeat covers `cells * studsPerCell * STUD` world units.
 */
export function studTexture(colors, { cells = 2, studsPerCell = 4 } = {}) {
  return cached(`stud:${colors.join()}:${cells}:${studsPerCell}`, () => {
    const px = 512
    const [canvas, ctx] = makeCanvas(px, px)
    const cell = px / cells
    const pitch = cell / studsPerCell
    const bevel = Math.max(2, px / 170)

    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        const base = colors[(cx + cy) % colors.length]
        const x0 = cx * cell
        const y0 = cy * cell
        ctx.fillStyle = base
        ctx.fillRect(x0, y0, cell, cell)
        // Plate bevel: lit top-left, shaded bottom-right.
        ctx.fillStyle = shade(base, 0.1)
        ctx.fillRect(x0, y0, cell, bevel)
        ctx.fillRect(x0, y0, bevel, cell)
        ctx.fillStyle = shade(base, -0.14)
        ctx.fillRect(x0, y0 + cell - bevel, cell, bevel)
        ctx.fillRect(x0 + cell - bevel, y0, bevel, cell)

        for (let sy = 0; sy < studsPerCell; sy++) {
          for (let sx = 0; sx < studsPerCell; sx++) {
            const x = x0 + (sx + 0.5) * pitch
            const y = y0 + (sy + 0.5) * pitch
            const r = pitch * 0.3
            disc(ctx, x + pitch * 0.05, y + pitch * 0.08, r * 1.05, 'rgba(0,0,0,0.28)')
            disc(ctx, x, y, r, shade(base, 0.05))
            ctx.lineWidth = pitch * 0.07
            ctx.strokeStyle = 'rgba(255,255,255,0.45)'
            ctx.beginPath()
            ctx.arc(x, y, r * 0.78, Math.PI, Math.PI * 1.55)
            ctx.stroke()
            ctx.strokeStyle = 'rgba(0,0,0,0.18)'
            ctx.beginPath()
            ctx.arc(x, y, r * 0.85, Math.PI * 0.05, Math.PI * 0.6)
            ctx.stroke()
          }
        }
      }
    }
    return finish(canvas)
  })
}

/**
 * Light-grey panelled wall with recessed windows. Drawn neutral so a material
 * colour can tint it per stage.
 */
export function panelTexture() {
  return cached('panel', () => {
    const px = 512
    const [canvas, ctx] = makeCanvas(px, px)
    const cells = 2
    const cell = px / cells
    ctx.fillStyle = '#d6d6d6'
    ctx.fillRect(0, 0, px, px)
    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        const x0 = cx * cell
        const y0 = cy * cell
        ctx.fillStyle = '#e8e8e8'
        ctx.fillRect(x0, y0, cell, 6)
        ctx.fillRect(x0, y0, 6, cell)
        ctx.fillStyle = '#a8a8a8'
        ctx.fillRect(x0, y0 + cell - 6, cell, 6)
        ctx.fillRect(x0 + cell - 6, y0, 6, cell)

        const m = cell * 0.18
        ctx.fillStyle = '#7c7c7c'
        ctx.fillRect(x0 + m, y0 + m, cell - 2 * m, cell - 2 * m)
        ctx.fillStyle = '#5e5e5e'
        ctx.fillRect(x0 + m, y0 + m, cell - 2 * m, 8)
        ctx.fillRect(x0 + m, y0 + m, 8, cell - 2 * m)

        for (const [sx, sy] of [[0.09, 0.09], [0.91, 0.09], [0.09, 0.91], [0.91, 0.91]]) {
          disc(ctx, x0 + sx * cell + 2, y0 + sy * cell + 3, 9, 'rgba(0,0,0,0.25)')
          disc(ctx, x0 + sx * cell, y0 + sy * cell, 9, '#e2e2e2')
        }
      }
    }
    return finish(canvas)
  })
}

// --- Stage wall surfaces --------------------------------------------------------

/** Voronoi rock: cobbles, ice, crystal and lava are all this with different palettes. */
function voronoi(ctx, w, h, { palette, gap, gapWidth = 3, bevel = 0.4, cols = 10, rows = 6, seed }) {
  const rand = mulberry32(seed)
  const cw = w / cols
  const ch = h / rows
  const gw = cols + 2
  const size = Math.min(cw, ch)

  // One jittered site per grid cell, with a one-cell border so edge pixels always
  // have a full 3x3 neighbourhood to search.
  const sites = []
  for (let j = -1; j <= rows; j++) {
    for (let i = -1; i <= cols; i++) {
      sites.push({
        x: (i + 0.2 + rand() * 0.6) * cw,
        y: (j + 0.2 + rand() * 0.6) * ch,
        c: hexToRgb(palette[Math.floor(rand() * palette.length)]),
      })
    }
  }

  const gapRgb = hexToRgb(gap)
  const img = ctx.createImageData(w, h)
  const data = img.data

  for (let y = 0; y < h; y++) {
    const gj = Math.floor(y / ch) + 1
    for (let x = 0; x < w; x++) {
      const gi = Math.floor(x / cw) + 1
      let d1 = Infinity
      let d2 = Infinity
      let best = null
      for (let dj = -1; dj <= 1; dj++) {
        const row = (gj + dj) * gw
        for (let di = -1; di <= 1; di++) {
          const s = sites[row + gi + di]
          const d = (x - s.x) ** 2 + (y - s.y) ** 2
          if (d < d1) {
            d2 = d1
            d1 = d
            best = s
          } else if (d < d2) {
            d2 = d
          }
        }
      }

      const edge = (Math.sqrt(d2) - Math.sqrt(d1)) / 2
      const o = (y * w + x) * 4
      if (edge < gapWidth) {
        const k = 0.8 + 0.2 * (edge / gapWidth)
        data[o] = gapRgb[0] * k
        data[o + 1] = gapRgb[1] * k
        data[o + 2] = gapRgb[2] * k
      } else {
        const t = Math.min(1, (edge - gapWidth) / (size * 0.3))
        // Domed stones, lit from the top-left.
        const dir = (best.x - x + (best.y - y)) / size
        const light = (1 - bevel + bevel * t + dir * 0.12) * (0.96 + rand() * 0.08)
        data[o] = best.c[0] * light
        data[o + 1] = best.c[1] * light
        data[o + 2] = best.c[2] * light
      }
      data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function bricks(ctx, w, h, { palette, gap, seed, rows = 8, cols = 5 }) {
  const rand = mulberry32(seed)
  ctx.fillStyle = gap
  ctx.fillRect(0, 0, w, h)
  const rh = h / rows
  const bw = w / cols
  const m = 3
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 ? bw / 2 : 0
    for (let c = -1; c <= cols; c++) {
      const x = c * bw + offset + m
      const y = r * rh + m
      const width = bw - 2 * m
      const height = rh - 2 * m
      const color = palette[Math.floor(rand() * palette.length)]
      ctx.fillStyle = color
      ctx.fillRect(x, y, width, height)
      ctx.fillStyle = shade(color, 0.2)
      ctx.fillRect(x, y, width, 4)
      ctx.fillStyle = shade(color, -0.22)
      ctx.fillRect(x, y + height - 4, width, 4)
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = shade(color, rand() < 0.5 ? -0.1 : 0.08)
        ctx.fillRect(x + rand() * (width - 6), y + 4 + rand() * (height - 12), 5, 3)
      }
    }
  }
}

function planks(ctx, w, h, { palette, gap, seed, rows = 7 }) {
  const rand = mulberry32(seed)
  const rh = h / rows
  for (let r = 0; r < rows; r++) {
    const color = palette[Math.floor(rand() * palette.length)]
    const y0 = r * rh
    ctx.fillStyle = color
    ctx.fillRect(0, y0, w, rh)

    ctx.strokeStyle = shade(color, -0.15)
    ctx.lineWidth = 1.5
    for (let i = 0; i < 5; i++) {
      const gy = y0 + 5 + rand() * (rh - 10)
      const phase = rand() * 10
      ctx.beginPath()
      ctx.moveTo(0, gy)
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, gy + Math.sin(x * 0.02 + phase) * 2)
      ctx.stroke()
    }

    let x = rand() * w * 0.4
    while (x < w) {
      ctx.fillStyle = gap
      ctx.fillRect(x, y0, 3, rh)
      disc(ctx, x + 9, y0 + 8, 2.5, '#3a2a1a')
      disc(ctx, x + 9, y0 + rh - 8, 2.5, '#3a2a1a')
      x += w * 0.35 + rand() * w * 0.4
    }

    ctx.fillStyle = gap
    ctx.fillRect(0, y0, w, 3)
    ctx.fillStyle = shade(color, 0.18)
    ctx.fillRect(0, y0 + 3, w, 2)
  }
}

function moss(ctx, w, h, seed) {
  const rand = mulberry32(seed + 99)
  for (let i = 0; i < 16; i++) {
    const cx = rand() * w
    // Vines gather along the top edge, with the odd patch lower down.
    const cy = rand() < 0.6 ? rand() * h * 0.18 : rand() * h
    const n = 6 + rand() * 10
    for (let k = 0; k < n; k++) {
      disc(
        ctx,
        cx + (rand() - 0.5) * 44,
        cy + (rand() - 0.2) * 26,
        3 + rand() * 7,
        rand() < 0.5 ? '#5aa83a' : '#478f2e',
      )
    }
  }
}

/** The breakable-looking surface for stage wall `id`, drawn from its theme. */
export function wallTexture(id, def) {
  return cached(`wall:${id}`, () => {
    const w = 512
    const h = 320
    const [canvas, ctx] = makeCanvas(w, h)
    const seed = id * 7919
    if (def.style === 'bricks') bricks(ctx, w, h, { ...def, seed })
    else if (def.style === 'planks') planks(ctx, w, h, { ...def, seed })
    else if (def.style === 'lava') voronoi(ctx, w, h, { ...def, seed, cols: 9, gapWidth: 5, bevel: 0.45 })
    else if (def.style === 'crystal') voronoi(ctx, w, h, { ...def, seed, gapWidth: 2.5, bevel: 0.6 })
    else voronoi(ctx, w, h, { ...def, seed })
    if (def.moss) moss(ctx, w, h, seed)
    return finish(canvas, { repeat: false })
  })
}

const formatNumber = (n) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : String(n)

/** Big wall number plus a full green health bar, laid over the wall surface. */
export function wallOverlayTexture(number, hp) {
  return cached(`overlay:${number}:${hp}`, () => {
    const w = 512
    const h = 320
    const [canvas, ctx] = makeCanvas(w, h)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'

    ctx.font = `900 110px ${FONT}`
    ctx.lineWidth = 16
    ctx.strokeStyle = 'rgba(20,20,30,0.9)'
    ctx.strokeText(String(number), w / 2, h * 0.3)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(String(number), w / 2, h * 0.3)

    const bw = w * 0.64
    const bh = 42
    const bx = (w - bw) / 2
    const by = h * 0.6
    ctx.fillStyle = '#16240d'
    ctx.beginPath()
    ctx.roundRect(bx, by, bw, bh, bh / 2)
    ctx.fill()
    const grad = ctx.createLinearGradient(0, by, 0, by + bh)
    grad.addColorStop(0, '#b4ff6e')
    grad.addColorStop(1, '#35c21d')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.roundRect(bx + 5, by + 5, bw - 10, bh - 10, (bh - 10) / 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.roundRect(bx + 14, by + 8, bw - 28, 7, 3.5)
    ctx.fill()

    const label = `${formatNumber(hp)} / ${formatNumber(hp)}`
    ctx.font = `900 30px ${FONT}`
    ctx.lineWidth = 8
    ctx.strokeStyle = '#16240d'
    ctx.strokeText(label, w / 2, by + bh / 2 + 1)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, w / 2, by + bh / 2 + 1)
    return finish(canvas, { repeat: false })
  })
}

// --- Effects --------------------------------------------------------------------

/**
 * Blurred neon rectangle for the glow around a stage-wall frame. The canvas is
 * 32px per world unit: a `frameW x frameH` rectangle with `margin` of halo around it.
 */
export function glowFrameTexture(color, frameW, frameH, margin) {
  return cached(`glowframe:${color}:${frameW}:${frameH}:${margin}`, () => {
    const s = 32
    const w = Math.round((frameW + margin * 2) * s)
    const h = Math.round((frameH + margin * 2) * s)
    const [canvas, ctx] = makeCanvas(w, h)
    const m = margin * s
    ctx.shadowColor = color
    ctx.strokeStyle = color
    for (const [blur, width] of [[64, 26], [40, 18], [20, 12]]) {
      ctx.shadowBlur = blur
      ctx.lineWidth = width
      ctx.strokeRect(m, m, w - 2 * m, h - 2 * m)
    }
    ctx.shadowBlur = 10
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 6
    ctx.strokeRect(m, m, w - 2 * m, h - 2 * m)
    return finish(canvas, { repeat: false })
  })
}

/** Spiral for the portal disc. */
export function swirlTexture() {
  return cached('swirl', () => {
    const s = 256
    const [canvas, ctx] = makeCanvas(s, s)
    const img = ctx.createImageData(s, s)
    const data = img.data
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const dx = ((x + 0.5) / s) * 2 - 1
        const dy = ((y + 0.5) / s) * 2 - 1
        const r = Math.hypot(dx, dy)
        const a = Math.atan2(dy, dx)
        const arm = 0.5 + 0.5 * Math.sin(a * 4 + r * 14)
        const core = Math.max(0, 1 - r * 2.4)
        const o = (y * s + x) * 4
        data[o] = 90 + arm * 150 + core * 200
        data[o + 1] = 20 + arm * 90 + core * 200
        data[o + 2] = 200 + arm * 55
        data[o + 3] = Math.max(0, Math.min(1, (1 - r) * 8)) * 255
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(canvas, { repeat: false })
  })
}

/** Soft white radial falloff; tint it with the material colour. */
export function radialGlowTexture() {
  return cached('radial', () => {
    const s = 128
    const [canvas, ctx] = makeCanvas(s, s)
    const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, s, s)
    return finish(canvas, { repeat: false })
  })
}

/** Vertical fade for light beams: opaque at the bottom, clear at the top. */
export function beamTexture() {
  return cached('beam', () => {
    const [canvas, ctx] = makeCanvas(4, 128)
    const grad = ctx.createLinearGradient(0, 0, 0, 128)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(1, 'rgba(255,255,255,0.9)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 4, 128)
    return finish(canvas, { repeat: false })
  })
}

/** Sky dome gradient, zenith at the top of the canvas. */
export function skyTexture() {
  return cached('sky', () => {
    const [canvas, ctx] = makeCanvas(4, 256)
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, '#2a74e0')
    grad.addColorStop(0.3, '#5aa6f2')
    grad.addColorStop(0.49, '#bfe4ff')
    grad.addColorStop(1, '#e6f5ff')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 4, 256)
    return finish(canvas, { repeat: false })
  })
}

/**
 * Text sign. `lines` are strings or `{ text, scale, fill }`; `fill` may be a list of
 * colours for a vertical gradient.
 */
export function labelTexture({ lines, aspect, fill = '#ffffff', stroke = '#1b1b25', bg = null, border = null }) {
  const key = `label:${JSON.stringify([lines, aspect, fill, stroke, bg, border])}`
  return cached(key, () => {
    const w = 1024
    const h = Math.max(64, Math.round(w / aspect))
    const [canvas, ctx] = makeCanvas(w, h)
    const short = Math.min(w, h)
    const pad = short * 0.1

    if (bg) {
      ctx.fillStyle = bg
      ctx.beginPath()
      ctx.roundRect(0, 0, w, h, short * 0.12)
      ctx.fill()
    }
    if (border) {
      const lw = short * 0.05
      ctx.lineWidth = lw
      ctx.strokeStyle = border
      ctx.beginPath()
      ctx.roundRect(lw / 2, lw / 2, w - lw, h - lw, short * 0.1)
      ctx.stroke()
    }

    const items = lines.map((line) => (typeof line === 'string' ? { text: line } : line))
    const totalWeight = items.reduce((sum, item) => sum + (item.scale ?? 1), 0)
    const unit = (h - pad * 2) / totalWeight
    let y = pad
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    for (const item of items) {
      const lineH = unit * (item.scale ?? 1)
      let size = lineH * 0.78
      ctx.font = `900 ${size}px ${FONT}`
      const measured = ctx.measureText(item.text).width
      const maxW = w - pad * 2
      if (measured > maxW) {
        size *= maxW / measured
        ctx.font = `900 ${size}px ${FONT}`
      }
      const cy = y + lineH / 2
      if (stroke) {
        ctx.lineWidth = size * 0.2
        ctx.strokeStyle = stroke
        ctx.strokeText(item.text, w / 2, cy)
      }
      const color = item.fill ?? fill
      if (Array.isArray(color)) {
        const grad = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2)
        color.forEach((c, i) => grad.addColorStop(i / (color.length - 1), c))
        ctx.fillStyle = grad
      } else {
        ctx.fillStyle = color
      }
      ctx.fillText(item.text, w / 2, cy)
      y += lineH
    }
    return finish(canvas, { repeat: false })
  })
}
