export const SCOPES = 'https://www.googleapis.com/auth/calendar.events'

export let tokenClient: any = null
export let accessToken: string | null = null

export function initGoogleClient(clientId: string) {
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
;

