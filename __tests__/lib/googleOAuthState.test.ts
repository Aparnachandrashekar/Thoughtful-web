import {
  createOAuthState,
  validateOAuthState,
  clearOAuthState,
  clearAllOAuthState,
  pruneExpiredOAuthState,
} from '@/lib/googleOAuthState'

const sessionStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })

beforeEach(() => {
  sessionStorageMock.clear()
})

describe('createOAuthState / validateOAuthState', () => {
  it('accepts a matching state and clears pending storage', () => {
    const state = createOAuthState('identity')
    expect(validateOAuthState('identity', state)).toBe('valid')
    expect(sessionStorageMock.getItem('thoughtful-oauth-pending-identity')).toBeNull()
  })

  it('rejects mismatch and clears pending', () => {
    createOAuthState('calendar')
    expect(validateOAuthState('calendar', 'wrong-state')).toBe('mismatch')
    expect(sessionStorageMock.getItem('thoughtful-oauth-pending-calendar')).toBeNull()
  })

  it('rejects missing returned state', () => {
    createOAuthState('identity')
    expect(validateOAuthState('identity', undefined)).toBe('missing')
  })

  it('rejects when no pending state exists', () => {
    expect(validateOAuthState('identity', 'orphan')).toBe('no_pending')
  })

  it('isolates flows so identity state cannot satisfy calendar validation', () => {
    const identityState = createOAuthState('identity')
    expect(validateOAuthState('calendar', identityState)).toBe('no_pending')
  })
})

describe('pruneExpiredOAuthState', () => {
  it('removes expired pending state', () => {
    const key = 'thoughtful-oauth-pending-calendar_silent'
    sessionStorageMock.setItem(
      key,
      JSON.stringify({
        value: 'old',
        createdAt: Date.now() - 11 * 60 * 1000,
        flow: 'calendar_silent',
      })
    )
    pruneExpiredOAuthState()
    expect(sessionStorageMock.getItem(key)).toBeNull()
  })
})

describe('clearAllOAuthState', () => {
  it('clears all flow keys', () => {
    createOAuthState('identity')
    createOAuthState('calendar')
    clearAllOAuthState()
    expect(validateOAuthState('identity', 'x')).toBe('no_pending')
    expect(validateOAuthState('calendar', 'x')).toBe('no_pending')
  })
})

describe('clearOAuthState', () => {
  it('clears a single flow without affecting others', () => {
    const cal = createOAuthState('calendar')
    createOAuthState('identity')
    clearOAuthState('identity')
    expect(validateOAuthState('calendar', cal)).toBe('valid')
  })
})
