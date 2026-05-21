declare namespace google.accounts.oauth2 {
  interface TokenClient {
    requestAccessToken(overrideConfig?: OverridableTokenClientConfig): void
  }

  interface TokenResponse {
    access_token: string
    scope?: string
    state?: string
    error?: string
    error_description?: string
  }

  interface TokenClientConfig {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    include_granted_scopes?: boolean
    prompt?: string
    login_hint?: string
    state?: string
    error_callback?: (error: { type: string }) => void
  }

  interface OverridableTokenClientConfig {
    prompt?: string
    login_hint?: string
    scope?: string
    state?: string
  }

  function initTokenClient(config: TokenClientConfig): TokenClient
  function revoke(token: string, callback: () => void): void
  function hasGrantedAllScopes(
    tokenResponse: TokenResponse,
    firstScope: string,
    ...restScopes: string[]
  ): boolean
  function hasGrantedAnyScope(
    tokenResponse: TokenResponse,
    firstScope: string,
    ...restScopes: string[]
  ): boolean
}
