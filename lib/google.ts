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

export function isSignedIn() {
  return !!accessToken
}

export function getUserEmail() {
  return userEmail
}

export function getRemindersKey(): string {
  return userEmail ? `thoughtful-reminders-${userEmail}` : 'thoughtful-reminders'
}

export async function createCalendarEvent(event: {
  title: string
  date: string
}) {
  if (!accessToken) throw new Error('Not signed in')

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: event.title,
      start: { dateTime: event.date },
      end: { dateTime: new Date(new Date(event.date).getTime() + 30 * 60 * 1000).toISOString() },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
        ],
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Failed to create event')
  }

  return res.json()
}

export async function updateCalendarEvent(eventId: string, event: {
  title: string
  date: string
}) {
  if (!accessToken) throw new Error('Not signed in')

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: event.title,
        start: { dateTime: event.date },
        end: { dateTime: new Date(new Date(event.date).getTime() + 30 * 60 * 1000).toISOString() },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Failed to update event')
  }

  return res.json()
}

export async function deleteCalendarEvent(eventId: string) {
  if (!accessToken) return

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
}
