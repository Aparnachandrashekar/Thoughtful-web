'use client'

import { useState, useEffect } from 'react'
import { Person } from '@/lib/types'
import { formatDate } from '@/lib/dateFormat'
import WhatsAppButton from '@/components/WhatsAppButton'

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
  const phone = findPhoneForReminder(reminder, people)

  // Link to the day view in Google Calendar rather than the specific event URL.
  // The event htmlLink (https://www.google.com/calendar/event?eid=...) fails on iOS
  // when the Google Calendar app can't resolve it cross-account. The day view URL
  // always works as long as the user is signed into Google in Safari.
  const calendarDayUrl = (reminder.calendarHtmlLink || reminder.calendarEventId)
    ? (() => {
        const d = reminder.date instanceof Date ? reminder.date : new Date(reminder.date)
        return `https://calendar.google.com/calendar/r/day/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
      })()
    : null

  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      {calendarDayUrl && (
        <a
          href={calendarDayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-terra/40 hover:text-terra rounded-xl
                     hover:bg-blush-pale transition-all duration-150"
          title="View in Google Calendar"
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
      <WhatsAppButton phone={phone} />
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
  const [now, setNow] = useState(() => new Date())

  // Re-render every minute so expired reminders move to History automatically (#17)
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  if (reminders.length === 0) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <p className="text-terra/40 text-base font-light">No reminders yet</p>
        <p className="text-terra/30 text-sm mt-1 font-light">Add one above to get started</p>
      </div>
    )
  }


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
                      {formatDate(reminder.date, now)}
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
                        {formatDate(reminder.date, now)}
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
