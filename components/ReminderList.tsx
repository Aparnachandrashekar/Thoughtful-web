'use client'

import { useState } from 'react'

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
  const colors = ['bg-blush/60', 'bg-lavender/60', 'bg-mint/60', 'bg-peach/60', 'bg-sky/60']
  return colors[index % colors.length]
}

export default function ReminderList({ reminders, onToggle, onDelete }: ReminderListProps) {
  const [showCompleted, setShowCompleted] = useState(true)

  if (reminders.length === 0) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <div className="text-6xl mb-4">✨</div>
        <p className="text-gray-500 text-lg">No reminders yet</p>
        <p className="text-gray-400 text-sm mt-1">Add one above to get started</p>
      </div>
    )
  }

  const now = new Date()

  // Split into upcoming and past based on date
  // Past events are auto-completed
  const upcoming = reminders
    .filter(r => !r.isCompleted && r.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  // Completed = manually marked OR date has passed
  const completed = reminders.filter(r => r.isCompleted || r.date < now)

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Upcoming ({upcoming.length})
          </h2>
          <div className="space-y-3">
            {upcoming.map((reminder, index) => (
              <div
                key={reminder.id}
                className={`${getCardColor(index)} p-5 rounded-2xl animate-slide-up
                           hover:scale-[1.01] hover:shadow-md transition-all duration-200`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => onToggle(reminder.id)}
                    className="mt-1 w-5 h-5 rounded-full border-2 border-gray-400
                               hover:border-gray-600 transition-colors flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 font-semibold text-lg leading-snug">
                      {reminder.text}
                      {reminder.isRecurring && (
                        <span className="ml-2 text-sm" title="Recurring event">
                          {reminder.isBirthday ? '🎂' : reminder.isAnniversary ? '💝' : '🔄'}
                        </span>
                      )}
                    </p>
                    <p className="text-base text-gray-600 mt-2">{formatDate(reminder.date)}</p>
                  </div>
                  <button
                    onClick={() => onDelete(reminder.id)}
                    className="text-gray-400 hover:text-red-500 p-2 hover:bg-white/50 rounded-xl transition-all"
                    title="Delete reminder"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
              Completed ({completed.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100"
              >
                {showCompleted ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {showCompleted && (
            <div className="space-y-2">
              {completed.map((reminder) => (
                <div
                  key={reminder.id}
                  className="bg-sand/50 p-4 rounded-xl opacity-60 hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onToggle(reminder.id)}
                      className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-500 line-through">{reminder.text}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {reminder.date < now && !reminder.isCompleted ? 'Auto-completed' : 'Done'}
                      </p>
                    </div>
                    <button
                      onClick={() => onDelete(reminder.id)}
                      className="text-gray-300 hover:text-red-400 p-1.5 hover:bg-white/50 rounded-lg transition-all"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
