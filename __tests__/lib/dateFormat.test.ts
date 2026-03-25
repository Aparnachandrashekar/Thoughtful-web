import { formatDate, getDateBounds } from '@/lib/dateFormat'

describe('formatDate', () => {
  const now = new Date('2026-03-12T14:00:00')

  it('returns "Today" for today with 24hr time', () => {
    const date = new Date('2026-03-12T09:30:00')
    expect(formatDate(date, now)).toBe('Today · 09:30')
  })

  it('returns "Tomorrow" for tomorrow with 24hr time', () => {
    const date = new Date('2026-03-13T18:00:00')
    expect(formatDate(date, now)).toBe('Tomorrow · 18:00')
  })

  it('returns weekday + short date for other dates (no am/pm)', () => {
    const date = new Date('2026-03-15T10:00:00')
    const result = formatDate(date, now)
    // Should not contain AM or PM
    expect(result).not.toMatch(/[AaPp][Mm]/)
    // Should contain something recognizable
    expect(result).toContain('Sun')
  })

  it('uses 24hr format (not 12hr) for today', () => {
    const date = new Date('2026-03-12T15:00:00')
    const result = formatDate(date, now)
    expect(result).toContain('15:00')
    expect(result).not.toMatch(/3:00\s*[Pp][Mm]/)
  })

  it('uses 24hr format for tomorrow', () => {
    const date = new Date('2026-03-13T08:05:00')
    const result = formatDate(date, now)
    expect(result).toContain('08:05')
  })
})

describe('getDateBounds', () => {
  it('returns min 10 years in the past', () => {
    const { min } = getDateBounds()
    const minYear = parseInt(min.slice(0, 4), 10)
    const currentYear = new Date().getFullYear()
    expect(minYear).toBe(currentYear - 10)
  })

  it('returns max 10 years in the future', () => {
    const { max } = getDateBounds()
    const maxYear = parseInt(max.slice(0, 4), 10)
    const currentYear = new Date().getFullYear()
    expect(maxYear).toBe(currentYear + 10)
  })

  it('returns dates in YYYY-MM-DD format', () => {
    const { min, max } = getDateBounds()
    expect(min).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(max).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
