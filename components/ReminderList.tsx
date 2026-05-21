'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Person } from '@/lib/types'
import { formatDate } from '@/lib/dateFormat'
import WhatsAppButton from '@/components/WhatsAppButton'
import { copy } from '@/lib/copy'

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
  newReminderId?: string | null
}

const ICON_CLASS = 'w-4 h-4 sm:w-5 sm:h-5'
const ACTION_BTN =
  'p-1.5 sm:p-2 text-ink-faint hover:text-ink hover:bg-white/70 rounded-lg transition-all duration-150'
const SECTION_RULE = 'border-0 border-t border-white h-px w-full'
const SECTION_LABEL =
  'font-outfit text-sm sm:text-[15px] font-semibold text-ink-muted tracking-wide py-2 sm:py-3'
const CARD_TITLE =
  'font-sans text-[15px] sm:text-[17px] font-bold text-ink leading-snug tracking-tight break-words'
const CARD_META = 'font-outfit text-[13px] sm:text-[14px] text-ink-muted mt-1 font-normal'
const REMINDER_CARD =
  'reminder-card bg-page rounded-card border-[0.5px] border-accent/20 hover:border-accent/40 ' +
  'flex items-start gap-2.5 sm:gap-3 px-3.5 py-3.5 sm:px-4 sm:py-4 w-full max-w-full min-w-0'

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
  if (reminder.isBirthday) return 'Birthday · yearly'
  if (reminder.isAnniversary) return 'Anniversary · yearly'
  return 'Recurring'
}

function ActionButtons({
  reminder,
  people,
  onEdit,
  onDelete,
}: {
  reminder: Reminder
  people?: Person[]
  onEdit?: (id: string) => void
  onDelete: (id: string) => void
}) {
  const phone = findPhoneForReminder(reminder, people)
  const calendarDayUrl = (reminder.calendarHtmlLink || reminder.calendarEventId)
    ? (() => {
        const d = reminder.date instanceof Date ? reminder.date : new Date(reminder.date)
        return `https://calendar.google.com/calendar/r/day/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
      })()
    : null

  return (
    <div className="flex items-center gap-0 flex-shrink-0 self-start mt-0.5">
      {calendarDayUrl && (
        <a
          href={calendarDayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={ACTION_BTN}
          title="View in Google Calendar"
        >
          <svg className={ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </a>
      )}
      {onEdit && (
        <button onClick={() => onEdit(reminder.id)} className={ACTION_BTN} title="Edit">
          <svg className={ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}
      <WhatsAppButton phone={phone} className={ACTION_BTN} />
      <button onClick={() => onDelete(reminder.id)} className={ACTION_BTN} title="Delete">
        <svg className={ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function ReminderCard({
  reminder,
  index,
  isNew,
  isExiting,
  people,
  onToggle,
  onEdit,
  onDelete,
  showToggle = true,
}: {
  reminder: Reminder
  index: number
  isNew: boolean
  isExiting: boolean
  people?: Person[]
  onToggle: (id: string) => void
  onEdit?: (id: string) => void
  onDelete: (id: string) => void
  showToggle?: boolean
}) {
  const animClass = isExiting
    ? 'animate-slide-out-right pointer-events-none'
    : isNew
    ? 'animate-slide-down-in'
    : `animate-fade-up stagger-${Math.min(index, 10)}`

  return (
    <div
      className={`${REMINDER_CARD} ${animClass}`}
      style={!isExiting && !isNew ? { animationFillMode: 'both' } : undefined}
    >
      {showToggle && (
        <button
          onClick={() => onToggle(reminder.id)}
          className="mt-0.5 w-[18px] h-[18px] rounded-full border-[1.5px] border-ink-faint
                     hover:border-accent flex-shrink-0 transition-colors duration-150"
          aria-label="Mark complete"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className={CARD_TITLE}>{reminder.text}</p>
        <p className={CARD_META}>
          {formatDate(reminder.date, new Date())}
          {reminder.isRecurring && (
            <span className="text-ink-faint"> · {recurringLabel(reminder)}</span>
          )}
        </p>
      </div>
      <ActionButtons reminder={reminder} people={people} onEdit={onEdit} onDelete={onDelete} />
    </div>
  )
}

function ReminderGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-[3px] w-full max-w-full min-w-0">{children}</div>
}

export default function ReminderList({
  reminders,
  people,
  onToggle,
  onDelete,
  onEdit,
  newReminderId,
}: ReminderListProps) {
  const [showCompleted, setShowCompleted] = useState(true)
  const [showRecurring, setShowRecurring] = useState(true)
  const [now, setNow] = useState(() => new Date())
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const runExit = useCallback((id: string, action: () => void) => {
    setExitingIds(prev => new Set(prev).add(id))
    setTimeout(() => {
      action()
      setExitingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 250)
  }, [])

  const handleDelete = (id: string) => runExit(id, () => onDelete(id))
  const handleToggle = (id: string) => runExit(id, () => onToggle(id))

  if (reminders.length === 0) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <p className={`${CARD_TITLE} text-ink-muted`}>{copy.remindersEmpty}</p>
        <p className={`${CARD_META} text-ink-faint`}>{copy.remindersEmptyHint}</p>
      </div>
    )
  }

  const recurring = reminders
    .filter(r => r.isRecurring && !r.isCompleted)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const nonRecurring = reminders.filter(r => !r.isRecurring)
  const upcoming = nonRecurring
    .filter(r => !r.isCompleted && r.date >= now)
    .sort((a, b) => {
      const aCreated = a.createdAt ?? (parseInt(a.id, 10) || 0)
      const bCreated = b.createdAt ?? (parseInt(b.id, 10) || 0)
      if (bCreated !== aCreated) return bCreated - aCreated
      return a.date.getTime() - b.date.getTime()
    })

  const completed = nonRecurring.filter(r => r.isCompleted || r.date < now)

  return (
    <div className="w-full max-w-full min-w-0">
      {upcoming.length > 0 && (
        <div>
          <hr className={SECTION_RULE} />
          <p className={SECTION_LABEL}>{copy.sectionUpcoming}</p>
          <ReminderGroup>
            {upcoming.map((reminder, index) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                index={index}
                isNew={reminder.id === newReminderId}
                isExiting={exitingIds.has(reminder.id)}
                people={people}
                onToggle={handleToggle}
                onEdit={onEdit}
                onDelete={handleDelete}
              />
            ))}
          </ReminderGroup>
        </div>
      )}

      {recurring.length > 0 && (
        <div className={upcoming.length > 0 ? 'mt-8' : ''}>
          {upcoming.length === 0 && <hr className={SECTION_RULE} />}
          <div className="flex items-center">
            <p className={`${SECTION_LABEL} flex-1`}>{copy.sectionRecurring}</p>
            <button
              onClick={() => setShowRecurring(!showRecurring)}
              className="font-outfit text-body text-ink-faint hover:text-accent transition-colors pr-1"
            >
              {showRecurring ? copy.hide : copy.show}
            </button>
          </div>
          {showRecurring && (
            <ReminderGroup>
              {recurring.map((reminder, index) => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  index={index}
                  isNew={false}
                  isExiting={exitingIds.has(reminder.id)}
                  people={people}
                  onToggle={handleToggle}
                  onEdit={onEdit}
                  onDelete={handleDelete}
                  showToggle={false}
                />
              ))}
            </ReminderGroup>
          )}
        </div>
      )}

      {completed.length > 0 && (
        <div className="pt-10 mt-2">
          <hr className={SECTION_RULE} />
          <div className="flex items-center">
            <p className={`${SECTION_LABEL} flex-1`}>{copy.sectionHistory}</p>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="font-outfit text-body text-ink-faint hover:text-accent transition-colors pr-1"
            >
              {showCompleted ? copy.hide : copy.show}
            </button>
          </div>
          {showCompleted && (
            <ReminderGroup>
              {completed.map((reminder) => (
                <div
                  key={reminder.id}
                  className={`${REMINDER_CARD} items-center py-4
                    ${exitingIds.has(reminder.id) ? 'animate-slide-out-right' : ''}`}
                >
                  <button
                    onClick={() => handleToggle(reminder.id)}
                    className="w-[18px] h-[18px] rounded-full bg-ink-faint/30 flex items-center justify-center flex-shrink-0"
                    aria-label="Restore"
                  >
                    <svg className="w-3 h-3 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`${CARD_TITLE} text-ink-faint line-through font-semibold truncate`}>{reminder.text}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(reminder.id)}
                    className={ACTION_BTN}
                  >
                    <svg className={ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </ReminderGroup>
          )}
        </div>
      )}
    </div>
  )
}
