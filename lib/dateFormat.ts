// Shared date formatting utilities

export function formatDate(date: Date, now: Date): string {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const isToday    = date.toDateString() === now.toDateString()
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  if (isToday) {
    return `Today · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
  }
  if (isTomorrow) {
    return `Tomorrow · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
  }
  return date.toLocaleDateString([], {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    hour:    '2-digit',
    minute:  '2-digit',
    hour12:  false,
  })
}

export function getDateBounds(): { min: string; max: string } {
  const now = new Date()
  const min = new Date(now); min.setFullYear(now.getFullYear() - 10)
  const max = new Date(now); max.setFullYear(now.getFullYear() + 10)
  return {
    min: min.toISOString().slice(0, 10),
    max: max.toISOString().slice(0, 10),
  }
}
