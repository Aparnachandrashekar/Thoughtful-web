/** PostHog + console logging for Google OAuth lifecycle (client-only). */

export type GoogleAuthEvent =
  | 'identity_sign_in_started'
  | 'identity_sign_in_success'
  | 'identity_sign_in_failed'
  | 'calendar_connect_started'
  | 'calendar_connect_success'
  | 'calendar_connect_failed'
  | 'calendar_scope_upgrade_failed'
  | 'calendar_silent_refresh_started'
  | 'calendar_silent_refresh_success'
  | 'calendar_silent_refresh_failed'
  | 'calendar_token_cleared'
  | 'calendar_reconnect_prompt_shown'
  | 'identity_sign_out'
  | 'google_access_revoked'
  | 'auth_migration_applied'

export function logGoogleAuthEvent(
  event: GoogleAuthEvent,
  properties?: Record<string, string | number | boolean | null>
) {
  if (typeof window === 'undefined') return
  const payload = { ...properties, ts: Date.now() }
  try {
    const ph = (window as { posthog?: { capture?: (e: string, p?: object) => void } }).posthog
    ph?.capture?.(event, payload)
  } catch {
    // PostHog optional
  }
  if (process.env.NODE_ENV !== 'production') {
    console.info('[google-auth]', event, payload)
  }
}
