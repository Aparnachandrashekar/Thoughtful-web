const SCOPES = 'https://www.googleapis.com/auth/calendar.events'

let tokenClient: google.accounts.oauth2.TokenClient | null = null
let accessToken: string | null = null

// Will be set from env
function getClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
}

export function isSignedIn(): boolean {
  return accessToken !== null
}

export function getToken(): string | null {
  return accessToken
}

export function initGoogleAuth(): Promise<void> {
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
}

export function signIn(): Promise<string> {
  return new Promise((resolve, reject) => {
    const clientId = getClientId()
    if (!clientId) {
      reject(new Error('Google Client ID not configured'))
      return
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error))
          return
        }
        accessToken = response.access_token
        resolve(response.access_token)
      },
    })

    tokenClient.requestAccessToken()
  })
}

export function signOut(): void {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {})
    accessToken = null
  }
}

export interface CalendarEvent {
  title: string
  date: Date
}

export async function createCalendarEvent(event: CalendarEvent): Promise<{ id: string; htmlLink: string }> {
  const token = getToken()
  if (!token) {
    throw new Error('Not signed in')
  }

  // Create a 30-minute event with a popup reminder
  const start = event.date.toISOString()
  const endDate = new Date(event.date.getTime() + 30 * 60 * 1000)
  const end = endDate.toISOString()

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: event.title,
        start: { dateTime: start },
        end: { dateTime: end },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 10 },
            { method: 'email', minutes: 10 },
          ],
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'Failed to create event')
  }

  return response.json()
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const token = getToken()
  if (!token) return

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )
}
