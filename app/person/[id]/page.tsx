'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PersonAvatar from '@/components/PersonAvatar'
import CareActionsPanel from '@/components/CareActionsPanel'
import TemplateConfirmationModal from '@/components/TemplateConfirmationModal'
import RelationshipTypeModal from '@/components/RelationshipTypeModal'
import { Reminder } from '@/components/ReminderList'
import { Person, CareTemplate, RelationshipType, RELATIONSHIP_LABELS, RELATIONSHIP_EMOJI } from '@/lib/types'
import { getPersonById, linkReminderToPerson, updatePerson } from '@/lib/people'
import { getRemindersKey, getUserEmail, isSignedIn, createCalendarEvent, deleteCalendarEvent, RecurrenceOptions } from '@/lib/google'
import { generateTitle } from '@/lib/ai'

function getCardColor(index: number): string {
  const colors = ['bg-blush/40', 'bg-lavender/40', 'bg-mint/40', 'bg-peach/40', 'bg-sky/40']
  return colors[index % colors.length]
}

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

  // Modal states
  const [templateModal, setTemplateModal] = useState<{
    template: CareTemplate
    generatedText: string
  } | null>(null)
  const [showEditRelationship, setShowEditRelationship] = useState(false)

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

  const loadPersonData = useCallback(() => {
    const loadedPerson = getPersonById(personId, userEmail || undefined)
    if (loadedPerson) {
      setPerson(loadedPerson)
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

  useEffect(() => {
    loadPersonData()
  }, [loadPersonData])

  const handleSelectTemplate = (template: CareTemplate, generatedText: string) => {
    setTemplateModal({ template, generatedText })
  }

  const handleEditRelationship = () => {
    setShowEditRelationship(true)
  }

  const handleUpdateRelationship = (relationshipType: RelationshipType, birthday?: string) => {
    if (person) {
      updatePerson(person.id, { relationshipType, birthday }, userEmail || undefined)
      setPerson({ ...person, relationshipType, birthday })
      setShowEditRelationship(false)
      setStatus('Profile updated')
      setTimeout(() => setStatus(null), 2000)
    }
  }

  const handleDelete = async (id: string) => {
    const reminder = reminders.find(r => r.id === id)

    if (reminder?.calendarEventId && isSignedIn()) {
      try {
        setStatus('Removing from calendar...')
        await deleteCalendarEvent(reminder.calendarEventId)
        setStatus('Removed from calendar')
        setTimeout(() => setStatus(null), 2000)
      } catch {
        setStatus('Removed locally')
        setTimeout(() => setStatus(null), 2000)
      }
    }

    const allReminders = loadReminders()
    const updatedReminders = allReminders.filter((r: Reminder) => r.id !== id)
    saveReminders(updatedReminders)
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  const handleConfirmTemplate = async (data: {
    reminderText: string
    date: string
    time: string
    isRecurring: boolean
    recurrenceType: string | null
    recurrenceInterval: number
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

      const allReminders = loadReminders()
      const updatedReminders = [newReminder, ...allReminders]
      saveReminders(updatedReminders)

      linkReminderToPerson(person.id, id, userEmail || undefined)
      setReminders(prev => [newReminder, ...prev])

      if (isSignedIn() && data.isRecurring && data.recurrenceType) {
        const recurrenceOptions: RecurrenceOptions = {
          type: data.recurrenceType as 'weekly' | 'monthly' | 'yearly',
          isBirthday: false,
          isAnniversary: false,
          endDate: null,
          interval: data.recurrenceInterval
        }

        setStatus('Creating calendar event...')
        const result = await createCalendarEvent({
          title: friendlyTitle,
          date: dateTime.toISOString(),
          recurrence: recurrenceOptions
        })

        if (result?.id) {
          const updated = updatedReminders.map(r =>
            r.id === id ? { ...r, calendarEventId: result.id } : r
          )
          saveReminders(updated)
          setReminders(prev => prev.map(r =>
            r.id === id ? { ...r, calendarEventId: result.id } : r
          ))
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
          setReminders(prev => prev.map(r =>
            r.id === id ? { ...r, calendarEventId: result.id } : r
          ))
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-sand/30">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="text-lavender hover:underline font-medium"
          >
            Go back home
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || !person) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-sand/30">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  const upcomingReminders = reminders
    .filter(r => !r.isCompleted)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-sand/30">
      {/* Header Section */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {/* Back button */}
          <button
            onClick={() => router.push('/')}
            className="flex items-center text-gray-400 hover:text-gray-600 mb-6 transition-colors group"
          >
            <svg className="w-5 h-5 mr-1.5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back to reminders</span>
          </button>

          {/* Profile Header */}
          <div className="flex items-start gap-5">
            <PersonAvatar name={person.name} color={person.avatarColor} size="lg" />
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-semibold text-gray-800 tracking-tight">
                {person.name}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-lavender/20 rounded-full text-sm">
                  <span>{RELATIONSHIP_EMOJI[person.relationshipType]}</span>
                  <span className="text-gray-600">{RELATIONSHIP_LABELS[person.relationshipType]}</span>
                </span>
                {person.birthday && (
                  <span className="text-sm text-gray-400">
                    🎂 {new Date(person.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              <p className="text-gray-400 mt-2 text-sm">
                {upcomingReminders.length} upcoming reminder{upcomingReminders.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status message */}
      {status && (
        <div className="max-w-3xl mx-auto px-6 pt-6">
          <div className="text-center animate-fade-in">
            <p className="text-sm text-gray-500 bg-white/80 backdrop-blur-sm inline-block px-4 py-2 rounded-xl border border-gray-100">
              {status}
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Reminders List */}
          <div className="lg:col-span-2 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Reminders
              </h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                {upcomingReminders.length} active
              </span>
            </div>

            {upcomingReminders.length === 0 ? (
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 text-center border border-gray-100 animate-fade-in">
                <div className="text-4xl mb-3">✨</div>
                <p className="text-gray-500 font-medium">No reminders yet</p>
                <p className="text-gray-400 text-sm mt-1">
                  Use the suggested actions to create one!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingReminders.map((reminder, index) => (
                  <div
                    key={reminder.id}
                    className={`${getCardColor(index)} p-4 rounded-2xl animate-slide-up
                               hover:scale-[1.01] transition-all duration-200`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 font-medium leading-snug">
                          {reminder.text}
                          {reminder.isRecurring && (
                            <span className="ml-2 text-xs text-gray-400" title="Recurring">
                              {reminder.isBirthday ? '🎂' : reminder.isAnniversary ? '💝' : '🔄'}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500 mt-1.5">
                          {formatDate(reminder.date)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(reminder.id)}
                        className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-white/50 rounded-lg transition-all"
                        title="Delete reminder"
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

          {/* Care Actions Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <CareActionsPanel
                personName={person.name}
                relationshipType={person.relationshipType}
                birthday={person.birthday}
                onSelectTemplate={handleSelectTemplate}
                onEditRelationship={handleEditRelationship}
              />

              {/* Tip */}
              <div className="mt-4 p-4 bg-white/40 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="font-medium text-gray-500">Tip:</span> Templates are customized
                  based on your relationship with {person.name}.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Template Confirmation Modal */}
      {templateModal && (
        <TemplateConfirmationModal
          template={templateModal.template}
          generatedText={templateModal.generatedText}
          personName={person.name}
          birthday={person.birthday}
          onConfirm={handleConfirmTemplate}
          onCancel={() => setTemplateModal(null)}
        />
      )}

      {/* Edit Relationship Modal */}
      {showEditRelationship && (
        <RelationshipTypeModal
          personName={person.name}
          onConfirm={handleUpdateRelationship}
          onCancel={() => setShowEditRelationship(false)}
        />
      )}
    </main>
  )
}
