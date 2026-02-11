'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PersonAvatar from '@/components/PersonAvatar'
import CareActionsPanel from '@/components/CareActionsPanel'
import TemplateConfirmationModal from '@/components/TemplateConfirmationModal'
import { Reminder } from '@/components/ReminderList'
import { Person, CareTemplate } from '@/lib/types'
import { getPersonById, linkReminderToPerson } from '@/lib/people'
import { getRemindersKey, getUserEmail, isSignedIn, createCalendarEvent, RecurrenceOptions } from '@/lib/google'
import { generateTitle } from '@/lib/ai'

export default function PersonProfilePage() {
  const params = useParams()
  const router = useRouter()

  const personId = params.id as string
  const userEmail = isSignedIn() ? getUserEmail() : null

  const [person, setPerson] = useState<Person | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  // Template confirmation modal state
  const [templateModal, setTemplateModal] = useState<{
    template: CareTemplate
    generatedText: string
  } | null>(null)

  const loadReminders = useCallback(() => {
    try {
      const key = getRemindersKey()
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          return parsed.map((r: Reminder) => ({ ...r, date: new Date(r.date) }))
        }
      }
    } catch {}
    return []
  }, [])

  const saveReminders = useCallback((newReminders: Reminder[]) => {
    const key = getRemindersKey()
    localStorage.setItem(key, JSON.stringify(newReminders))
  }, [])

  useEffect(() => {
    // Load person data
    const loadedPerson = getPersonById(personId, userEmail || undefined)
    if (loadedPerson) {
      setPerson(loadedPerson)

      // Load and filter reminders for this person
      const allReminders = loadReminders()
      const linkedReminders = allReminders.filter((r: Reminder) =>
        loadedPerson.linkedReminderIds.includes(r.id) ||
        r.text.toLowerCase().includes(loadedPerson.name.toLowerCase())
      )
      setReminders(linkedReminders)
    } else {
      setError('Person not found')
    }

    setIsLoading(false)
  }, [personId, userEmail, loadReminders])

  const handleSelectTemplate = (template: CareTemplate, generatedText: string) => {
    setTemplateModal({ template, generatedText })
  }

  const handleConfirmTemplate = async (data: {
    reminderText: string
    date: string
    time: string
    isRecurring: boolean
    recurrencePattern: string | null
  }) => {
    if (!person) return

    try {
      const dateTime = new Date(`${data.date}T${data.time}`)
      const friendlyTitle = await generateTitle(data.reminderText)

      const id = Date.now().toString()
      const newReminder: Reminder = {
        id,
        text: friendlyTitle,
        date: dateTime,
        isCompleted: false,
        isRecurring: data.isRecurring
      }

      // Add to local reminders
      const allReminders = loadReminders()
      const updatedReminders = [newReminder, ...allReminders]
      saveReminders(updatedReminders)

      // Link to person
      linkReminderToPerson(person.id, id, userEmail || undefined)

      // Update local state
      setReminders(prev => [newReminder, ...prev])

      // Sync with Google Calendar if signed in
      if (isSignedIn() && data.isRecurring && data.recurrencePattern) {
        const recurrenceOptions: RecurrenceOptions = {
          type: data.recurrencePattern as 'weekly' | 'monthly' | 'yearly',
          isBirthday: false,
          isAnniversary: false,
          endDate: null
        }

        setStatus('Creating calendar event...')
        const result = await createCalendarEvent({
          title: friendlyTitle,
          date: dateTime.toISOString(),
          recurrence: recurrenceOptions
        })

        if (result?.id) {
          // Update reminder with calendar event ID
          const updated = updatedReminders.map(r =>
            r.id === id ? { ...r, calendarEventId: result.id } : r
          )
          saveReminders(updated)
        }

        setStatus('Reminder created')
        setTimeout(() => setStatus(null), 2000)
      } else if (isSignedIn()) {
        setStatus('Creating calendar event...')
        const result = await createCalendarEvent({
          title: friendlyTitle,
          date: dateTime.toISOString()
        })

        if (result?.id) {
          const updated = updatedReminders.map(r =>
            r.id === id ? { ...r, calendarEventId: result.id } : r
          )
          saveReminders(updated)
        }

        setStatus('Reminder created')
        setTimeout(() => setStatus(null), 2000)
      } else {
        setStatus('Saved locally')
        setTimeout(() => setStatus(null), 2000)
      }

      setTemplateModal(null)
    } catch (err) {
      console.error('Error creating reminder from template:', err)
      setError('Failed to create reminder')
      setStatus(null)
    }
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === now.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    }
    if (date.toDateString() === tomorrow.toDateString()) {
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="text-lavender hover:underline"
          >
            Go back home
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || !person) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen px-4 py-8 md:py-16">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Header */}
        <div className="flex items-center space-x-4 mb-8 animate-fade-in">
          <PersonAvatar name={person.name} color={person.avatarColor} size="lg" />
          <div>
            <h1 className="text-3xl font-semibold text-gray-800">{person.name}</h1>
            <p className="text-sm text-gray-400">
              {reminders.length} reminder{reminders.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Status message */}
        {status && (
          <div className="text-center mb-4 animate-fade-in">
            <p className="text-sm text-gray-500 bg-sand/60 inline-block px-4 py-2 rounded-xl">
              {status}
            </p>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Reminders List - 2 columns */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Reminders
            </h2>

            {reminders.length === 0 ? (
              <div className="bg-sand/30 rounded-2xl p-6 text-center animate-fade-in">
                <p className="text-gray-500">
                  No reminders yet. Use the quick actions to create one!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reminders
                  .filter(r => !r.isCompleted)
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map((reminder, index) => {
                    const colors = ['bg-blush/40', 'bg-lavender/40', 'bg-mint/40', 'bg-peach/40', 'bg-sky/40']
                    return (
                      <div
                        key={reminder.id}
                        className={`${colors[index % colors.length]} p-4 rounded-2xl animate-slide-up`}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <p className="text-gray-800 font-medium">
                          {reminder.text}
                          {reminder.isRecurring && (
                            <span className="ml-2 text-xs text-gray-400">🔄</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">{formatDate(reminder.date)}</p>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Care Actions Panel - 1 column */}
          <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CareActionsPanel
              personName={person.name}
              onSelectTemplate={handleSelectTemplate}
            />
          </div>
        </div>
      </div>

      {/* Template Confirmation Modal */}
      {templateModal && (
        <TemplateConfirmationModal
          template={templateModal.template}
          generatedText={templateModal.generatedText}
          personName={person.name}
          onConfirm={handleConfirmTemplate}
          onCancel={() => setTemplateModal(null)}
        />
      )}
    </main>
  )
}
