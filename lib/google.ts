// Google Identity Services (GIS) — incremental authorization.
// Identity: openid + email + profile (sign-in only).
// Calendar: https://www.googleapis.com/auth/calendar (explicit user action only).

import { logGoogleAuthEvent } from '@/lib/googleAuthAnalytics'
import {
  type OAuthFlowKind,
  createOAuthState,
  validateOAuthState,
  isOAuthStateFailure,
  clearOAuthState,
  clearAllOAuthState,
  pruneExpiredOAuthState,
} from '@/lib/googleOAuthState'

export const IDENTITY_SCOPES = 'openid email profile'
export const CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar'

/** @deprecated Use IDENTITY_SCOPES / CALENDAR_SCOPES. Kept for tests referencing legacy bundle. */
export const LEGACY_SCOPES =
  'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email'

const SCOPE_VERSION = 'gis-v4-incremental'
const LEGACY_SCOPE_VERSIONS = new Set(['gis-v1', 'gis-v2', 'gis-v3'])
const SCOPE_VERSION_KEY = 'thoughtful-scope-version'
const CALENDAR_GRANTED_KEY = 'thoughtful-calendar-granted'

const TOKEN_KEY = 'thoughtful-google-token'
const TOKEN_EXPIRY_KEY = 'thoughtful-google-token-expiry'
const USER_EMAIL_KEY = 'thoughtful-google-email'
const THOUGHTFUL_CALENDAR_KEY = 'thoughtful-gcal-calendar-id'

const SILENT_REFRESH_COOLDOWN_MS = 2 * 60 * 1000
const SILENT_REFRESH_MIN_INTERVAL_MS = 30 * 1000

export let accessToken: string | null = null
export let userEmail: string | null = null

let thoughtfulCalendarId: string | null = null
let gisClientId: string | null = null
let silentRefreshInProgress: Promise<boolean> | null = null
let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null
let lastSilentRefreshAttempt = 0
let lastSilentRefreshFailure = 0
let calendarConnectInProgress = false

// ─── Migration (preserve existing production sessions) ─────────────────────

function migrateAuthStorage(): void {
  const storedVersion = localStorage.getItem(SCOPE_VERSION_KEY)
  if (storedVersion === SCOPE_VERSION) return

  const hasEmail = !!localStorage.getItem(USER_EMAIL_KEY)
  const hasToken = !!localStorage.getItem(TOKEN_KEY)
  const hasExpiry = !!localStorage.getItem(TOKEN_EXPIRY_KEY)
  const isLegacyVersion =
    !storedVersion || LEGACY_SCOPE_VERSIONS.has(storedVersion)

  if (hasEmail && hasToken && hasExpiry && isLegacyVersion) {
    localStorage.setItem(CALENDAR_GRANTED_KEY, 'true')
    localStorage.setItem(SCOPE_VERSION_KEY, SCOPE_VERSION)
    logGoogleAuthEvent('auth_migration_applied', {
      from_version: storedVersion || 'unknown',
      preserved_calendar_token: true,
    })
    return
  }

  if (storedVersion && storedVersion !== SCOPE_VERSION && !hasEmail) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
    localStorage.removeItem(THOUGHTFUL_CALENDAR_KEY)
    localStorage.removeItem(CALENDAR_GRANTED_KEY)
  }

  if (hasEmail && hasToken && hasExpiry && !localStorage.getItem(CALENDAR_GRANTED_KEY)) {
    localStorage.setItem(CALENDAR_GRANTED_KEY, 'true')
  }

  localStorage.setItem(SCOPE_VERSION_KEY, SCOPE_VERSION)
  logGoogleAuthEvent('auth_migration_applied', {
    from_version: storedVersion || 'none',
    preserved_calendar_token: !!(hasToken && hasEmail),
  })
}

export function hasCalendarGrant(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(CALENDAR_GRANTED_KEY) === 'true'
}

function markCalendarGranted(): void {
  localStorage.setItem(CALENDAR_GRANTED_KEY, 'true')
}

function storeAccessToken(token: string): number {
  accessToken = token
  const expiryTime = Date.now() + 55 * 60 * 1000
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())
  localStorage.setItem(SCOPE_VERSION_KEY, SCOPE_VERSION)
  return expiryTime
}

function restoreTokenFromStorage(): boolean {
  const savedToken = localStorage.getItem(TOKEN_KEY)
  const savedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
  if (!savedToken || !savedExpiry) return false

  const expiryTime = parseInt(savedExpiry, 10)
  if (Date.now() >= expiryTime) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
    accessToken = null
    return false
  }

  accessToken = savedToken
  const savedEmail = localStorage.getItem(USER_EMAIL_KEY)
  if (savedEmail) userEmail = savedEmail
  if (hasCalendarGrant()) scheduleProactiveRefresh(expiryTime)
  return true
}

// ─── Identity session ──────────────────────────────────────────────────────

export function hasIdentitySession(): boolean {
  if (typeof window === 'undefined') return false
  return !!(userEmail || localStorage.getItem(USER_EMAIL_KEY))
}

/** Valid non-expired token that was granted for Calendar sync. */
export function hasCalendarAccess(): boolean {
  if (typeof window === 'undefined') return false
  if (!hasCalendarGrant()) return false

  const savedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
  const expiryTime = savedExpiry ? parseInt(savedExpiry, 10) : 0
  const notExpired = expiryTime > 0 && Date.now() < expiryTime

  if (accessToken && notExpired) return true

  const savedToken = localStorage.getItem(TOKEN_KEY)
  if (savedToken && notExpired) {
    accessToken = savedToken
    return true
  }

  if (accessToken) {
    accessToken = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
  }

  return false
}

/** @deprecated Prefer hasCalendarAccess() — kept for existing call sites. */
export function isSignedIn(): boolean {
  return hasCalendarAccess()
}

export function initGoogleAuth(clientId: string) {
  if (typeof window === 'undefined') return
  gisClientId = clientId
  pruneExpiredOAuthState()
  migrateAuthStorage()
  restoreTokenFromStorage()
}

function getLoginHint(): string | undefined {
  return userEmail || localStorage.getItem(USER_EMAIL_KEY) || undefined
}

function responseHasCalendarScope(response: { scope?: string }): boolean {
  const google = (window as typeof window & { google?: typeof google }).google
  if (google?.accounts?.oauth2?.hasGrantedAllScopes) {
    return google.accounts.oauth2.hasGrantedAllScopes(
      response as google.accounts.oauth2.TokenResponse,
      CALENDAR_SCOPES
    )
  }
  const granted = (response.scope || '').split(/\s+/)
  return granted.includes(CALENDAR_SCOPES)
}

type TokenRequestOptions = {
  flow: OAuthFlowKind
  scope: string
  prompt?: string
  onSuccess: (token: string, response: google.accounts.oauth2.TokenResponse) => void
  onError?: (reason: string) => void
}

function failOAuthState(
  flow: OAuthFlowKind,
  result: ReturnType<typeof validateOAuthState>,
  onError?: (reason: string) => void
): void {
  logGoogleAuthEvent('oauth_state_validation_failed', { flow, result })
  onError?.(`state_${result}`)
}

function requestOAuthToken(options: TokenRequestOptions): void {
  const google = (window as { google?: { accounts?: { oauth2?: typeof google.accounts.oauth2 } } })
    .google
  if (!google?.accounts?.oauth2) {
    options.onError?.('gis_not_loaded')
    return
  }
  if (!gisClientId) {
    options.onError?.('missing_client_id')
    return
  }

  const oauthState = createOAuthState(options.flow)

  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: gisClientId,
    scope: options.scope,
    include_granted_scopes: true,
    state: oauthState,
    callback: (response: google.accounts.oauth2.TokenResponse) => {
      const stateResult = validateOAuthState(options.flow, response.state)
      const silentFlow = options.flow === 'calendar_silent'
      const stateAcceptable =
        stateResult === 'valid' ||
        (silentFlow && stateResult === 'missing' && !!response.access_token && !response.error)
      if (!stateAcceptable && isOAuthStateFailure(stateResult)) {
        failOAuthState(options.flow, stateResult, options.onError)
        return
      }
      if (response.error) {
        clearOAuthState(options.flow)
        options.onError?.(response.error)
        return
      }
      if (!response.access_token) {
        clearOAuthState(options.flow)
        options.onError?.('no_access_token')
        return
      }
      options.onSuccess(response.access_token, response)
    },
    error_callback: (err) => {
      clearOAuthState(options.flow)
      logGoogleAuthEvent('oauth_state_cleared', {
        flow: options.flow,
        reason: err?.type || 'popup_error',
      })
      options.onError?.(err?.type || 'popup_error')
    },
  })

  tokenClient.requestAccessToken({
    prompt: options.prompt,
    login_hint: getLoginHint(),
    state: oauthState,
  })
}

async function fetchIdentityEmail(token: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const info = await res.json()
    return info.email || null
  } catch {
    return null
  }
}

// ─── Sign-in (identity only — never requests Calendar) ───────────────────────

export function signIn(
  callback?: (email: string) => void,
  onError?: (reason: string) => void
) {
  logGoogleAuthEvent('identity_sign_in_started')
  requestOAuthToken({
    flow: 'identity',
    scope: IDENTITY_SCOPES,
    prompt: '',
    onSuccess: async (token) => {
      storeAccessToken(token)
      const email =
        (await fetchIdentityEmail(token)) ||
        localStorage.getItem(USER_EMAIL_KEY)

      if (!email) {
        logGoogleAuthEvent('identity_sign_in_failed', { reason: 'no_email' })
        onError?.('no_email')
        return
      }

      userEmail = email
      localStorage.setItem(USER_EMAIL_KEY, email)
      logGoogleAuthEvent('identity_sign_in_success')
      callback?.(email)
    },
    onError: (reason) => {
      logGoogleAuthEvent('identity_sign_in_failed', { reason })
      onError?.(reason)
    },
  })
}

// ─── Calendar connect (user-triggered only) ───────────────────────────────────

export function connectCalendar(
  callback?: (success: boolean, reason?: string) => void
): void {
  if (!hasIdentitySession()) {
    logGoogleAuthEvent('calendar_connect_failed', { reason: 'no_identity_session' })
    callback?.(false, 'no_identity_session')
    return
  }
  if (calendarConnectInProgress) return
  calendarConnectInProgress = true

  logGoogleAuthEvent('calendar_connect_started', {
    previously_granted: hasCalendarGrant(),
  })

  const tryPrompt = hasCalendarGrant() ? '' : 'consent'

  requestOAuthToken({
    flow: 'calendar',
    scope: CALENDAR_SCOPES,
    prompt: tryPrompt,
    onSuccess: (token, response) => {
      calendarConnectInProgress = false
      if (!responseHasCalendarScope(response)) {
        logGoogleAuthEvent('calendar_scope_upgrade_failed', {
          granted_scopes: response.scope || '',
        })
        callback?.(false, 'calendar_scope_denied')
        return
      }
      const expiryTime = storeAccessToken(token)
      markCalendarGranted()
      scheduleProactiveRefresh(expiryTime)
      logGoogleAuthEvent('calendar_connect_success', { prompt: tryPrompt || 'silent' })
      callback?.(true)
    },
    onError: (reason) => {
      calendarConnectInProgress = false
      logGoogleAuthEvent('calendar_connect_failed', { reason, prompt: tryPrompt || 'silent' })
      callback?.(false, reason)
    },
  })
}

// ─── Silent refresh (calendar scope only; never on bare startup without grant) ─

function scheduleProactiveRefresh(expiryTime: number) {
  if (!hasCalendarGrant()) return
  if (proactiveRefreshTimer) clearTimeout(proactiveRefreshTimer)
  const msUntilRefresh = expiryTime - Date.now() - 8 * 60 * 1000
  if (msUntilRefresh <= 0) return
  proactiveRefreshTimer = setTimeout(() => {
    trySilentCalendarRefresh()
  }, msUntilRefresh)
}

/**
 * Refresh calendar access token without UI. Only runs when the user previously
 * granted calendar access. Safe to call from reconnect/visibility handlers.
 */
export function trySilentRefresh(): Promise<boolean> {
  return trySilentCalendarRefresh()
}

export function trySilentCalendarRefresh(): Promise<boolean> {
  if (silentRefreshInProgress) return silentRefreshInProgress
  if (typeof window === 'undefined') return Promise.resolve(false)

  if (!hasIdentitySession() || !hasCalendarGrant()) {
    return Promise.resolve(false)
  }

  if (hasCalendarAccess()) return Promise.resolve(true)

  const now = Date.now()
  if (now - lastSilentRefreshAttempt < SILENT_REFRESH_MIN_INTERVAL_MS) {
    return Promise.resolve(false)
  }
  if (
    lastSilentRefreshFailure > 0 &&
    now - lastSilentRefreshFailure < SILENT_REFRESH_COOLDOWN_MS
  ) {
    return Promise.resolve(false)
  }

  lastSilentRefreshAttempt = now
  logGoogleAuthEvent('calendar_silent_refresh_started')

  const google = (window as { google?: { accounts?: { oauth2?: typeof google.accounts.oauth2 } } })
    .google
  if (!google?.accounts?.oauth2 || !gisClientId) {
    return Promise.resolve(false)
  }

  silentRefreshInProgress = new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      lastSilentRefreshFailure = Date.now()
      clearOAuthState('calendar_silent')
      logGoogleAuthEvent('calendar_silent_refresh_failed', { reason: 'timeout' })
      resolve(false)
    }, 10_000)

    requestOAuthToken({
      flow: 'calendar_silent',
      scope: CALENDAR_SCOPES,
      prompt: '',
      onSuccess: (token, response) => {
        clearTimeout(timeout)
        if (!responseHasCalendarScope(response)) {
          lastSilentRefreshFailure = Date.now()
          logGoogleAuthEvent('calendar_scope_upgrade_failed', {
            granted_scopes: response.scope || '',
          })
          return resolve(false)
        }
        const expiryTime = storeAccessToken(token)
        markCalendarGranted()
        scheduleProactiveRefresh(expiryTime)
        lastSilentRefreshFailure = 0
        logGoogleAuthEvent('calendar_silent_refresh_success')
        resolve(true)
      },
      onError: (reason) => {
        clearTimeout(timeout)
        lastSilentRefreshFailure = Date.now()
        logGoogleAuthEvent('calendar_silent_refresh_failed', { reason })
        resolve(false)
      },
    })
  }).finally(() => {
    silentRefreshInProgress = null
  })

  return silentRefreshInProgress
}

// ─── Session cleanup (no revoke on ordinary sign-out) ────────────────────────

export function clearCalendarToken() {
  accessToken = null
  thoughtfulCalendarId = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
  localStorage.removeItem(THOUGHTFUL_CALENDAR_KEY)
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer)
    proactiveRefreshTimer = null
  }
  logGoogleAuthEvent('calendar_token_cleared')
}

/** App sign-out: clears local session only. Does not revoke Google grants. */
export function signOut() {
  logGoogleAuthEvent('identity_sign_out')
  clearAllOAuthState()
  clearCalendarToken()
  userEmail = null
  localStorage.removeItem(USER_EMAIL_KEY)
  localStorage.removeItem(CALENDAR_GRANTED_KEY)
  lastSilentRefreshAttempt = 0
  lastSilentRefreshFailure = 0
  calendarConnectInProgress = false
}

/** Explicit user action to remove app access from Google Account settings flow. */
export function revokeGoogleAccess(): void {
  const token = accessToken || localStorage.getItem(TOKEN_KEY)
  signOut()
  if (token && (window as { google?: { accounts?: { oauth2?: typeof google.accounts.oauth2 } } }).google?.accounts?.oauth2) {
    ;(window as { google: { accounts: { oauth2: typeof google.accounts.oauth2 } } }).google.accounts.oauth2.revoke(
      token,
      () => logGoogleAuthEvent('google_access_revoked')
    )
  }
}

export function getUserEmail() {
  return userEmail
}

export function getStoredEmail(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(USER_EMAIL_KEY)
}

export function getRemindersKey(): string {
  const email = userEmail || getStoredEmail()
  return email ? `thoughtful-reminders-${email}` : 'thoughtful-reminders'
}

// ─── Calendar API (requires hasCalendarAccess) ───────────────────────────────

export interface RecurrenceOptions {
  type: 'yearly' | 'monthly' | 'weekly' | 'daily' | null
  isBirthday: boolean
  isAnniversary: boolean
  endDate?: Date | null
  interval?: number
  byDay?: string
  byMonthDay?: number
  bySetPos?: number
}

function buildRecurrenceRule(options: RecurrenceOptions): string[] | undefined {
  if (!options.type) return undefined

  const freqMap = { yearly: 'YEARLY', monthly: 'MONTHLY', weekly: 'WEEKLY', daily: 'DAILY' }
  let rule = `RRULE:FREQ=${freqMap[options.type]}`

  if (options.interval && options.interval > 1) rule += `;INTERVAL=${options.interval}`
  if (options.byDay) rule += `;BYDAY=${options.byDay}`
  if (options.byMonthDay) rule += `;BYMONTHDAY=${options.byMonthDay}`
  if (options.bySetPos && options.byDay) {
    rule = rule.replace(`;BYDAY=${options.byDay}`, `;BYDAY=${options.bySetPos}${options.byDay}`)
  }
  if (options.endDate && !options.isBirthday && !options.isAnniversary) {
    const until = options.endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    rule += `;UNTIL=${until}`
  }

  return [rule]
}

function toLocalISOString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeout)
    return res
  } catch (e: unknown) {
    clearTimeout(timeout)
    const err = e as { name?: string; message?: string }
    if (err.name === 'AbortError') throw new Error('Request timed out (10s)')
    throw new Error(`Network error: ${err.message || 'unknown'}`)
  }
}

function getThoughtfulCalendarId(): string {
  if (thoughtfulCalendarId) return thoughtfulCalendarId
  const stored = typeof window !== 'undefined' ? localStorage.getItem(THOUGHTFUL_CALENDAR_KEY) : null
  if (stored) {
    thoughtfulCalendarId = stored
    return stored
  }
  return 'primary'
}

export async function getOrCreateThoughtfulCalendar(): Promise<string> {
  if (thoughtfulCalendarId) return thoughtfulCalendarId
  const stored = typeof window !== 'undefined' ? localStorage.getItem(THOUGHTFUL_CALENDAR_KEY) : null
  if (stored) {
    thoughtfulCalendarId = stored
    return stored
  }

  if (!hasCalendarAccess() || !accessToken) return 'primary'

  try {
    const listRes = await fetchWithTimeout(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (listRes.ok) {
      const data = await listRes.json()
      const existing = (data.items || []).find((c: { summary?: string }) => c.summary === 'Thoughtful')
      if (existing?.id) {
        thoughtfulCalendarId = existing.id
        localStorage.setItem(THOUGHTFUL_CALENDAR_KEY, existing.id)
        return existing.id
      }
    }

    const createRes = await fetchWithTimeout(
      'https://www.googleapis.com/calendar/v3/calendars',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: 'Thoughtful' }),
      }
    )
    if (createRes.ok) {
      const cal = await createRes.json()
      if (cal.id) {
        thoughtfulCalendarId = cal.id
        localStorage.setItem(THOUGHTFUL_CALENDAR_KEY, cal.id)
        return cal.id
      }
    }
  } catch (e) {
    console.error('getOrCreateThoughtfulCalendar failed:', e)
  }

  return 'primary'
}

function isAuthError(status: number, message: string): boolean {
  return (
    status === 401 ||
    status === 403 ||
    message.toLowerCase().includes('unauthorized') ||
    message.toLowerCase().includes('forbidden') ||
    message.toLowerCase().includes('insufficient')
  )
}

export async function createCalendarEvent(event: {
  title: string
  date: string
  recurrence?: RecurrenceOptions
  addMeetLink?: boolean
  attendeeEmail?: string
}) {
  if (!hasCalendarAccess()) throw new Error('Calendar not connected')

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const startDate = new Date(event.date)
  const endDate = new Date(startDate.getTime() + 30 * 60 * 1000)

  const reminders =
    event.recurrence?.isBirthday || event.recurrence?.isAnniversary
      ? {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 1440 },
            { method: 'popup', minutes: 0 },
          ],
        }
      : { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] }

  const eventBody: Record<string, unknown> = {
    summary: event.title,
    start: { dateTime: toLocalISOString(startDate), timeZone },
    end: { dateTime: toLocalISOString(endDate), timeZone },
    reminders,
  }

  if (event.recurrence) {
    const recurrence = buildRecurrenceRule(event.recurrence)
    if (recurrence) eventBody.recurrence = recurrence
  }

  if (event.addMeetLink) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  if (event.attendeeEmail) {
    eventBody.attendees = [{ email: event.attendeeEmail }]
  }

  const calendarId = await getOrCreateThoughtfulCalendar()
  const params = new URLSearchParams()
  if (event.addMeetLink) params.set('conferenceDataVersion', '1')
  if (event.attendeeEmail) params.set('sendUpdates', 'all')
  const paramStr = params.toString()
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${paramStr ? '?' + paramStr : ''}`

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(eventBody),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as { error?: { message?: string } }).error?.message || `Calendar API error (${res.status})`
    if (isAuthError(res.status, msg)) clearCalendarToken()
    throw new Error(msg)
  }

  return res.json()
}

export async function updateCalendarEvent(eventId: string, event: { title: string; date: string }) {
  if (!hasCalendarAccess() || !accessToken) throw new Error('Calendar not connected')

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const startDate = new Date(event.date)
  const endDate = new Date(startDate.getTime() + 30 * 60 * 1000)

  const calendarId = getThoughtfulCalendarId()
  const res = await fetchWithTimeout(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: event.title,
        start: { dateTime: toLocalISOString(startDate), timeZone },
        end: { dateTime: toLocalISOString(endDate), timeZone },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as { error?: { message?: string } }).error?.message || `Calendar update failed (${res.status})`
    if (isAuthError(res.status, msg)) clearCalendarToken()
    throw new Error(msg)
  }

  return res.json()
}

export async function getCalendarEvent(eventId: string): Promise<Record<string, unknown>> {
  if (!hasCalendarAccess() || !accessToken) throw new Error('Calendar not connected')

  const calendarId = getThoughtfulCalendarId()
  const res = await fetchWithTimeout(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as { error?: { message?: string } }).error?.message || `Calendar get failed (${res.status})`
    if (isAuthError(res.status, msg)) clearCalendarToken()
    throw new Error(msg)
  }

  return res.json()
}

export async function deleteCalendarEvent(eventId: string) {
  if (!hasCalendarAccess() || !accessToken) return

  try {
    const calendarId = getThoughtfulCalendarId()
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok && res.status !== 404) {
      const err = await res.json().catch(() => ({}))
      const msg = (err as { error?: { message?: string } }).error?.message || ''
      if (isAuthError(res.status, msg)) clearCalendarToken()
    }
  } catch {
    // Deletion is best-effort
  }
}
