import { initGoogleAuth, isSignedIn, getRemindersKey, getStoredEmail, clearCalendarToken, signOut } from '@/lib/google'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

beforeEach(() => {
  localStorageMock.clear()
  // Reset module-level userEmail state (signOut is safe without google API in jsdom)
  signOut()
})

describe('isSignedIn', () => {
  it('returns false when no token stored', () => {
    // Fresh state — no token
    expect(isSignedIn()).toBe(false)
  })

  it('returns true when valid token and expiry exist in localStorage', () => {
    const futureExpiry = (Date.now() + 60 * 60 * 1000).toString()
    localStorageMock.setItem('thoughtful-google-token', 'fake-token-123')
    localStorageMock.setItem('thoughtful-google-token-expiry', futureExpiry)
    localStorageMock.setItem('thoughtful-google-email', 'user@example.com')

    expect(isSignedIn()).toBe(true)
  })

  it('returns false when token is expired', () => {
    const pastExpiry = (Date.now() - 1000).toString()
    localStorageMock.setItem('thoughtful-google-token', 'old-token')
    localStorageMock.setItem('thoughtful-google-token-expiry', pastExpiry)
    localStorageMock.setItem('thoughtful-google-email', 'user@example.com')

    expect(isSignedIn()).toBe(false)
  })
})

describe('getStoredEmail', () => {
  it('returns null when no email stored', () => {
    expect(getStoredEmail()).toBeNull()
  })

  it('returns stored email', () => {
    localStorageMock.setItem('thoughtful-google-email', 'test@example.com')
    expect(getStoredEmail()).toBe('test@example.com')
  })
})

describe('getRemindersKey', () => {
  it('returns generic key when not signed in', () => {
    // Ensure no email is in localStorage for this test
    localStorageMock.removeItem('thoughtful-google-email')
    const key = getRemindersKey()
    expect(key).toBe('thoughtful-reminders')
  })

  it('returns email-specific key when email stored', () => {
    localStorageMock.setItem('thoughtful-google-email', 'user@example.com')
    const key = getRemindersKey()
    expect(key).toBe('thoughtful-reminders-user@example.com')
  })
})

describe('initGoogleAuth', () => {
  it('clears tokens when scope version is stale', () => {
    localStorageMock.setItem('thoughtful-google-token', 'old-token')
    localStorageMock.setItem('thoughtful-google-token-expiry', '999999')
    localStorageMock.setItem('thoughtful-scope-version', 'old-version')

    initGoogleAuth('client-id-123')

    // Tokens should be cleared because scope version changed
    expect(localStorageMock.getItem('thoughtful-google-token')).toBeNull()
    expect(localStorageMock.getItem('thoughtful-google-token-expiry')).toBeNull()
  })

  it('preserves email when clearing stale tokens', () => {
    localStorageMock.setItem('thoughtful-google-email', 'user@example.com')
    localStorageMock.setItem('thoughtful-scope-version', 'old-version')

    initGoogleAuth('client-id-123')

    // Email should be preserved
    expect(localStorageMock.getItem('thoughtful-google-email')).toBe('user@example.com')
  })

  it('restores valid token from localStorage', () => {
    const futureExpiry = (Date.now() + 60 * 60 * 1000).toString()
    localStorageMock.setItem('thoughtful-google-token', 'valid-token')
    localStorageMock.setItem('thoughtful-google-token-expiry', futureExpiry)
    localStorageMock.setItem('thoughtful-google-email', 'user@example.com')
    localStorageMock.setItem('thoughtful-scope-version', 'gis-v1')

    initGoogleAuth('client-id-123')

    expect(isSignedIn()).toBe(true)
  })
})

describe('clearCalendarToken', () => {
  it('removes token and expiry from localStorage', () => {
    localStorageMock.setItem('thoughtful-google-token', 'some-token')
    localStorageMock.setItem('thoughtful-google-token-expiry', '9999')

    clearCalendarToken()

    expect(localStorageMock.getItem('thoughtful-google-token')).toBeNull()
    expect(localStorageMock.getItem('thoughtful-google-token-expiry')).toBeNull()
  })

  it('does not remove email when clearing token', () => {
    localStorageMock.setItem('thoughtful-google-email', 'user@example.com')
    localStorageMock.setItem('thoughtful-google-token', 'some-token')

    clearCalendarToken()

    expect(localStorageMock.getItem('thoughtful-google-email')).toBe('user@example.com')
  })
})
