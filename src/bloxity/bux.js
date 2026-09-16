import { create } from 'zustand'

import { getSDK, safeCall } from './sdk'

/**
 * Bux — Bloxity's cross-game currency (`Legion.SDK.bux`).
 *
 * The SDK owns the whole payment flow: `requestPurchase(sku)` looks the product up
 * on the server, draws its own confirm modal (the portal's, when embedded), takes
 * the Bux, and resolves with the result. We never see a price we could tamper with
 * and we never draw a checkout — all this module does is call it, keep a cached
 * balance for the HUD, and turn the SDK's shapes into plain values.
 *
 * Read outside React with `useBux.getState()`; `BuxCounter` subscribes for the HUD.
 */

/** The SDK caches nothing between reads, so a refresh is a round trip. Don't spam it. */
export const useBux = create(() => ({
  /** Cached Bux balance, or null before the first successful read. */
  balance: null,
  /** True while a purchase modal is up, so nothing can start a second one. */
  busy: false,
}))

/** Non-reactive snapshot, safe inside useFrame. */
export const getBux = () => useBux.getState()

/**
 * Re-reads the balance from the server. Returns it, or null if the read failed
 * (signed out, offline) - in which case the cached value is left alone rather than
 * blanked, so the HUD doesn't flicker to "—" on one dropped request.
 */
export async function refreshBalance() {
  const sdk = getSDK()
  const read = sdk?.bux?.getBalance
  if (typeof read !== 'function') return null
  try {
    const balance = await read.call(sdk.bux)
    if (typeof balance !== 'number') return null
    useBux.setState({ balance })
    return balance
  } catch (err) {
    console.warn('[bloxity] getBalance failed:', err)
    return null
  }
}

/**
 * Buys an IAP by SKU.
 *
 * The SKU has to exist and be active in this game's Bloxity admin panel — the
 * server prices it, and an unknown one comes back as a plain failure rather than
 * a throw. The SDK refuses a second concurrent purchase itself, but we guard too
 * so the game never leaves a half-finished hold-to-buy running behind the modal.
 *
 * @param {string} sku
 * @param {object} [metadata] passed through to the purchase webhook
 * @returns {Promise<{ success: boolean, transactionId?: string, error?: string }>}
 */
export async function purchase(sku, metadata) {
  const sdk = getSDK()
  const buy = sdk?.bux?.requestPurchase
  if (typeof buy !== 'function') {
    return { success: false, error: 'Bloxity SDK not ready' }
  }
  if (useBux.getState().busy) {
    return { success: false, error: 'Another purchase is already open' }
  }

  useBux.setState({ busy: true })
  try {
    const result = (await buy.call(sdk.bux, sku, metadata)) || { success: false, error: 'No response' }
    // The balance moved whether it succeeded or the player topped up and bailed.
    await refreshBalance()
    return result
  } catch (err) {
    console.warn('[bloxity] requestPurchase failed:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Purchase failed' }
  } finally {
    useBux.setState({ busy: false })
  }
}

/**
 * Opens the SDK's real-money top-up window for at least `amount` Bux. Used by the
 * "+" on the HUD's Bux chip; the purchase modal offers its own top-up when the
 * player is short, so this is only for topping up ahead of time.
 */
export async function topUp(amount = 1) {
  const sdk = getSDK()
  const top = sdk?.bux?.requestTopUp
  if (typeof top !== 'function') return { success: false, error: 'Bloxity SDK not ready' }
  if (useBux.getState().busy) return { success: false, error: 'Another purchase is already open' }

  useBux.setState({ busy: true })
  try {
    const result = (await top.call(sdk.bux, amount)) || { success: false }
    await refreshBalance()
    return result
  } catch (err) {
    console.warn('[bloxity] requestTopUp failed:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Top-up failed' }
  } finally {
    useBux.setState({ busy: false })
  }
}

/** Signed out: there is no balance to show. */
export const clearBalance = () => useBux.setState({ balance: null })

/**
 * True when the SDK can take a purchase at all — i.e. somebody is signed in.
 * A purchase started while signed out pops the login window instead and fails, so
 * callers check this first and ask the player to log in in their own words.
 */
export function isSignedIn() {
  const auth = getSDK()?.auth
  return Boolean(safeCall(auth?.isLoggedIn?.bind(auth)))
}

/** Opens the Bloxity login window. */
export function showLogin() {
  const auth = getSDK()?.auth
  safeCall(auth?.showAuthPopup?.bind(auth))
}
