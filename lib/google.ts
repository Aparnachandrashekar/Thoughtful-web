import { GoogleAuthProvider, signInWithCredential, signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from './firebase'

export const SCOPES = 'https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/userinfo.email'

export let tokenClient: any = null
export let accessToken: string | null = null
export let userEmail: string | null = null

let onSignIn: ((email: string) => void) | null = null

const TOKEN_KEY = 'thoughtful-google-token'
const TOKEN_EXPIRY_KEY = 'thoughtful-google-token-expiry'
const USER_EMAIL_KEY = 'thoughtful-google-email'
const THOUGHTFUL_CALENDAR_KEY = 'thoughtful-gcal-calendar-id'

// In-memory cache for the Thoughtful calendar ID (also stored in localStorage)
let thoughtfulCalendarId: string | null = null

export function initGoogleAuth(clientId: string) {
  if (typeof window === 'undefined') return
  const g = (window as any).google
  if (!g) return

  // Check for existing valid token
  const savedToken = localStorage.getItem(TOKEN_KEY)
  const savedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
  const savedEmail = localStorage.getItem(USER_EMAIL_KEY)

  if (savedToken && savedExpiry && savedEmail) {
    const expiryTime = parseInt(savedExpiry, 10)
    if (Date.now() < expiryTime) {
      accessToken = savedToken
      userEmail = savedEmail
      // onSignIn may not be set yet — caller checks isSignedIn() after init
    }
    // If expired, DON'T clear email — keep it for data loading.
    // Only clear the token so isSignedIn() returns false and
    // calendar calls prompt a re-auth, but user data still loads.
    else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_EXPIRY_KEY)
      // Keep USER_EMAIL_KEY so reminders/people still load
      accessToken = null
      userEmail = savedEmail  // still set email for data access
    }
  }

  tokenClient = g.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: async (resp: any) => {
      if (resp.access_token) {
        accessToken = resp.access_token
        // Token expires in ~1 hour, save with 55 min buffer
        const expiryTime = Date.now() + 55 * 60 * 1000
        localStorage.setItem(TOKEN_KEY, resp.access_token)
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())

        // Sign into Firebase Auth using the Google access token — this lets
        // Firestore security rules verify the user's identity
        const credential = GoogleAuthProvider.credential(null, resp.access_token)
        signInWithCredential(auth, credential).catch(err =>
          console.warn('Firebase Auth sign-in failed (Firestore sync may be limited):', err)
        )

        // Fetch user email
        const email = await fetchUserEmail(resp.access_token)
        if (email) {
          userEmail = email
          localStorage.setItem(USER_EMAIL_KEY, email)
        }

        if (onSignIn) onSignIn(email || '')
      }
    },
  })
}

async function fetchUserEmail(token: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      return data.email
    }
  } catch {}
  return null
}

export function signIn(callback?: (email: string) => void) {
  if (!tokenClient) return
  if (callback) onSignIn = callback
  // prompt: 'consent' ensures the scope grant screen is always shown,
  // so calendar.app.created is properly granted (not silently skipped)
  tokenClient.requestAccessToken({ prompt: 'consent' })
}

// Silently refresh an expired token without showing a consent popup.
// Calls onRefresh() if successful, does nothing if the browser has no active Google session.
export function tryRefreshToken(onRefresh: () => void): void {
  if (!tokenClient) return
  const prevOnSignIn = onSignIn
  onSignIn = () => {
    onSignIn = prevOnSignIn  // restore any existing handler
    onRefresh()
  }
  // prompt: '' = silent (no consent screen). Works as long as user is logged into Google in the browser.
  tokenClient.requestAccessToken({ prompt: '' })
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

  // In-memory token — only valid if expiry also checks out
  if (accessToken && notExpired) return true

  // Try to restore from localStorage
  const savedToken = localStorage.getItem(TOKEN_KEY)
  if (savedToken && notExpired) {
    accessToken = savedToken
    userEmail = localStorage.getItem(USER_EMAIL_KEY)
    return true
  }

  // Token expired — clear in-memory state so next call doesn't reuse it
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

// Get stored email directly from localStorage (works even before auth initializes)
export function getStoredEmail(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(USER_EMAIL_KEY)
}

export function getRemindersKey(): string {
  // First try the in-memory userEmail, then fall back to localStorage
  const email = userEmail || getStoredEmail()
  return email ? `thoughtful-reminders-${email}` : 'thoughtful-reminders'
}

export interface RecurrenceOptions {
  type: 'yearly' | 'monthly' | 'weekly' | 'daily' | null
  isBirthday: boolean
  isAnniversary: boolean
  endDate?: Date | null  // null means forever (for birthdays)
  // Advanced patterns
  interval?: number  // e.g., 2 for "every 2 weeks"
  byDay?: string  // e.g., "FR" for Friday, "MO" for Monday
  byMonthDay?: number  // e.g., 20 for "20th of the month"
  bySetPos?: number  // e.g., -1 for "last", 1 for "first"
}

// Build RRULE string for Google Calendar
function buildRecurrenceRule(options: RecurrenceOptions): string[] | undefined {
  if (!options.type) return undefined

  const freqMap = {
    yearly: 'YEARLY',
    monthly: 'MONTHLY',
    weekly: 'WEEKLY',
    daily: 'DAILY'
  }

  let rule = `RRULE:FREQ=${freqMap[options.type]}`

  // Add interval if specified (e.g., every 2 weeks)
  if (options.interval && options.interval > 1) {
    rule += `;INTERVAL=${options.interval}`
  }

  // Add BYDAY if specified (e.g., FR for Friday)
  if (options.byDay) {
    rule += `;BYDAY=${options.byDay}`
  }

  // Add BYMONTHDAY if specified (e.g., 20 for day 20 of month)
  if (options.byMonthDay) {
    rule += `;BYMONTHDAY=${options.byMonthDay}`
  }

  // Add BYSETPOS if specified (e.g., -1 for last occurrence)
  // Note: BYSETPOS requires BYDAY to be set for "last Saturday of month" pattern
  if (options.bySetPos && options.byDay) {
    // For BYSETPOS, we need to restructure: BYDAY=SA;BYSETPOS=-1 doesn't work
    // Instead use: BYDAY=-1SA (last Saturday)
    rule = rule.replace(`;BYDAY=${options.byDay}`, `;BYDAY=${options.bySetPos}${options.byDay}`)
  }

  // Add end date if specified (not for birthdays/anniversaries which go forever)
  if (options.endDate && !options.isBirthday && !options.isAnniversary) {
    const until = options.endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    rule += `;UNTIL=${until}`
  }

  return [rule]
}

// Format a Date as local ISO string (without UTC Z suffix)
// Google Calendar needs local time + timeZone, NOT UTC
function toLocalISOString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

// Fetch with 10-second timeout
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

// Get the "Thoughtful" calendar ID, creating it if it doesn't exist yet.
// Result is cached in memory and localStorage so only the first call per session
// hits the network.
export async function getOrCreateThoughtfulCalendar(): Promise<string> {
  // 1. In-memory cache
  if (thoughtfulCalendarId) return thoughtfulCalendarId

  // 2. localStorage cache
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(THOUGHTFUL_CALENDAR_KEY)
    if (cached) {
      thoughtfulCalendarId = cached
      return cached
    }
  }

  if (!accessToken) throw new Error('Not signed in')

  // 3. List app-created calendars to find an existing "Thoughtful" calendar
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

  // 4. Create a new "Thoughtful" calendar
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
  if (!isSignedIn()) {
    throw new Error('Not signed in')
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Convert the date string to local ISO format (no UTC shift)
  const startDate = new Date(event.date)
  const endDate = new Date(startDate.getTime() + 30 * 60 * 1000)
  const startDateTime = toLocalISOString(startDate)
  const endDateTime = toLocalISOString(endDate)

  const reminders = event.recurrence?.isBirthday || event.recurrence?.isAnniversary
    ? {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 1440 },
          { method: 'popup', minutes: 0 },
        ],
      }
    : {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
        ],
      }

  const eventBody: Record<string, unknown> = {
    summary: event.title,
    start: { dateTime: startDateTime, timeZone },
    end: { dateTime: endDateTime, timeZone },
    reminders,
  }

  if (event.recurrence) {
    const recurrence = buildRecurrenceRule(event.recurrence)
    if (recurrence) {
      eventBody.recurrence = recurrence
    }
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

  const calendarId = await getOrCreateThoughtfulCalendar()
  const url = event.addMeetLink
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.error?.message || `Calendar API error (${res.status})`
    throw new Error(msg)
  }

  return res.json()
}

export async function updateCalendarEvent(eventId: string, event: {
  title: string
  date: string
}) {
  if (!accessToken) throw new Error('Not signed in')

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const startDate = new Date(event.date)
  const endDate = new Date(startDate.getTime() + 30 * 60 * 1000)

  const calendarId = await getOrCreateThoughtfulCalendar().catch(() => 'primary')
  const res = await fetchWithTimeout(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
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
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
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
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
  } catch {
    // Deletion is best-effort
  }
}
