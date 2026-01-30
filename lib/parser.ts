import * as chrono from 'chrono-node'

export interface ParseResult {
  title: string
  date: Date | null
}

export function parseReminder(text: string): ParseResult {
  const parsed = chrono.parse(text)

  if (parsed.length === 0) {
    return { title: text, date: null }
  }

  const result = parsed[0]

  // If no time was explicitly specified, default to 8:00 AM
  const hasTime = result.start.isCertain('hour')
  const date = result.start.date()
  if (!hasTime) {
    date.setHours(8, 0, 0, 0)
  }

  // Remove the date/time portion from the text to get a clean title
  const dateText = result.text
  const title = text.replace(dateText, '').replace(/\s{2,}/g, ' ').trim()

  return {
    title: title || text,
    date,
  }
}
