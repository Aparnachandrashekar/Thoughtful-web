import {
  initGoogleAuth,
  isSignedIn,
  hasCalendarAccess,
  hasIdentitySession,
  getRemindersKey,
  getStoredEmail,
  clearCalendarToken,
  signOut,
  IDENTITY_SCOPES,
  CALENDAR_SCOPES,
} from '@/lib/google'

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
  signOut()
})

describe('scope constants', () => {
  it('uses OpenID identity scopes only for sign-in', () => {
    expect(IDENTITY_SCOPES).toBe('openid email profile')
    expect(IDENTITY_SCOPES).not.toContain('calendar')
  })

  it('uses calendar scope for incremental API access', () => {
    expect(CALENDAR_SCOPES).toBe('https://www.googleapis.com/auth/calendar')
  })
})

describe('hasCalendarAccess / isSignedIn', () => {
  it('returns false when no token stored', () => {
    expect(hasCalendarAccess()).toBe(false)
    expect(isSignedIn()).toBe(false)
  })

  it('returns false when token exists but calendar not granted', () => {
    const futureExpiry = (Date.now() + 60 * 60 * 1000).toString()
    localStorageMock.setItem('thoughtful-google-token', 'fake-token-123')
    localStorageMock.setItem('thoughtful-google-token-expiry', futureExpiry)
    localStorageMock.setItem('thoughtful-google-email', 'user@example.com')
    expect(hasCalendarAccess()).toBe(false)
  })

  it('returns true when valid token and calendar granted flag set', () => {
    const futureExpiry = (Date.now() + 60 * 60 * 1000).toString()
    localStorageMock.setItem('thoughtful-google-token', 'fake-token-123')
    localStorageMock.setItem('thoughtful-google-token-expiry', futureExpiry)
    localStorageMock.setItem('thoughtful-google-email', 'user@example.com')
    localStorageMock.setItem('thoughtful-calendar-granted', 'true')
    localStorageMock.setItem('thoughtful-scope-version', 'gis-v4-incremental')

    expect(hasCalendarAccess()).toBe(true)
  })

  it('returns false when token is expired', () => {
    const pastExpiry = (Date.now() - 1000).toString()
    localStorageMock.setItem('thoughtful-google-token', 'old-token')
    localStorageMock.setItem('thoughtful-google-token-expiry', pastExpiry)
    localStorageMock.setItem('thoughtful-google-email', 'user@example.com')
    localStorageMock.setItem('thoughtful-calendar-granted', 'true')

    expect(hasCalendarAccess()).toBe(false)
  })
})

describe('hasIdentitySession', () => {
  it('returns false without stored email', () => {
    expect(hasIdentitySession()).toBe(false)
  })

  it('returns true with stored email', () => {
    localStorageMock.setItem('thoughtful-google-email', 'user@example.com')
    expect(hasIdentitySession()).toBe(true)
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
    localStorageMock.removeItem('thoughtful-google-email')
    expect(getRemindersKey()).toBe('thoughtful-reminders')
  })

  it('returns email-specific key when email stored', () => {
    localStorageMock.setItem('thoughtful-google-email', 'user@example.com')
    expect(getRemindersKey()).toBe('thoughtful-reminders-user@example.com')
  })
})

describe('initGoogleAuth migration', () => {
  it('preserves legacy tokens when migrating from gis-v3 with email', () => {
    localStorageMock.setItem('thoughtful-google-token', 'old-token')
    localStorageMock.setItem('thoughtful-google-token-expiry', (Date.now() + 3600000).toString())
    localStorageMock.setItem('thoughtful-google-email', 'user@example.com')
    localStorageMock.setItem('thoughtful-scope-version', 'gis-v3')

    initGoogleAuth('client-id-123')

    expect(localStorageMock.getItem('thoughtful-google-token')).toBe('old-token')
    expect(localStorageMock.getItem('thoughtful-calendar-granted')).toBe('true')
    expect(localStorageMock.getItem('thoughtful-scope-version')).toBe('gis-v4-incremental')
    expect(hasCalendarAccess()).toBe(true)
  })

  it('clears orphan tokens when migrating without email', () => {
    localStorageMock.setItem('thoughtful-google-token', 'orphan-token')
    localStorageMock.setItem('thoughtful-google-token-expiry', '999999')
    localStorageMock.setItem('thoughtful-scope-version', 'gis-v2')

    initGoogleAuth('client-id-123')

    expect(localStorageMock.getItem('thoughtful-google-token')).toBeNull()
  })

  it('restores valid token from localStorage after migration', () => {
    const futureExpiry = (Date.now() + 60 * 60 * 1000).toString()
    localStorageMock.setItem('thoughtful-google-token', 'valid-token')
    localStorageMock.setItem('thoughtful-google-token-expiry', futureExpiry)
    localStorageMock.setItem('thoughtful-google-email', 'user@example.com')
    localStorageMock.setItem('thoughtful-calendar-granted', 'true')
    localStorageMock.setItem('thoughtful-scope-version', 'gis-v4-incremental')

    initGoogleAuth('client-id-123')

    expect(hasCalendarAccess()).toBe(true)
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

describe('signOut', () => {
  it('clears email and calendar grant without requiring revoke API', () => {
    localStorageMock.setItem('thoughtful-google-email', 'user@example.com')
    localStorageMock.setItem('thoughtful-google-token', 'some-token')
    localStorageMock.setItem('thoughtful-calendar-granted', 'true')

    signOut()

    expect(localStorageMock.getItem('thoughtful-google-email')).toBeNull()
    expect(localStorageMock.getItem('thoughtful-google-token')).toBeNull()
    expect(localStorageMock.getItem('thoughtful-calendar-granted')).toBeNull()
  })
})
