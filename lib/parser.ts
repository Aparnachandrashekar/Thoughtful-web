import * as chrono from 'chrono-node'

// Preprocess time formats that chrono struggles with
function preprocessTimeFormats(text: string): string {
  let processed = text

  // Fix malformed times like "7:PM" → "7PM", "3:AM" → "3AM"
  processed = processed.replace(/(\d{1,2}):([AP]M)/gi, '$1$2')

  // Fix "7: PM" or "7 :PM" → "7PM"
  processed = processed.replace(/(\d{1,2})\s*:\s*([AP]M)/gi, '$1$2')

  // Add "at" before standalone times like "5:00" or "5:00PM" that don't have context
  // This helps chrono parse them correctly
  processed = processed.replace(/\b(\d{1,2}:\d{2})\s*(am|pm)?\b(?!\s*(am|pm))/gi, (match, time, meridiem) => {
    // If there's already a meridiem or the word "at" before, don't modify
    if (processed.indexOf('at ' + match) !== -1) return match
    return 'at ' + time + (meridiem || '')
  })

  return processed
}

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
  // For patterns where we calculate the date ourselves
  calculatedDate?: Date
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

const DAY_TO_NUM: Record<string, number> = {
  'sunday': 0, 'sun': 0,
  'monday': 1, 'mon': 1,
  'tuesday': 2, 'tue': 2, 'tues': 2,
  'wednesday': 3, 'wed': 3,
  'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
  'friday': 5, 'fri': 5,
  'saturday': 6, 'sat': 6
}

// Get next occurrence of a specific weekday
function getNextWeekday(dayNum: number): Date {
  const today = new Date()
  const currentDay = today.getDay()
  let daysUntil = dayNum - currentDay
  if (daysUntil <= 0) daysUntil += 7  // Next week if today or past
  const result = new Date(today)
  result.setDate(today.getDate() + daysUntil)
  result.setHours(8, 0, 0, 0)  // Default 8 AM
  return result
}

// Get the Nth occurrence of a weekday in a month (or last if position is -1)
function getNthWeekdayOfMonth(dayNum: number, position: number, referenceDate?: Date): Date {
  const today = referenceDate || new Date()
  let year = today.getFullYear()
  let month = today.getMonth()

  // Start with current month, but if the date has passed, use next month
  let result = calculateNthWeekday(year, month, dayNum, position)

  // If the calculated date is in the past, try next month
  if (result <= today) {
    month++
    if (month > 11) {
      month = 0
      year++
    }
    result = calculateNthWeekday(year, month, dayNum, position)
  }

  result.setHours(8, 0, 0, 0)
  return result
}

function calculateNthWeekday(year: number, month: number, dayNum: number, position: number): Date {
  if (position === -1) {
    // Last occurrence of the weekday in the month
    const lastDay = new Date(year, month + 1, 0)  // Last day of month
    const lastDayOfWeek = lastDay.getDay()
    let diff = lastDayOfWeek - dayNum
    if (diff < 0) diff += 7
    return new Date(year, month, lastDay.getDate() - diff)
  } else {
    // Nth occurrence (1st, 2nd, 3rd, 4th)
    const firstDay = new Date(year, month, 1)
    const firstDayOfWeek = firstDay.getDay()
    let diff = dayNum - firstDayOfWeek
    if (diff < 0) diff += 7
    const firstOccurrence = 1 + diff
    const nthOccurrence = firstOccurrence + (position - 1) * 7
    return new Date(year, month, nthOccurrence)
  }
}

// Get next occurrence of a specific day of month
function getNextMonthDay(dayOfMonth: number): Date {
  const today = new Date()
  let year = today.getFullYear()
  let month = today.getMonth()

  let result = new Date(year, month, dayOfMonth)

  // If this day has passed this month, use next month
  if (result <= today) {
    month++
    if (month > 11) {
      month = 0
      year++
    }
    result = new Date(year, month, dayOfMonth)
  }

  result.setHours(8, 0, 0, 0)
  return result
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
  const everyDayMatch = lowerText.match(/every\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)s?\b/i)
  if (everyDayMatch) {
    const dayName = everyDayMatch[1].toLowerCase()
    const dayNum = DAY_TO_NUM[dayName]
    return {
      type: 'weekly',
      isBirthday: false,
      isAnniversary: false,
      needsEndDate: !untilDate,
      byDay: DAY_MAP[dayName],
      untilDate,
      calculatedDate: getNextWeekday(dayNum)
    }
  }

  // Check for "alternating [day]" or "every other [day]" or "every 2 weeks on [day]"
  const alternatingMatch = lowerText.match(/(alternating|every\s+other|every\s+2\s+weeks?\s+on?)\s*(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)s?\b/i)
  if (alternatingMatch) {
    const dayName = alternatingMatch[2].toLowerCase()
    const dayNum = DAY_TO_NUM[dayName]
    return {
      type: 'weekly',
      isBirthday: false,
      isAnniversary: false,
      needsEndDate: !untilDate,
      interval: 2,
      byDay: DAY_MAP[dayName],
      untilDate,
      calculatedDate: getNextWeekday(dayNum)
    }
  }

  // Check for "last/first [day] of the month" BEFORE general day matching
  // (e.g., "last Saturday of the month", "first Monday of the month")
  const positionDayMatch = lowerText.match(/(last|first|second|third|fourth)\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)(?:day)?\s+of\s+(?:the\s+)?(?:every\s+)?month/i)
  if (positionDayMatch) {
    const positionMap: Record<string, number> = {
      'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'last': -1
    }
    const position = positionMap[positionDayMatch[1].toLowerCase()]
    const dayName = positionDayMatch[2].toLowerCase()
    const dayNum = DAY_TO_NUM[dayName]
    return {
      type: 'monthly',
      isBirthday: false,
      isAnniversary: false,
      needsEndDate: !untilDate,
      byDay: DAY_MAP[dayName],
      bySetPos: position,
      untilDate,
      calculatedDate: getNthWeekdayOfMonth(dayNum, position)
    }
  }

  // Check for "day X of the month" or "Xth of every month" (e.g., "day 20 of the month", "15th of every month")
  const monthDayMatch = lowerText.match(/(?:day\s+(\d{1,2})\s+of\s+(?:the\s+)?(?:every\s+)?month|(\d{1,2})(?:st|nd|rd|th)?\s+of\s+every\s+month|every\s+month\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?)/i)
  if (monthDayMatch) {
    const dayNum = parseInt(monthDayMatch[1] || monthDayMatch[2] || monthDayMatch[3], 10)
    if (dayNum >= 1 && dayNum <= 31) {
      return {
        type: 'monthly',
        isBirthday: false,
        isAnniversary: false,
        needsEndDate: !untilDate,
        byMonthDay: dayNum,
        untilDate,
        calculatedDate: getNextMonthDay(dayNum)
      }
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

  if (/\b(every\s*day|everyday|daily)\b/i.test(text)) {
    // Calculate tomorrow as first occurrence for daily
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(8, 0, 0, 0)
    return {
      type: 'daily',
      isBirthday: false,
      isAnniversary: false,
      needsEndDate: !untilDate,
      untilDate,
      calculatedDate: tomorrow
    }
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
    .replace(/\b(every\s*day|everyday|daily)\b/gi, '')
    // Every [day] pattern (with optional 's' at end)
    .replace(/\bevery\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)s?\b/gi, '')
    // Alternating patterns
    .replace(/\b(alternating|every\s+other|every\s+2\s+weeks?\s+on?)\s*(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)s?\b/gi, '')
    // Day X of month patterns
    .replace(/\bday\s+\d{1,2}\s+of\s+(?:the\s+)?(?:every\s+)?month\b/gi, '')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+of\s+every\s+month\b/gi, '')
    .replace(/\bevery\s+month\s+on\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\b/gi, '')
    // Position day of month patterns (with optional 'day' suffix like 'saturday' vs 'sat')
    .replace(/\b(last|first|second|third|fourth)\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)(?:day)?\s+of\s+(?:the\s+)?(?:every\s+)?month\b/gi, '')
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

// Extract specific day of month from text like "on 20", "the 20th", "on the 15th"
function extractDayOfMonth(text: string): number | null {
  // Match patterns like "on 20", "on the 20", "the 20th", "on 15th"
  const match = text.match(/(?:on\s+(?:the\s+)?|the\s+)(\d{1,2})(?:st|nd|rd|th)?\b/i)
  if (match) {
    const day = parseInt(match[1], 10)
    if (day >= 1 && day <= 31) {
      return day
    }
  }
  return null
}

// Build a date for a specific day of month, preferring next occurrence
function buildDateForDayOfMonth(dayOfMonth: number): Date {
  const today = new Date()
  let year = today.getFullYear()
  let month = today.getMonth()

  let result = new Date(year, month, dayOfMonth, 8, 0, 0, 0)

  // If this day has passed this month, use next month
  if (result <= today) {
    month++
    if (month > 11) {
      month = 0
      year++
    }
    result = new Date(year, month, dayOfMonth, 8, 0, 0, 0)
  }

  return result
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

// Extract a clean, meaningful title from the input text
function extractTitle(text: string): string {
  let title = text

  // Remove common date/time phrases
  title = title
    // Time patterns
    .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '')
    // Relative dates
    .replace(/\b(today|tonight|tomorrow|yesterday)\b/gi, '')
    .replace(/\b(this|next|last)\s+(week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    // Specific dates
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(st|nd|rd|th)?(,?\s+\d{4})?\b/gi, '')
    .replace(/\b\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, '')
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, '')
    // Day names
    .replace(/\b(on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    // Filler words at start
    .replace(/^(is|it's|it is|that|remind me to|remind me that|reminder|remember to|remember that|don't forget to|don't forget)\s+/i, '')
    // Filler words anywhere
    .replace(/\b(is on|is at|is|are)\b/gi, '')

  // Clean recurrence patterns from title
  title = cleanRecurrenceFromTitle(title)

  // Clean up
  title = title
    .replace(/^[\s,.\-:]+/, '')  // Remove leading punctuation
    .replace(/[\s,.\-:]+$/, '')  // Remove trailing punctuation
    .replace(/\s{2,}/g, ' ')     // Collapse multiple spaces
    .trim()

  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1)
  }

  return title
}

export function parseReminder(text: string): ParseResult {
  // Detect recurrence first - this may calculate the date for us
  const recurrence = detectRecurrence(text)

  // If recurrence detection calculated a date, use that
  if (recurrence.calculatedDate) {
    const title = extractTitle(text)
    return {
      title: title || text,
      date: recurrence.calculatedDate,
      recurrence,
    }
  }

  // Check for explicit day of month pattern like "on 20", "the 15th"
  // This takes priority because chrono often misinterprets these
  const explicitDay = extractDayOfMonth(text)
  if (explicitDay) {
    const title = extractTitle(text)
    return {
      title: title || text,
      date: buildDateForDayOfMonth(explicitDay),
      recurrence,
    }
  }

  // Preprocess to handle negations and fix time formats
  let processedText = preprocessText(text)
  processedText = preprocessTimeFormats(processedText)

  const parsed = chrono.parse(processedText)

  if (parsed.length === 0) {
    // No date found - extract title anyway for the date picker modal
    const title = extractTitle(text)
    return { title: title || text, date: null, recurrence }
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

  // Extract clean title
  const title = extractTitle(text)

  return {
    title: title || text,
    date,
    recurrence,
  }
}
