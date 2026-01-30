declare namespace google.accounts.oauth2 {
  interface TokenClient {
    requestAccessToken(): void
  }

  interface TokenResponse {
    access_token: string
    error?: string
  }

  interface TokenClientConfig {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
  }

  function initTokenClient(config: TokenClientConfig): TokenClient
  function revoke(token: string, callback: () => void): void
}
