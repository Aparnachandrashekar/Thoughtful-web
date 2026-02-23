export const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email'

export let tokenClient: any = null
export let accessToken: string | null = null
export let userEmail: string | null = null

let onSignIn: ((email: string) => void) | null = null

const TOKEN_KEY = 'thoughtful-google-token'
const TOKEN_EXPIRY_KEY = 'thoughtful-google-token-expiry'
const USER_EMAIL_KEY = 'thoughtful-google-email'

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
      if (onSignIn) onSignIn(savedEmail)
    } else {
      // Token expired, clear it
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_EXPIRY_KEY)
      localStorage.removeItem(USER_EMAIL_KEY)
    }
  }

  tokenClient = g.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: async (resp: any) => {
      if (resp.access_token) {
        accessToken = resp.access_token
        // Token expires in ~1 hour, save with 50 min buffer
        const expiryTime = Date.now() + 50 * 60 * 1000
        localStorage.setItem(TOKEN_KEY, resp.access_token)
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())

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
  tokenClient.requestAccessToken()
}

export function signOut() {
  accessToken = null
  userEmail = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
  localStorage.removeItem(USER_EMAIL_KEY)
}

export function isSignedIn(): boolean {
  // Check in-memory token first, then localStorage
  if (accessToken) return true

  // Try to restore from localStorage if not in memory
  if (typeof window !== 'undefined') {
    const savedToken = localStorage.getItem(TOKEN_KEY)
    const savedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY)

    if (savedToken && savedExpiry) {
      const expiryTime = parseInt(savedExpiry, 10)
      if (Date.now() < expiryTime) {
        // Restore token to memory
        accessToken = savedToken
        userEmail = localStorage.getItem(USER_EMAIL_KEY)
        return true
      }
    }
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

  const url = event.addMeetLink
    ? 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1'
    : 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

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

  const res = await fetchWithTimeout(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
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

export async function deleteCalendarEvent(eventId: string) {
  if (!accessToken) return

  try {
    await fetchWithTimeout(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
  } catch {
    // Deletion is best-effort
  }
}
