import { create } from 'zustand'

/**
 * Player settings, pushed in from the Bloxity portal's pause menu.
 *
 * The portal owns the UI — we never draw a settings screen. We register the keys
 * we actually honour (see bloxity/portalSettings.js), which is also what un-greys
 * their controls in that menu, and apply whatever it sends. Registering a key we
 * then ignore would be worse than leaving its control greyed out, so this file
 * and that registration list have to stay in step.
 *
 * Every value the portal sends is a string ("80", "High", "true"), so parsing
 * happens at the edge and everything below is already typed.
 */

/**
 * What each graphics level actually changes. `dpr` is the render resolution range
 * handed to the Canvas (the biggest single lever on a weak GPU), `shadows` turns
 * the shadow map off entirely, and `sparkles` drops the decorative particle
 * systems that ride on top of glowing pets, eggs and pads.
 */
export const QUALITY = {
  Low: { dpr: [0.6, 1], shadows: false, sparkles: false },
  Medium: { dpr: [0.75, 1.25], shadows: true, sparkles: false },
  High: { dpr: [1, 1.75], shadows: true, sparkles: true },
  Ultra: { dpr: [1, 2], shadows: true, sparkles: true },
}

/** The level to fall back to for an unknown value from the portal. */
const DEFAULT_QUALITY = 'High'

export const useSettings = create(() => ({
  /** One of the QUALITY keys. */
  quality: DEFAULT_QUALITY,
  /** Whether to draw the FPS counter. */
  showFps: false,
  /** Multiplies the camera's right-drag speed; 1 is the game's own default. */
  cameraSensitivity: 1,
}))

/** The knobs for the current level, for components that render from it. */
export const qualityOf = (level) => QUALITY[level] ?? QUALITY[DEFAULT_QUALITY]

/** `'Low' | 'Medium' | 'High' | 'Ultra'`; anything else keeps the current level. */
export function setQuality(level) {
  if (!QUALITY[level]) return
  useSettings.setState({ quality: level })
}

export const setShowFps = (showFps) => useSettings.setState({ showFps: Boolean(showFps) })

/** Sanity bounds on the portal's multiplier, so one bad value can't freeze or spin the view. */
const MIN_SENSITIVITY = 0.1
const MAX_SENSITIVITY = 5

/**
 * The portal sends a plain multiplier on the game's own DRAG_SENSITIVITY, where 1
 * means "as the game tuned it".
 *
 * Not a percentage. The SDK's defaults table spells the difference out - it ships
 * `master_volume: "80"` on a 0-100 scale right next to `camera_sensitivity: "1"`.
 * This used to read it as 1-100 around a midpoint of 50, so the SDK's default of
 * "1" arrived as x0.02 and the camera crawled no matter what the game set. Values
 * are parsed as floats for the same reason: parseInt("0.5") is 0.
 */
export function setCameraSensitivity(multiplier) {
  const m = Number.isFinite(multiplier) ? multiplier : 1
  useSettings.setState({
    cameraSensitivity: Math.min(MAX_SENSITIVITY, Math.max(MIN_SENSITIVITY, m)),
  })
}
