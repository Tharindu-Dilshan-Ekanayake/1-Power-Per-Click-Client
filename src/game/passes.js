/**
 * Things bought with Bux rather than Wins.
 *
 * A pass is bought once and kept forever, the way a Roblox game pass works — it is
 * not spent, it just flips something on. Wins buy swords, eggs, trainers and
 * boosts; Bux buy these.
 *
 * ── Each `sku` has to exist and be ACTIVE in this game's Bloxity admin panel ──
 * The server is what prices a SKU; the client never sends a price. An unknown or
 * inactive SKU comes back from `requestPurchase` as
 *   `Product "<sku>" not found for game "<slug>"`
 * which the game surfaces as an error toast, so a missing catalog entry shows up
 * immediately rather than silently granting nothing.
 *
 * `bux` below is only what the signs and the HUD *display*. Keep it matching the
 * admin panel; if the two ever disagree, the admin panel wins and the player is
 * charged that.
 */
export const PASSES = [
  {
    id: 'vipWins',
    /** Must match the IAP's SKU in the Bloxity admin panel. */
    sku: 'vip_wins_pad',
    name: 'VIP Wins Pad',
    /** Display price only — the server charges whatever the admin panel says. */
    bux: 99,
    blurb: 'Unlocks the blue VIP pad at every stage. Double Wins, no Power needed.',
    color: '#2fd4ff',
  },
]

export const getPass = (id) => PASSES.find((p) => p.id === id)
