import * as chrono from 'chrono-node'

export interface RecurrenceInfo {
  type: 'yearly' | 'monthly' | 'weekly' | 'daily' | null
  isBirthday: boolean
  isAnniversary: boolean
  needsEndDate: boolean
  // Advanced patterns
  interval?: number  // e.g., 2 for "every 2 weeks"
  byDay?: string  // e.g., "FR" for Friday, "MO" for Monday
  byMonthDay?: number  // e.g., 20 for "20th of the month"
  bySetPos?: number  // e.g., -1 for "last", 1 for "first"
  untilDate?: Date  // parsed "until" date
}

export interface ParseResult {
  title: string
  date: Date | null
  needsTimeConfirmation?: boolean
  suggestedHour?: number
  recurrence: RecurrenceInfo
}

const DAY_MAP: Record<string, string> = {
  'sunday': 'SU', 'sun': 'SU',
  'monday': 'MO', 'mon': 'MO',
  'tuesday': 'TU', 'tue': 'TU', 'tues': 'TU',
  'wednesday': 'WE', 'wed': 'WE',
  'thursday': 'TH', 'thu': 'TH', 'thur': 'TH', 'thurs': 'TH',
  'friday': 'FR', 'fri': 'FR',
  'saturday': 'SA', 'sat': 'SA'
}

// Parse "until XYZ date" from text
function parseUntilDate(text: string): Date | undefined {
  const untilMatch = text.match(/until\s+(.+?)(?:\s*$|,|\.|;)/i)
  if (untilMatch) {
    const parsed = chrono.parse(untilMatch[1])
    if (parsed.length > 0) {
      return parsed[0].start.date()
    }
  }
  return undefined
}

// Detect recurrence patterns in text
function detectRecurrence(text: string): RecurrenceInfo {
  const lowerText = text.toLowerCase()

  // Parse any "until" date first
  const untilDate = parseUntilDate(text)

  // Check for birthday/anniversary (auto-yearly, no end date needed)
  const isBirthday = /\b(birthday|bday|b-day)\b/i.test(text)
  const isAnniversary = /\b(anniversary|anniversaries)\b/i.test(text)

  if (isBirthday || isAnniversary) {
    return {
      type: 'yearly',
      isBirthday,
      isAnniversary,
      needsEndDate: false
    }
  }

  // Check for "every [day]" pattern (e.g., "every Friday", "every Monday")
  const everyDayMatch = lowerText.match(/every\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/i)
  if (everyDayMatch) {
    const dayName = everyDayMatch[1].toLowerCase()
    return {
      type: 'weekly',
      isBirthday: false,
      isAnniversary: false,
      needsEndDate: !untilDate,
      byDay: DAY_MAP[dayName],
      untilDate
    }
  }

  // Check for "alternating [day]" or "every other [day]" or "every 2 weeks on [day]"
  const alternatingMatch = lowerText.match(/(alternating|every\s+other|every\s+2\s+weeks?\s+on?)\s*(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)s?\b/i)
  if (alternatingMatch) {
    const dayName = alternatingMatch[2].toLowerCase()
    return {
      type: 'weekly',
      isBirthday: false,
      isAnniversary: false,
      needsEndDate: !untilDate,
      interval: 2,
      byDay: DAY_MAP[dayName],
      untilDate
    }
  }

  // Check for "day X of the month" or "Xth of every month" (e.g., "day 20 of the month", "15th of every month")
  const monthDayMatch = lowerText.match(/(?:day\s+(\d{1,2})\s+of\s+(?:the\s+)?month|(\d{1,2})(?:st|nd|rd|th)?\s+of\s+every\s+month|every\s+month\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?)/i)
  if (monthDayMatch) {
    const dayNum = parseInt(monthDayMatch[1] || monthDayMatch[2] || monthDayMatch[3], 10)
    if (dayNum >= 1 && dayNum <= 31) {
      return {
        type: 'monthly',
        isBirthday: false,
        isAnniversary: false,
        needsEndDate: !untilDate,
        byMonthDay: dayNum,
        untilDate
      }
    }
  }

  // Check for "last/first [day] of the month" (e.g., "last Saturday of the month", "first Monday of the month")
  const positionDayMatch = lowerText.match(/(last|first|second|third|fourth)\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\s+of\s+(?:the\s+)?month/i)
  if (positionDayMatch) {
    const positionMap: Record<string, number> = {
      'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'last': -1
    }
    const position = positionMap[positionDayMatch[1].toLowerCase()]
    const dayName = positionDayMatch[2].toLowerCase()
    return {
      type: 'monthly',
      isBirthday: false,
      isAnniversary: false,
      needsEndDate: !untilDate,
      byDay: DAY_MAP[dayName],
      bySetPos: position,
      untilDate
    }
  }

  // Check for explicit recurrence keywords
  if (/\b(every\s+year|yearly|annual|annually)\b/i.test(text)) {
    return { type: 'yearly', isBirthday: false, isAnniversary: false, needsEndDate: !untilDate, untilDate }
  }

  if (/\b(every\s+month|monthly)\b/i.test(text)) {
    return { type: 'monthly', isBirthday: false, isAnniversary: false, needsEndDate: !untilDate, untilDate }
  }

  if (/\b(every\s+week|weekly)\b/i.test(text)) {
    return { type: 'weekly', isBirthday: false, isAnniversary: false, needsEndDate: !untilDate, untilDate }
  }

  if (/\b(every\s+day|daily)\b/i.test(text)) {
    return { type: 'daily', isBirthday: false, isAnniversary: false, needsEndDate: !untilDate, untilDate }
  }

  return { type: null, isBirthday: false, isAnniversary: false, needsEndDate: false }
}

// Clean recurrence keywords from title
function cleanRecurrenceFromTitle(title: string): string {
  return title
    // Basic patterns
    .replace(/\b(every\s+year|yearly|annual|annually)\b/gi, '')
    .replace(/\b(every\s+month|monthly)\b/gi, '')
    .replace(/\b(every\s+week|weekly)\b/gi, '')
    .replace(/\b(every\s+day|daily)\b/gi, '')
    // Every [day] pattern
    .replace(/\bevery\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/gi, '')
    // Alternating patterns
    .replace(/\b(alternating|every\s+other|every\s+2\s+weeks?\s+on?)\s*(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)s?\b/gi, '')
    // Day X of month patterns
    .replace(/\bday\s+\d{1,2}\s+of\s+(?:the\s+)?month\b/gi, '')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+of\s+every\s+month\b/gi, '')
    .replace(/\bevery\s+month\s+on\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\b/gi, '')
    // Position day of month patterns
    .replace(/\b(last|first|second|third|fourth)\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\s+of\s+(?:the\s+)?month\b/gi, '')
    // Until date pattern
    .replace(/\buntil\s+.+?(?:\s*$|,|\.|;)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Preprocess text to handle negations and complex patterns
function preprocessText(text: string): string {
  let processed = text

  // Handle "not today, but tomorrow" → "tomorrow"
  processed = processed.replace(/not\s+today[,]?\s*(but\s+)?/gi, '')

  // Handle "not tomorrow, but" → remove the negated part
  processed = processed.replace(/not\s+tomorrow[,]?\s*(but\s+)?/gi, '')

  // Handle "not this week, but next week" → "next week"
  processed = processed.replace(/not\s+this\s+week[,]?\s*(but\s+)?/gi, '')

  // Handle "not Monday, but Tuesday" → "Tuesday"
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  for (const day of days) {
    const regex = new RegExp(`not\\s+${day}[,]?\\s*(but\\s+)?`, 'gi')
    processed = processed.replace(regex, '')
  }

  return processed.trim()
}

// Fix ambiguous hours - default to PM for typical reminder hours (1-7)
function fixAmbiguousHour(date: Date, hasExplicitMeridiem: boolean): { date: Date; needsConfirmation: boolean } {
  if (hasExplicitMeridiem) {
    return { date, needsConfirmation: false }
  }

  const hour = date.getHours()

  // If hour is 1-7 (which chrono defaults to AM), switch to PM
  // because people rarely set reminders for 1am-7am
  if (hour >= 1 && hour <= 7) {
    date.setHours(hour + 12)
    return { date, needsConfirmation: false }
  }

  // 8-11 AM is reasonable for morning reminders, keep as is
  // 12-23 (noon to 11pm) is already PM, keep as is

  return { date, needsConfirmation: false }
}

export function parseReminder(text: string): ParseResult {
  // Detect recurrence first
  const recurrence = detectRecurrence(text)

  // Preprocess to handle negations
  const processedText = preprocessText(text)

  const parsed = chrono.parse(processedText)

  if (parsed.length === 0) {
    return { title: text, date: null, recurrence }
  }

  const result = parsed[0]

  // Check if time was explicitly specified
  const hasTime = result.start.isCertain('hour')
  const hasExplicitMeridiem = result.start.isCertain('meridiem')

  let date = result.start.date()

  if (!hasTime) {
    // No time specified, default to 8:00 AM
    date.setHours(8, 0, 0, 0)
  } else {
    // Time specified but maybe ambiguous (no AM/PM)
    const fixed = fixAmbiguousHour(date, hasExplicitMeridiem)
    date = fixed.date
  }

  // Remove the date/time portion from the text to get a clean title
  // Use original text for title extraction
  const dateText = result.text
  let title = text
    .replace(new RegExp(dateText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
    .replace(/not\s+(today|tomorrow)[,]?\s*(but\s+)?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Clean up common leftover words
  title = title.replace(/^(at|on|for|by)\s+/i, '').trim()

  // Clean recurrence keywords from title
  title = cleanRecurrenceFromTitle(title)

  return {
    title: title || text,
    date,
    recurrence,
  }
}
