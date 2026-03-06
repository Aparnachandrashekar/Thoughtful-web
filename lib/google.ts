import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from './firebase'

// In PWA standalone mode, signInWithPopup doesn't work on iOS — use redirect instead
function isPWA(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
}

export const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email'

export let accessToken: string | null = null
export let userEmail: string | null = null

const TOKEN_KEY = 'thoughtful-google-token'
const TOKEN_EXPIRY_KEY = 'thoughtful-google-token-expiry'
const USER_EMAIL_KEY = 'thoughtful-google-email'
const THOUGHTFUL_CALENDAR_KEY = 'thoughtful-gcal-calendar-id'

let thoughtfulCalendarId: string | null = null

// Google provider with Calendar scope — Firebase Auth handles the OAuth flow
const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events')
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email')
googleProvider.setCustomParameters({ prompt: 'consent' })

// Restore cached token on init (no GIS script needed)
export function initGoogleAuth(_clientId: string) {
  if (typeof window === 'undefined') return

  const savedToken = localStorage.getItem(TOKEN_KEY)
  const savedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
  const savedEmail = localStorage.getItem(USER_EMAIL_KEY)

  if (savedToken && savedExpiry && savedEmail) {
    const expiryTime = parseInt(savedExpiry, 10)
    if (Date.now() < expiryTime) {
      accessToken = savedToken
      userEmail = savedEmail
    } else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_EXPIRY_KEY)
      accessToken = null
      userEmail = savedEmail
    }
  }
}

function handleAuthResult(result: any, callback?: (email: string) => void) {
  const credential = GoogleAuthProvider.credentialFromResult(result)
  if (credential?.accessToken) {
    accessToken = credential.accessToken
    const expiryTime = Date.now() + 55 * 60 * 1000
    localStorage.setItem(TOKEN_KEY, credential.accessToken)
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())
  }
  const email = result.user.email || ''
  userEmail = email
  localStorage.setItem(USER_EMAIL_KEY, email)
  console.log('Firebase Auth: signed in as', email)
  if (callback) callback(email)
}

// Sign in with Google — uses redirect in PWA mode, popup in browser
export function signIn(callback?: (email: string) => void) {
  if (isPWA()) {
    // Store that we're waiting for a redirect result
    sessionStorage.setItem('thoughtful-auth-redirect', '1')
    signInWithRedirect(auth, googleProvider)
  } else {
    signInWithPopup(auth, googleProvider)
      .then((result) => handleAuthResult(result, callback))
      .catch((err) => console.error('Sign-in failed:', err?.code, err?.message))
  }
}

// Call on page load to handle the result of a redirect sign-in (PWA mode)
export async function checkRedirectResult(callback?: (email: string) => void): Promise<void> {
  if (!sessionStorage.getItem('thoughtful-auth-redirect')) return
  try {
    const result = await getRedirectResult(auth)
    if (result) {
      sessionStorage.removeItem('thoughtful-auth-redirect')
      handleAuthResult(result, callback)
    }
  } catch (err: any) {
    console.error('Redirect sign-in failed:', err?.code, err?.message)
    sessionStorage.removeItem('thoughtful-auth-redirect')
  }
}

// Re-open sign-in to get a fresh Calendar access token
// (used by the "Reconnect Calendar" button)
export function tryRefreshToken(onRefresh: () => void): void {
  signIn((_email) => onRefresh())
}

export function signOut() {
  accessToken = null
  userEmail = null
  thoughtfulCalendarId = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
  localStorage.removeItem(USER_EMAIL_KEY)
  localStorage.removeItem(THOUGHTFUL_CALENDAR_KEY)
  firebaseSignOut(auth).catch(() => {})
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

  const freqMap = {
    yearly: 'YEARLY',
    monthly: 'MONTHLY',
    weekly: 'WEEKLY',
    daily: 'DAILY'
  }

  let rule = `RRULE:FREQ=${freqMap[options.type]}`

  if (options.interval && options.interval > 1) {
    rule += `;INTERVAL=${options.interval}`
  }
  if (options.byDay) {
    rule += `;BYDAY=${options.byDay}`
  }
  if (options.byMonthDay) {
    rule += `;BYMONTHDAY=${options.byMonthDay}`
  }
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

export async function getOrCreateThoughtfulCalendar(): Promise<string> {
  if (thoughtfulCalendarId) return thoughtfulCalendarId

  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(THOUGHTFUL_CALENDAR_KEY)
    if (cached) {
      thoughtfulCalendarId = cached
      return cached
    }
  }

  if (!accessToken) throw new Error('Not signed in')

  try {
    const listRes = await fetchWithTimeout(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (listRes.ok) {
      const listData = await listRes.json()
      const existing = (listData.items as any[])?.find((c: any) => c.summary === 'Thoughtful')
      if (existing?.id) {
        thoughtfulCalendarId = existing.id
        if (typeof window !== 'undefined') localStorage.setItem(THOUGHTFUL_CALENDAR_KEY, existing.id)
        return existing.id
      }
    }
  } catch {}

  const createRes = await fetchWithTimeout(
    'https://www.googleapis.com/calendar/v3/calendars',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: 'Thoughtful',
        description: 'Reminders created by Thoughtful',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    }
  )

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}))
    throw new Error(err.error?.message || `Failed to create Thoughtful calendar (${createRes.status})`)
  }

  const calData = await createRes.json()
  thoughtfulCalendarId = calData.id
  if (typeof window !== 'undefined') localStorage.setItem(THOUGHTFUL_CALENDAR_KEY, calData.id)
  return calData.id
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
  const startDateTime = toLocalISOString(startDate)
  const endDateTime = toLocalISOString(endDate)

  const reminders = event.recurrence?.isBirthday || event.recurrence?.isAnniversary
    ? { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }, { method: 'popup', minutes: 0 }] }
    : { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] }

  const eventBody: Record<string, unknown> = {
    summary: event.title,
    start: { dateTime: startDateTime, timeZone },
    end: { dateTime: endDateTime, timeZone },
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

  const calendarId = await getOrCreateThoughtfulCalendar().catch(() => 'primary')
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
    throw new Error(err.error?.message || `Calendar API error (${res.status})`)
  }

  return res.json()
}

export async function updateCalendarEvent(eventId: string, event: { title: string; date: string }) {
  if (!accessToken) throw new Error('Not signed in')

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const startDate = new Date(event.date)
  const endDate = new Date(startDate.getTime() + 30 * 60 * 1000)

  const calendarId = await getOrCreateThoughtfulCalendar().catch(() => 'primary')
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
    throw new Error(err.error?.message || `Calendar update failed (${res.status})`)
  }

  return res.json()
}

export async function getCalendarEvent(eventId: string): Promise<any> {
  if (!accessToken) throw new Error('Not signed in')

  const calendarId = await getOrCreateThoughtfulCalendar().catch(() => 'primary')
  const res = await fetchWithTimeout(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Calendar get failed (${res.status})`)
  }

  return res.json()
}

export async function deleteCalendarEvent(eventId: string) {
  if (!accessToken) return

  try {
    const calendarId = await getOrCreateThoughtfulCalendar().catch(() => 'primary')
    await fetchWithTimeout(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
    )
  } catch {
    // Deletion is best-effort
  }
}
