/**
 * CSRF protection for GIS Token Client (popup) OAuth flows.
 * State is stored in sessionStorage (per browser tab) with a short TTL.
 */

export type OAuthFlowKind = 'identity' | 'calendar' | 'calendar_silent'

export type OAuthStateValidationResult =
  | 'valid'
  | 'missing'
  | 'mismatch'
  | 'expired'
  | 'no_pending'

const STATE_TTL_MS = 10 * 60 * 1000
const STORAGE_PREFIX = 'thoughtful-oauth-pending-'

interface PendingOAuthState {
  value: string
  createdAt: number
  flow: OAuthFlowKind
}

function storageKey(flow: OAuthFlowKind): string {
  return `${STORAGE_PREFIX}${flow}`
}

function generateSecureRandom(bytes: number): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(bytes)
    crypto.getRandomValues(arr)
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 15)}`
}

/** Create a cryptographically random state and persist it for this tab + flow. */
export function createOAuthState(flow: OAuthFlowKind): string {
  const value = generateSecureRandom(32)
  const pending: PendingOAuthState = { value, createdAt: Date.now(), flow }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(storageKey(flow), JSON.stringify(pending))
  }
  return value
}

export function clearOAuthState(flow: OAuthFlowKind): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(storageKey(flow))
}

export function clearAllOAuthState(): void {
  const flows: OAuthFlowKind[] = ['identity', 'calendar', 'calendar_silent']
  flows.forEach(clearOAuthState)
}

/** Remove expired pending states (e.g. interrupted auth, reload). */
export function pruneExpiredOAuthState(): void {
  if (typeof sessionStorage === 'undefined') return
  const flows: OAuthFlowKind[] = ['identity', 'calendar', 'calendar_silent']
  const now = Date.now()
  for (const flow of flows) {
    const raw = sessionStorage.getItem(storageKey(flow))
    if (!raw) continue
    try {
      const pending = JSON.parse(raw) as PendingOAuthState
      if (now - pending.createdAt > STATE_TTL_MS) clearOAuthState(flow)
    } catch {
      clearOAuthState(flow)
    }
  }
}

/**
 * Validate echoed state, then clear pending storage immediately (one-time use).
 */
export function validateOAuthState(
  flow: OAuthFlowKind,
  returnedState: string | undefined
): OAuthStateValidationResult {
  if (!returnedState || returnedState.length === 0) {
    return 'missing'
  }

  if (typeof sessionStorage === 'undefined') {
    return 'no_pending'
  }

  const raw = sessionStorage.getItem(storageKey(flow))
  if (!raw) return 'no_pending'

  let pending: PendingOAuthState
  try {
    pending = JSON.parse(raw) as PendingOAuthState
  } catch {
    clearOAuthState(flow)
    return 'no_pending'
  }

  if (Date.now() - pending.createdAt > STATE_TTL_MS) {
    clearOAuthState(flow)
    return 'expired'
  }

  if (pending.value !== returnedState) {
    clearOAuthState(flow)
    return 'mismatch'
  }

  clearOAuthState(flow)
  return 'valid'
}

export function isOAuthStateFailure(
  result: OAuthStateValidationResult
): result is Exclude<OAuthStateValidationResult, 'valid'> {
  return result !== 'valid'
}
