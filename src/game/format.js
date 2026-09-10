/** Short number format for the HUD and signs: 950, 1.2K, 3.4M, 5.6B. */
export function formatNumber(n) {
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`
  return String(Math.floor(n))
}
