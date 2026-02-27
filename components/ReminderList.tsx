'use client'

import { useState } from 'react'
import { Person } from '@/lib/types'

export interface Reminder {
  id: string
  text: string
  date: Date
  isCompleted: boolean
  calendarEventId?: string
  calendarHtmlLink?: string
  lastSyncedAt?: number
  originalStartTime?: string
  isRecurring?: boolean
  isBirthday?: boolean
  isAnniversary?: boolean
  // WhatsApp / trigger fields
  message?: string
  personName?: string
  phoneNumber?: string
  whatsappLink?: string
  triggerAt?: number
  createdAt?: number
  triggered?: boolean
}

interface ReminderListProps {
  reminders: Reminder[]
  people?: Person[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit?: (id: string) => void
}

function formatDate(date: Date): string {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const isToday    = date.toDateString() === now.toDateString()
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  if (isToday) {
    return `Today · ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  if (isTomorrow) {
    return `Tomorrow · ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  return date.toLocaleDateString([], {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    hour:    'numeric',
    minute:  '2-digit',
  })
}

function findPhoneForReminder(reminder: Reminder, people?: Person[]): string {
  if (reminder.phoneNumber) return reminder.phoneNumber.replace(/[^0-9]/g, '')
  if (!people || people.length === 0) return ''

  const linked = people.find(p => p.phone && p.linkedReminderIds.includes(reminder.id))
  if (linked?.phone) return linked.phone.replace(/[^0-9]/g, '')

  if (reminder.personName) {
    const named = people.find(p => p.phone && p.name.toLowerCase() === reminder.personName!.toLowerCase())
    if (named?.phone) return named.phone.replace(/[^0-9]/g, '')
  }

  const textLower = reminder.text.toLowerCase()
  const textMatch = people.find(p => p.phone && textLower.includes(p.name.toLowerCase()))
  if (textMatch?.phone) return textMatch.phone.replace(/[^0-9]/g, '')

  return ''
}

function recurringLabel(reminder: Reminder): string {
  if (reminder.isBirthday) return 'Yearly · Birthday'
  if (reminder.isAnniversary) return 'Yearly · Anniversary'
  return 'Recurring'
}

function recurringEmoji(reminder: Reminder): string {
  if (reminder.isBirthday) return '🎂'
  if (reminder.isAnniversary) return '💝'
  return '🔄'
}

// Shared action buttons used in both Upcoming and Recurring cards
function ActionButtons({
  reminder, people, onEdit, onDelete
}: {
  reminder: Reminder
  people?: Person[]
  onEdit?: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      {reminder.calendarHtmlLink && (
        <a
          href={reminder.calendarHtmlLink}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-terra/40 hover:text-terra rounded-xl
                     hover:bg-blush-pale transition-all duration-150"
          title="Open in Google Calendar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </a>
      )}
      {onEdit && (
        <button
          onClick={() => onEdit(reminder.id)}
          className="p-1.5 text-terra/40 hover:text-terra rounded-xl
                     hover:bg-blush-pale transition-all duration-150"
          title="Edit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}
      <button
        onClick={() => {
          const phone = findPhoneForReminder(reminder, people)
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent('Hey!')}`, '_blank')
        }}
        className="p-1.5 text-terra/40 hover:text-green-600 rounded-xl
                   hover:bg-green-50 transition-all duration-150"
        title="Send via WhatsApp"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </button>
      <button
        onClick={() => onDelete(reminder.id)}
        className="p-1.5 text-terra/40 hover:text-red-400 rounded-xl
                   hover:bg-red-50 transition-all duration-150"
        title="Delete"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function ReminderList({ reminders, people, onToggle, onDelete, onEdit }: ReminderListProps) {
  const [showCompleted, setShowCompleted] = useState(true)
  const [showRecurring, setShowRecurring] = useState(true)

  if (reminders.length === 0) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <p className="text-terra/40 text-base font-light">No reminders yet</p>
        <p className="text-terra/30 text-sm mt-1 font-light">Add one above to get started</p>
      </div>
    )
  }

  const now = new Date()

  // Recurring reminders get their own section — never fall into History
  const recurring = reminders
    .filter(r => r.isRecurring && !r.isCompleted)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const nonRecurring = reminders.filter(r => !r.isRecurring)
  const upcoming = nonRecurring
    .filter(r => !r.isCompleted && r.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  const completed = nonRecurring.filter(r => r.isCompleted || r.date < now)

  return (
    <div className="space-y-8">

      {/* ── Upcoming ── */}
      {upcoming.length > 0 && (
        <div className="animate-fade-up delay-100">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold text-terra/50 uppercase tracking-[0.15em]">
              Upcoming
            </span>
            <span className="text-xs text-terra/30 font-light">{upcoming.length}</span>
            <div className="flex-1 h-px bg-terra/10" />
          </div>

          <div className="space-y-3">
            {upcoming.map((reminder, index) => (
              <div
                key={reminder.id}
                className="group bg-white rounded-2xl px-6 py-5
                           border border-blush-light/60
                           shadow-[0_2px_12px_rgba(212,117,106,0.06)]
                           hover:shadow-[0_6px_24px_rgba(212,117,106,0.12)]
                           hover:-translate-y-0.5
                           transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                           animate-fade-up"
                style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-start gap-3.5">
                  {/* Circle toggle */}
                  <button
                    onClick={() => onToggle(reminder.id)}
                    className="mt-0.5 w-5 h-5 rounded-full border-2 border-terra/30
                               hover:border-terra hover:bg-terra/10
                               flex-shrink-0 transition-all duration-200 active:scale-90"
                    aria-label="Mark complete"
                  />
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[#2D1810] font-medium text-sm sm:text-base leading-snug">
                      {reminder.text}
                    </p>
                    <p className="text-terra/50 text-xs sm:text-sm mt-1 font-light">
                      {formatDate(reminder.date)}
                    </p>
                  </div>
                  <ActionButtons reminder={reminder} people={people} onEdit={onEdit} onDelete={onDelete} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recurring ── */}
      {recurring.length > 0 && (
        <div className="animate-fade-up delay-150">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold text-terra/50 uppercase tracking-[0.15em]">
              Recurring
            </span>
            <span className="text-xs text-terra/30 font-light">{recurring.length}</span>
            <div className="flex-1 h-px bg-terra/10" />
            <button
              onClick={() => setShowRecurring(!showRecurring)}
              className="text-xs text-terra/30 hover:text-terra/60 transition-colors px-2 py-0.5
                         rounded-pill hover:bg-blush-pale"
            >
              {showRecurring ? 'Hide' : 'Show'}
            </button>
          </div>

          {showRecurring && (
            <div className="space-y-3">
              {recurring.map((reminder, index) => (
                <div
                  key={reminder.id}
                  className="group bg-white rounded-2xl px-6 py-5
                             border border-blush-light/60
                             shadow-[0_2px_12px_rgba(212,117,106,0.06)]
                             hover:shadow-[0_6px_24px_rgba(212,117,106,0.12)]
                             hover:-translate-y-0.5
                             transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                             animate-fade-up"
                  style={{ animationDelay: `${index * 55}ms`, animationFillMode: 'both' }}
                >
                  <div className="flex items-start gap-3.5">
                    <span className="mt-0.5 text-base flex-shrink-0">
                      {recurringEmoji(reminder)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#2D1810] font-medium text-sm sm:text-base leading-snug">
                        {reminder.text}
                      </p>
                      <p className="text-terra/45 text-xs sm:text-sm mt-1 font-light">
                        {formatDate(reminder.date)}
                        <span className="mx-1.5 text-terra/25">·</span>
                        <span className="text-terra/40">{recurringLabel(reminder)}</span>
                      </p>
                    </div>
                    <ActionButtons reminder={reminder} people={people} onEdit={onEdit} onDelete={onDelete} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── History ── */}
      {completed.length > 0 && (
        <div className="animate-fade-up delay-200">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold text-terra/30 uppercase tracking-[0.15em]">
              History
            </span>
            <span className="text-xs text-terra/20 font-light">{completed.length}</span>
            <div className="flex-1 h-px bg-terra/8" />
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="text-xs text-terra/30 hover:text-terra/60 transition-colors px-2 py-0.5
                         rounded-pill hover:bg-blush-pale"
            >
              {showCompleted ? 'Hide' : 'Show'}
            </button>
          </div>

          {showCompleted && (
            <div className="space-y-2">
              {completed.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-center gap-3.5 px-6 py-4 rounded-2xl
                             bg-blush-pale/40 hover:bg-blush-pale/60
                             transition-colors duration-200 group"
                >
                  <button
                    onClick={() => onToggle(reminder.id)}
                    className="w-5 h-5 rounded-full bg-terra/20 flex items-center justify-center
                               flex-shrink-0 hover:bg-terra/30 transition-colors active:scale-90"
                    aria-label="Restore reminder"
                  >
                    <svg className="w-2.5 h-2.5 text-terra/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-terra/40 line-through text-sm font-light truncate">
                      {reminder.text}
                    </p>
                    <p className="text-terra/25 text-xs mt-0.5 font-light">
                      {reminder.date < now && !reminder.isCompleted ? 'Past' : 'Completed'}
                    </p>
                  </div>
                  <button
                    onClick={() => onDelete(reminder.id)}
                    className="text-terra/20 hover:text-red-400 p-1 rounded-lg
                               opacity-0 group-hover:opacity-100
                               transition-all duration-150 flex-shrink-0"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
