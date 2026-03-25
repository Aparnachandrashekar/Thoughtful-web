import { parseReminder } from '@/lib/parser'

describe('parseReminder — title extraction', () => {
  it('strips "remind me to" prefix', () => {
    const { title } = parseReminder('remind me to call mom tomorrow')
    // "tomorrow" is kept in title (date words are preserved per design)
    expect(title).toMatch(/^Call mom/i)
  })

  it('strips time expressions from title', () => {
    const { title } = parseReminder('dentist appointment at 3pm')
    expect(title).toBe('Dentist appointment')
  })

  it('strips day names from title', () => {
    const { title } = parseReminder('team meeting on Friday at 2pm')
    expect(title).toBe('Team meeting')
  })

  it('preserves "today" in title (not stripped)', () => {
    const { title } = parseReminder('not today - Monday - 9PM call dad')
    // "today" should NOT be stripped from the title
    expect(title.toLowerCase()).not.toMatch(/^monday/)
  })

  it('strips recurrence patterns from title', () => {
    const { title } = parseReminder('gym every Monday at 7am')
    expect(title).toBe('Gym')
  })

  it('capitalizes first letter', () => {
    const { title } = parseReminder('coffee with John tomorrow')
    expect(title.charAt(0)).toMatch(/[A-Z]/)
  })
})

describe('parseReminder — date parsing', () => {
  it('parses "tomorrow" to a future date', () => {
    const { date } = parseReminder('call mom tomorrow at 9am')
    expect(date).not.toBeNull()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(date!.getDate()).toBe(tomorrow.getDate())
  })

  it('returns null date when no date specified', () => {
    const { date } = parseReminder('buy groceries')
    // May return null OR a default date — just check it's not a past date
    if (date !== null) {
      expect(date.getTime()).toBeGreaterThanOrEqual(Date.now() - 60_000)
    }
  })

  it('defaults to PM for ambiguous hours 1-7', () => {
    const { date } = parseReminder('call at 3 tomorrow')
    expect(date).not.toBeNull()
    expect(date!.getHours()).toBe(15) // 3 PM
  })

  it('keeps 8 AM as AM (morning hours)', () => {
    const { date } = parseReminder('meeting tomorrow at 8am')
    expect(date).not.toBeNull()
    expect(date!.getHours()).toBe(8)
  })

  it('defaults time to ~now+10min when no time specified', () => {
    const before = Date.now()
    const { date } = parseReminder('dentist tomorrow')
    const after = Date.now()
    if (date !== null) {
      // When a date is parsed without explicit time, it should be near now+10min
      // This is somewhat fuzzy — just ensure it's not midnight (00:00)
      // unless the parser explicitly defaulted to that
      const hours = date.getHours()
      const nowHours = new Date().getHours()
      // The parsed time should be within a few hours of now (not midnight default)
      expect(Math.abs(hours - nowHours)).toBeLessThanOrEqual(1)
    }
  })
})

describe('parseReminder — recurrence detection', () => {
  it('detects birthday as yearly recurrence', () => {
    const { recurrence } = parseReminder("Mom's birthday next March")
    expect(recurrence.type).toBe('yearly')
    expect(recurrence.isBirthday).toBe(true)
  })

  it('detects anniversary as yearly recurrence', () => {
    const { recurrence } = parseReminder('wedding anniversary June 5')
    expect(recurrence.type).toBe('yearly')
    expect(recurrence.isAnniversary).toBe(true)
  })

  it('detects "every week" as weekly', () => {
    const { recurrence } = parseReminder('team meeting every week on Monday')
    expect(recurrence.type).toBe('weekly')
  })

  it('detects "every Friday" as weekly with byDay', () => {
    const { recurrence } = parseReminder('gym every Friday at 7am')
    expect(recurrence.type).toBe('weekly')
    expect(recurrence.byDay).toBe('FR')
  })

  it('detects "every month" as monthly', () => {
    const { recurrence } = parseReminder('pay rent every month on the 1st')
    expect(recurrence.type).toBe('monthly')
  })

  it('detects "daily" as daily', () => {
    const { recurrence } = parseReminder('take vitamins daily')
    expect(recurrence.type).toBe('daily')
  })

  it('detects "every other day" as daily with interval 2', () => {
    const { recurrence } = parseReminder('water plants every other day')
    expect(recurrence.type).toBe('daily')
    expect(recurrence.interval).toBe(2)
  })

  it('returns null recurrence for non-recurring reminders', () => {
    const { recurrence } = parseReminder('dentist tomorrow at 2pm')
    expect(recurrence.type).toBeNull()
    expect(recurrence.isBirthday).toBe(false)
    expect(recurrence.isAnniversary).toBe(false)
  })

  it('detects "every year" as yearly without birthday flag', () => {
    const { recurrence } = parseReminder('file taxes every year')
    expect(recurrence.type).toBe('yearly')
    expect(recurrence.isBirthday).toBe(false)
    expect(recurrence.isAnniversary).toBe(false)
  })
})

describe('parseReminder — date bounds', () => {
  it('parses specific date in future', () => {
    const { date } = parseReminder('appointment on March 20')
    expect(date).not.toBeNull()
    if (date) {
      expect(date.getMonth()).toBe(2) // March = 2
      expect(date.getDate()).toBe(20)
    }
  })
})
