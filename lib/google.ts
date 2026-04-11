// Google Identity Services (GIS) for Calendar OAuth token.
// Firebase Auth is NOT used here — Firestore uses anonymous auth (see app/page.tsx).

export const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email'

// Bump this string whenever the auth method or scopes change — forces re-auth for all users
const SCOPE_VERSION = 'gis-v1'
const SCOPE_VERSION_KEY = 'thoughtful-scope-version'

export let accessToken: string | null = null
export let userEmail: string | null = null

const TOKEN_KEY = 'thoughtful-google-token'
const TOKEN_EXPIRY_KEY = 'thoughtful-google-token-expiry'
const USER_EMAIL_KEY = 'thoughtful-google-email'
const THOUGHTFUL_CALENDAR_KEY = 'thoughtful-gcal-calendar-id'


let thoughtfulCalendarId: string | null = null
let gisClientId: string | null = null

// Restore cached token on init. Clears stale tokens if auth method changed.
export function initGoogleAuth(clientId: string) {
  if (typeof window === 'undefined') return
  gisClientId = clientId

  // If auth method changed (e.g. Firebase Auth → GIS), clear old tokens
  const storedScopeVersion = localStorage.getItem(SCOPE_VERSION_KEY)
  if (storedScopeVersion !== SCOPE_VERSION) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
    localStorage.removeItem(THOUGHTFUL_CALENDAR_KEY)
    localStorage.setItem(SCOPE_VERSION_KEY, SCOPE_VERSION)
    // Keep USER_EMAIL_KEY so existing reminders/people still load
  }

  const savedToken = localStorage.getItem(TOKEN_KEY)
  const savedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
  const savedEmail = localStorage.getItem(USER_EMAIL_KEY)

  if (savedToken && savedExpiry && savedEmail) {
    const expiryTime = parseInt(savedExpiry, 10)
    if (Date.now() < expiryTime) {
      accessToken = savedToken
      userEmail = savedEmail
      scheduleProactiveRefresh(expiryTime)
    } else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_EXPIRY_KEY)
      accessToken = null
      userEmail = savedEmail
    }
  }
}

// Sign in with Google using GIS token client.
// Opens a Google OAuth popup — no Firebase, no cross-origin iframes.
export function signIn(callback?: (email: string) => void) {
  const google = (window as any).google
  if (!google?.accounts?.oauth2) {
    console.error('GIS script not loaded yet')
    return
  }
  if (!gisClientId) {
    console.error('Google client ID not set')
    return
  }

  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: gisClientId,
    scope: SCOPES,
    callback: async (response: any) => {
      if (response.error) {
        console.error('GIS auth error:', response.error)
        return
      }
      if (!response.access_token) return

      accessToken = response.access_token
      const expiryTime = Date.now() + 55 * 60 * 1000
      localStorage.setItem(TOKEN_KEY, response.access_token)
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())
      localStorage.setItem(SCOPE_VERSION_KEY, SCOPE_VERSION)
      scheduleProactiveRefresh(expiryTime)

      // Fetch user email via userinfo API
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
          headers: { Authorization: `Bearer ${response.access_token}` },
        })
        const info = await res.json()
        if (info.email) {
          userEmail = info.email
          localStorage.setItem(USER_EMAIL_KEY, info.email)
          console.log('GIS: signed in as', info.email)
          if (callback) callback(info.email)
        }
      } catch (e) {
        console.error('GIS: failed to get user email:', e)
      }
    },
  })

  tokenClient.requestAccessToken({ prompt: 'consent' })
}

// Silently refresh the GIS token using the user's existing Google browser session.
// Returns a Promise<boolean>: true if a new token was obtained, false otherwise.
// Uses prompt:'' so Google auto-selects the account without showing UI (if session is valid).
let silentRefreshInProgress: Promise<boolean> | null = null
let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null

// Schedule a silent token refresh 8 minutes before expiry.
// Called whenever a new token is stored so we never go stale mid-session.
function scheduleProactiveRefresh(expiryTime: number) {
  if (proactiveRefreshTimer) clearTimeout(proactiveRefreshTimer)
  const msUntilRefresh = expiryTime - Date.now() - 8 * 60 * 1000 // 8 min before expiry
  if (msUntilRefresh <= 0) return // already close to expiry — let the reactive path handle it
  proactiveRefreshTimer = setTimeout(() => {
    trySilentRefresh()
  }, msUntilRefresh)
}

export function trySilentRefresh(): Promise<boolean> {
  if (silentRefreshInProgress) return silentRefreshInProgress
  if (typeof window === 'undefined') return Promise.resolve(false)

  const google = (window as any).google
  if (!google?.accounts?.oauth2 || !gisClientId) return Promise.resolve(false)

  const loginHint = userEmail || localStorage.getItem(USER_EMAIL_KEY) || undefined

  silentRefreshInProgress = new Promise<boolean>((resolve) => {
    // 10s timeout — GIS round-trips to Google's servers, which can take 3–8s on real connections.
    // 2s was too short and caused almost every silent refresh to time out before Google responded.
    const timeout = setTimeout(() => resolve(false), 10_000)

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: gisClientId,
      scope: SCOPES,
      callback: (response: any) => {
        clearTimeout(timeout)
        if (response.error || !response.access_token) return resolve(false)
        accessToken = response.access_token
        const expiryTime = Date.now() + 55 * 60 * 1000
        localStorage.setItem(TOKEN_KEY, response.access_token)
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())
        scheduleProactiveRefresh(expiryTime)
        resolve(true)
      },
    })
    tokenClient.requestAccessToken({ prompt: '', login_hint: loginHint })
  }).finally(() => {
    silentRefreshInProgress = null
  })

  return silentRefreshInProgress
}

// Clear the Calendar access token — called when a 401/403 is detected so the
// UI can immediately show the "Reconnect Calendar" button
export function clearCalendarToken() {
  accessToken = null
  thoughtfulCalendarId = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
  localStorage.removeItem(THOUGHTFUL_CALENDAR_KEY)
}

export function signOut() {
  const token = accessToken
  clearCalendarToken()
  userEmail = null
  localStorage.removeItem(USER_EMAIL_KEY)
  // Revoke the Google OAuth token so the user is fully signed out
  if (token && (window as any).google?.accounts?.oauth2) {
    ;(window as any).google.accounts.oauth2.revoke(token, () => {})
  }
}

export function isSignedIn(): boolean {
  if (typeof window === 'undefined') return false

  const savedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
  const expiryTime = savedExpiry ? parseInt(savedExpiry, 10) : 0
  const notExpired = expiryTime > 0 && Date.now() < expiryTime

  if (accessToken && notExpired) return true

  const savedToken = localStorage.getItem(TOKEN_KEY)
  if (savedToken && notExpired) {
    accessToken = savedToken
    userEmail = localStorage.getItem(USER_EMAIL_KEY)
    return true
  }

  if (accessToken) {
    accessToken = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
  }

  return false
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
  } catch (e: any) {
    clearTimeout(timeout)
    if (e.name === 'AbortError') throw new Error('Request timed out (10s)')
    throw new Error(`Network error: ${e.message}`)
  }
}

// Returns the Thoughtful calendar ID — hardcoded constant, no localStorage, no async.
// This value is embedded directly in the JS bundle at build time.
function getThoughtfulCalendarId(): string {
  // Use a user-specific stored calendar ID if available, otherwise fall back
  // to 'primary' which always resolves to the signed-in user's own calendar.
  const stored = typeof window !== 'undefined' ? localStorage.getItem(THOUGHTFUL_CALENDAR_KEY) : null
  return stored || 'primary'
}

// Kept for backwards compat with page.tsx calls — just runs the sync getter
export async function getOrCreateThoughtfulCalendar(): Promise<string> {
  return getThoughtfulCalendarId()
}

// Detect auth/permission errors from Calendar API responses
function isAuthError(status: number, message: string): boolean {
  return status === 401 || status === 403 ||
    message.toLowerCase().includes('unauthorized') ||
    message.toLowerCase().includes('forbidden') ||
    message.toLowerCase().includes('insufficient')
}

export async function createCalendarEvent(event: {
  title: string
  date: string
  recurrence?: RecurrenceOptions
  addMeetLink?: boolean
  attendeeEmail?: string
}) {
  if (!isSignedIn()) throw new Error('Not signed in')

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const startDate = new Date(event.date)
  const endDate = new Date(startDate.getTime() + 30 * 60 * 1000)

  const reminders = event.recurrence?.isBirthday || event.recurrence?.isAnniversary
    ? { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }, { method: 'popup', minutes: 0 }] }
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
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    }
  }

  if (event.attendeeEmail) {
    eventBody.attendees = [{ email: event.attendeeEmail }]
  }

  const calendarId = getThoughtfulCalendarId()
  const url = event.addMeetLink
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(eventBody),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.error?.message || `Calendar API error (${res.status})`
    if (isAuthError(res.status, msg)) clearCalendarToken()
    throw new Error(msg)
  }

  return res.json()
}

export async function updateCalendarEvent(eventId: string, event: { title: string; date: string }) {
  if (!accessToken) throw new Error('Not signed in')

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
    const msg = err.error?.message || `Calendar update failed (${res.status})`
    if (isAuthError(res.status, msg)) clearCalendarToken()
    throw new Error(msg)
  }

  return res.json()
}

export async function getCalendarEvent(eventId: string): Promise<any> {
  if (!accessToken) throw new Error('Not signed in')

  const calendarId = getThoughtfulCalendarId()
  const res = await fetchWithTimeout(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.error?.message || `Calendar get failed (${res.status})`
    if (isAuthError(res.status, msg)) clearCalendarToken()
    throw new Error(msg)
  }

  return res.json()
}

export async function deleteCalendarEvent(eventId: string) {
  if (!accessToken) return

  try {
    const calendarId = getThoughtfulCalendarId()
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok && res.status !== 404) {
      const err = await res.json().catch(() => ({}))
      const msg = err.error?.message || ''
      if (isAuthError(res.status, msg)) clearCalendarToken()
    }
  } catch {
    // Deletion is best-effort
  }
}
