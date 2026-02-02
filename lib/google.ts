export const SCOPES = 'https://www.googleapis.com/auth/calendar.events'

export let tokenClient: any = null
export let accessToken: string | null = null

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

export function signIn() {
  if (!tokenClient) return
  tokenClient.requestAccessToken()
}

export function isSignedIn() {
  return !!accessToken
}

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

