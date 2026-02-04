export const SCOPES = 'https://www.googleapis.com/auth/calendar.events'

export let tokenClient: any = null
export let accessToken: string | null = null

let onSignIn: (() => void) | null = null

export function initGoogleAuth(clientId: string) {
  if (typeof window === 'undefined') return
  const g = (window as any).google
  if (!g) return

  tokenClient = g.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (resp: any) => {
      if (resp.access_token) {
        accessToken = resp.access_token
        if (onSignIn) onSignIn()
      }
    },
  })
}

export function signIn(callback?: () => void) {
  if (!tokenClient) return
  if (callback) onSignIn = callback
  tokenClient.requestAccessToken()
}

export function isSignedIn() {
  return !!accessToken
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

