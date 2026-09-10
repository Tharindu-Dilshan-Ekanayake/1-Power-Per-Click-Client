/**
 * Eggs shown in the lobby's egg zone. Display only for now: hatching pets isn't
 * built yet.
 *
 * cost:   Wins to hatch one (once hatching exists)
 * colors: [base, accent] for the voxel egg
 * glow:   emissive strength
 */
export const EGGS = [
  { id: 'common', name: 'Common Egg', cost: 50, colors: ['#f4f4f4', '#cfd8e3'] },
  { id: 'spotted', name: 'Spotted Egg', cost: 1000, colors: ['#ffd23f', '#2b2b33'] },
  { id: 'jungle', name: 'Jungle Egg', cost: 12000, colors: ['#46d160', '#1f7a36'] },
  { id: 'frost', name: 'Frost Egg', cost: 50000, colors: ['#bff4ff', '#4fb6e8'], glow: 0.3 },
  { id: 'magma', name: 'Magma Egg', cost: 200000, colors: ['#ff6a1f', '#7a1a08'], glow: 0.5 },
  { id: 'crystal', name: 'Crystal Egg', cost: 600000, colors: ['#b47cff', '#5a2aa8'], glow: 0.5 },
  { id: 'galaxy', name: 'Galaxy Egg', cost: 2500000, colors: ['#3b2a8a', '#ff7af5'], glow: 0.7 },
  { id: 'rainbow', name: 'Rainbow Egg', cost: 10000000, colors: ['#ff4fd8', '#7ff9ff'], glow: 0.8 },
]
