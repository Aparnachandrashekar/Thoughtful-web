'use client'

export interface Reminder {
  id: string
  text: string
  date: Date
  isCompleted: boolean
  calendarEventId?: string
  isRecurring?: boolean
  isBirthday?: boolean
  isAnniversary?: boolean
}

interface ReminderListProps {
  reminders: Reminder[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

function formatDate(date: Date): string {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const isToday = date.toDateString() === now.toDateString()
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  if (isToday) {
    return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  if (isTomorrow) {
    return `Tomorrow at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }

  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function getCardColor(index: number): string {
  const colors = ['bg-blush/40', 'bg-lavender/40', 'bg-mint/40', 'bg-peach/40', 'bg-sky/40']
  return colors[index % colors.length]
}

export default function ReminderList({ reminders, onToggle, onDelete }: ReminderListProps) {
  if (reminders.length === 0) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <div className="text-6xl mb-4">✨</div>
        <p className="text-gray-500 text-lg">No reminders yet</p>
        <p className="text-gray-400 text-sm mt-1">Add one above to get started</p>
      </div>
    )
  }

  const upcoming = reminders
    .filter(r => !r.isCompleted)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const completed = reminders.filter(r => r.isCompleted)

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Upcoming
          </h2>
          <div className="space-y-3">
            {upcoming.map((reminder, index) => (
              <div
                key={reminder.id}
                className={`${getCardColor(index)} p-4 rounded-2xl animate-slide-up
                           hover:scale-[1.02] transition-transform cursor-pointer`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => onToggle(reminder.id)}
                    className="mt-1 w-5 h-5 rounded-full border-2 border-gray-400
                               hover:border-gray-600 transition-colors flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 font-medium">
                      {reminder.text}
                      {reminder.isRecurring && (
                        <span className="ml-2 text-xs text-gray-400" title="Recurring event">
                          {reminder.isBirthday ? '🎂' : reminder.isAnniversary ? '💝' : '🔄'}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">{formatDate(reminder.date)}</p>
                  </div>
                  <button
                    onClick={() => onDelete(reminder.id)}
                    className="text-gray-400 hover:text-gray-600 p-1 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
            Completed
          </h2>
          <div className="space-y-2">
            {completed.map((reminder) => (
              <div
                key={reminder.id}
                className="bg-sand/50 p-3 rounded-xl opacity-60"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onToggle(reminder.id)}
                    className="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center flex-shrink-0"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <p className="text-gray-500 line-through">{reminder.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
