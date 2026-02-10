import * as chrono from 'chrono-node'

export interface ParseResult {
  title: string
  date: Date | null
  needsTimeConfirmation?: boolean
  suggestedHour?: number
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
  // Preprocess to handle negations
  const processedText = preprocessText(text)

  const parsed = chrono.parse(processedText)

  if (parsed.length === 0) {
    return { title: text, date: null }
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

  return {
    title: title || text,
    date,
  }
}
