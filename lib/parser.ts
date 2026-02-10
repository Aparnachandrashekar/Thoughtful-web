import * as chrono from 'chrono-node'

export interface RecurrenceInfo {
  type: 'yearly' | 'monthly' | 'weekly' | 'daily' | null
  isBirthday: boolean
  isAnniversary: boolean
  needsEndDate: boolean
}

export interface ParseResult {
  title: string
  date: Date | null
  needsTimeConfirmation?: boolean
  suggestedHour?: number
  recurrence: RecurrenceInfo
}

// Detect recurrence patterns in text
function detectRecurrence(text: string): RecurrenceInfo {
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

  // Check for explicit recurrence keywords
  if (/\b(every\s+year|yearly|annual|annually)\b/i.test(text)) {
    return { type: 'yearly', isBirthday: false, isAnniversary: false, needsEndDate: true }
  }

  if (/\b(every\s+month|monthly)\b/i.test(text)) {
    return { type: 'monthly', isBirthday: false, isAnniversary: false, needsEndDate: true }
  }

  if (/\b(every\s+week|weekly)\b/i.test(text)) {
    return { type: 'weekly', isBirthday: false, isAnniversary: false, needsEndDate: true }
  }

  if (/\b(every\s+day|daily)\b/i.test(text)) {
    return { type: 'daily', isBirthday: false, isAnniversary: false, needsEndDate: true }
  }

  return { type: null, isBirthday: false, isAnniversary: false, needsEndDate: false }
}

// Clean recurrence keywords from title
function cleanRecurrenceFromTitle(title: string): string {
  return title
    .replace(/\b(every\s+year|yearly|annual|annually)\b/gi, '')
    .replace(/\b(every\s+month|monthly)\b/gi, '')
    .replace(/\b(every\s+week|weekly)\b/gi, '')
    .replace(/\b(every\s+day|daily)\b/gi, '')
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
