export const SCOPES = 'https://www.googleapis.com/auth/calendar.events'

export let tokenClient: any = null
export let accessToken: string | null = null

// Initialize Google OAuth
export function initGoogleAuth(clientId: string) {
  if (typeof window === 'undefined') return
  const g = (window as any).google
  if (!g) return

  tokenClient = g.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (resp: any) => {
      accessToken = resp.access_token
    },
  })
}

// Trigger sign-in popup
export function signIn() {
  if (!tokenClient) return
  tokenClient.requestAccessToken()
}

// Check login state
export function isSignedIn() {
export const SCOPES = 'https://www.googleapis.com/auth/calendar.events'

export let tokenClient: any = null
export let accessToken: string | null = null

// Initialize Google OAuth
export function initGoogleAuth(clientId: string) {
  if (typeof window === 'undefined') return
  const g = (window as any).google
  if (!g) return

  tokenClient = g.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (resp: any) => {
      accessToken = resp.access_token
    },
  })
}

// Trigger sign-in popup
export function signIn() {
  if (!tokenClient) return
  tokenClient.requestAccessToken()
}

// Check login state
export function isSignedIn() {
  return !!accessToken
}

// Create Google Calendar event
export async function createCalendarEvent(event: {
  title: string
  date: string
}) {
  if (!accessToken) return

  await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: event.title,
      start: { dateTime: event.date },
      end: { dateTime: event.date },
    }),
  })
}

// Delete event (placeholder for now)
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
;

