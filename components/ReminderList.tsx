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
  // WhatsApp / trigger fields
  message?: string
  personName?: string
  phoneNumber?: string
  whatsappLink?: string
  triggerAt?: number    // UNIX timestamp in ms
  createdAt?: number    // UNIX timestamp in ms
  triggered?: boolean   // true after notification fired
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
      <div className="text-center py-8 sm:py-12 animate-fade-in">
        <div className="text-5xl sm:text-6xl mb-4">✨</div>
        <p className="text-gray-500 text-base sm:text-lg">No reminders yet</p>
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
          <div className="space-y-2 sm:space-y-3">
            {upcoming.map((reminder, index) => (
              <div
                key={reminder.id}
                className={`${getCardColor(index)} p-3.5 sm:p-5 rounded-2xl animate-slide-up
                           hover:scale-[1.01] hover:shadow-md transition-all duration-200`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <button
                    onClick={() => onToggle(reminder.id)}
                    className="mt-1 w-5 h-5 rounded-full border-2 border-gray-400
                               hover:border-gray-600 transition-colors flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 font-semibold text-base sm:text-lg leading-snug">
                      {reminder.text}
                      {reminder.isRecurring && (
                        <span className="ml-2 text-sm" title="Recurring event">
                          {reminder.isBirthday ? '🎂' : reminder.isAnniversary ? '💝' : '🔄'}
                        </span>
                      )}
                    </p>
                    <p className="text-sm sm:text-base text-gray-600 mt-1.5 sm:mt-2">{formatDate(reminder.date)}</p>
                  </div>
                  <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        const phone = reminder.phoneNumber ? reminder.phoneNumber.replace(/[^0-9]/g, '') : ''
                        const msg = 'Hey!'
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
                      }}
                      className="text-gray-400 hover:text-green-600 p-1.5 sm:p-2 hover:bg-white/50 rounded-xl transition-all"
                      title="Send via WhatsApp"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(reminder.id)}
                      className="text-gray-400 hover:text-red-500 p-1.5 sm:p-2 hover:bg-white/50 rounded-xl transition-all"
                      title="Delete reminder"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
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
                  className="bg-sand/50 p-3 sm:p-4 rounded-xl opacity-60 hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      onClick={() => onToggle(reminder.id)}
                      className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-500 line-through text-sm sm:text-base">{reminder.text}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {reminder.date < now && !reminder.isCompleted ? 'Auto-completed' : 'Done'}
                      </p>
                    </div>
                    <button
                      onClick={() => onDelete(reminder.id)}
                      className="text-gray-300 hover:text-red-400 p-1.5 hover:bg-white/50 rounded-lg transition-all flex-shrink-0"
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
