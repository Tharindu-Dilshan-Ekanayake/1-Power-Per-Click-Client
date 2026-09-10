/**
 * Every sword in the game.
 *
 * cost:  Wins needed to buy it (Wins come from breaking stage walls)
 * power: Power gained per click while it's equipped
 * size:  model scale; later swords are bigger
 * glow:  emissive strength of the blade
 */
export const SWORDS = [
  { id: 'wood', name: 'Wooden Sword', cost: 0, power: 1, blade: '#b07540', guard: '#7b4b27', edge: '#c98d57', size: 1 },
  { id: 'stone', name: 'Stone Sword', cost: 5, power: 2, blade: '#9aa0a8', guard: '#6b6f77', edge: '#c3c8cf', size: 1.05 },
  { id: 'iron', name: 'Iron Sword', cost: 25, power: 5, blade: '#dfe4ec', guard: '#8a6a3a', edge: '#ffffff', size: 1.1 },
  { id: 'gold', name: 'Gold Sword', cost: 100, power: 12, blade: '#ffd23f', guard: '#b07a12', edge: '#fff3b0', size: 1.15, glow: 0.2 },
  { id: 'emerald', name: 'Emerald Sword', cost: 300, power: 30, blade: '#2fe07a', guard: '#ffd23f', edge: '#b8ffd6', size: 1.2, glow: 0.4 },
  { id: 'ruby', name: 'Ruby Sword', cost: 800, power: 75, blade: '#ff2e5b', guard: '#ffd23f', edge: '#ffc2d0', size: 1.25, glow: 0.5 },
  { id: 'obsidian', name: 'Obsidian Blade', cost: 2000, power: 180, blade: '#3b2266', guard: '#c07bff', edge: '#d9a6ff', size: 1.3, glow: 0.7 },
  { id: 'diamond', name: 'Diamond Blade', cost: 5000, power: 450, blade: '#8ff6ff', guard: '#ffffff', edge: '#ffffff', size: 1.4, glow: 0.8 },
  { id: 'sapphire', name: 'Sapphire Sword', cost: 12000, power: 1100, blade: '#2f6bff', guard: '#ffd23f', edge: '#a8c4ff', size: 1.45, glow: 0.5 },
  { id: 'frost', name: 'Frost Blade', cost: 28000, power: 2600, blade: '#bff4ff', guard: '#5aa7d6', edge: '#ffffff', size: 1.5, glow: 0.6 },
  { id: 'magma', name: 'Magma Blade', cost: 65000, power: 6000, blade: '#ff6a1f', guard: '#3a1a10', edge: '#ffd166', size: 1.55, glow: 0.8 },
  { id: 'toxic', name: 'Toxic Blade', cost: 150000, power: 14000, blade: '#8dff3a', guard: '#2a2238', edge: '#e4ffb0', size: 1.6, glow: 0.7 },
  { id: 'storm', name: 'Storm Blade', cost: 350000, power: 33000, blade: '#ffe94a', guard: '#3a4a8a', edge: '#ffffff', size: 1.65, glow: 0.8 },
  { id: 'shadow', name: 'Shadow Blade', cost: 800000, power: 78000, blade: '#1b1630', guard: '#8a5ac8', edge: '#b65cff', size: 1.7, glow: 0.9 },
  { id: 'crystal', name: 'Crystal Blade', cost: 1800000, power: 180000, blade: '#e0b3ff', guard: '#ffffff', edge: '#ffffff', size: 1.75, glow: 0.7 },
  { id: 'solar', name: 'Solar Blade', cost: 4000000, power: 420000, blade: '#ffb12e', guard: '#fff3b0', edge: '#fff6d0', size: 1.8, glow: 1 },
  { id: 'void', name: 'Void Blade', cost: 9000000, power: 1000000, blade: '#6a1fff', guard: '#14101f', edge: '#d9a6ff', size: 1.85, glow: 1 },
  { id: 'galaxy', name: 'Galaxy Blade', cost: 20000000, power: 2400000, blade: '#4b3cff', guard: '#ff7af5', edge: '#ff7af5', size: 1.9, glow: 1 },
  { id: 'prism', name: 'Prism Blade', cost: 45000000, power: 5500000, blade: '#ff4fd8', guard: '#7ff9ff', edge: '#7ff9ff', size: 1.95, glow: 1 },
]

export const DEFAULT_SWORD = SWORDS[0].id

/** Looks a sword up by id, falling back to the starter (e.g. for an old save). */
export const getSword = (id) => SWORDS.find((s) => s.id === id) ?? SWORDS[0]
