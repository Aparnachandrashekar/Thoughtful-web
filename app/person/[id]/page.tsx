'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PersonAvatar from '@/components/PersonAvatar'
import CareActionsPanel from '@/components/CareActionsPanel'
import TemplateConfirmationModal from '@/components/TemplateConfirmationModal'
import RelationshipTypeModal from '@/components/RelationshipTypeModal'
import DatePickerModal from '@/components/DatePickerModal'
import { Reminder } from '@/components/ReminderList'
import { Person, CareTemplate, RelationshipType, RELATIONSHIP_LABELS, RELATIONSHIP_EMOJI } from '@/lib/types'
import { getPersonById, linkReminderToPerson, updatePerson, deletePerson } from '@/lib/people'
import { getRemindersKey, isSignedIn, createCalendarEvent, deleteCalendarEvent, RecurrenceOptions, getStoredEmail } from '@/lib/google'
import { generateTitle } from '@/lib/ai'
import { syncReminderToFirestore, deleteReminderFromFirestore, syncPersonToFirestore, deletePersonFromFirestore, pullFromFirestore } from '@/lib/db'
import { parseReminder } from '@/lib/parser'

function getCardColor(index: number): string {
  const colors = ['bg-blush/60', 'bg-lavender/60', 'bg-mint/60', 'bg-peach/60', 'bg-sky/60']
  return colors[index % colors.length]
}

export default function PersonProfilePage() {
  const params = useParams()
  const router = useRouter()

  const personId = params.id as string
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    setUserEmail(getStoredEmail())
  }, [])

  const [person, setPerson] = useState<Person | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const [templateModal, setTemplateModal] = useState<{
    template: CareTemplate
    generatedText: string
  } | null>(null)
  const [showEditRelationship, setShowEditRelationship] = useState(false)
  const [showEditEmail, setShowEditEmail] = useState(false)
  const [editingEmail, setEditingEmail] = useState('')
  const [showEditPhone, setShowEditPhone] = useState(false)
  const [editingPhone, setEditingPhone] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [newReminderText, setNewReminderText] = useState('')
  const [addingReminder, setAddingReminder] = useState(false)
  const [pendingProfileReminder, setPendingProfileReminder] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')

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
    const email = getStoredEmail()

    const loadPersonData = () => {
      const loadedPerson = getPersonById(personId, email || undefined)
      if (loadedPerson) {
        setPerson(loadedPerson)
        setEditingEmail(loadedPerson.email || '')
        setEditingPhone(loadedPerson.phone || '')
        const allReminders = loadReminders()
        const linkedReminders = allReminders.filter((r: Reminder) =>
          loadedPerson.linkedReminderIds.includes(r.id) ||
          r.text.toLowerCase().includes(loadedPerson.name.toLowerCase())
        )
        setReminders(linkedReminders)
        return true
      }
      return false
    }

    // Try loading from localStorage first
    if (loadPersonData()) {
      setIsLoading(false)
      // Also pull from Firestore in background to get latest data
      if (email) {
        pullFromFirestore(email).then(({ reminders, people }) => {
          if (reminders > 0 || people > 0) {
            loadPersonData() // Reload with fresh data
          }
        }).catch(() => {})
      }
    } else if (email) {
      // Person not in localStorage — try pulling from Firestore first
      pullFromFirestore(email).then(() => {
        if (!loadPersonData()) {
          setError('Person not found')
        }
        setIsLoading(false)
      }).catch(() => {
        setError('Person not found')
        setIsLoading(false)
      })
    } else {
      setError('Person not found')
      setIsLoading(false)
    }
  }, [personId, loadReminders])

  const handleSelectTemplate = (template: CareTemplate, generatedText: string) => {
    setTemplateModal({ template, generatedText })
  }

  const handleEditRelationship = () => {
    setShowEditRelationship(true)
  }

  const handleUpdateRelationship = (relationshipType: RelationshipType, birthday?: string) => {
    if (person) {
      updatePerson(person.id, { relationshipType, birthday }, userEmail || undefined)
      const updated = { ...person, relationshipType, birthday }
      setPerson(updated)
      if (userEmail) syncPersonToFirestore(userEmail, updated)
      setShowEditRelationship(false)
      setStatus('Profile updated')
      setTimeout(() => setStatus(null), 2000)
    }
  }

  const handleSaveEmail = () => {
    if (person) {
      const emailToSave = editingEmail.trim() || undefined
      updatePerson(person.id, { email: emailToSave }, userEmail || undefined)
      const updated = { ...person, email: emailToSave }
      setPerson(updated)
      if (userEmail) syncPersonToFirestore(userEmail, updated)
      setShowEditEmail(false)
      setStatus('Email updated')
      setTimeout(() => setStatus(null), 2000)
    }
  }

  const handleSavePhone = () => {
    if (person) {
      const phoneToSave = editingPhone.trim() || undefined
      updatePerson(person.id, { phone: phoneToSave }, userEmail || undefined)
      const updated = { ...person, phone: phoneToSave }
      setPerson(updated)
      if (userEmail) syncPersonToFirestore(userEmail, updated)
      setShowEditPhone(false)
      setStatus('Phone updated')
      setTimeout(() => setStatus(null), 2000)
    }
  }

  const createReminderWithDate = async (text: string, dateTime: Date) => {
    if (!person) return
    setAddingReminder(true)
    try {
      let friendlyTitle: string
      try {
        friendlyTitle = await generateTitle(text)
      } catch {
        friendlyTitle = text
      }

      const id = Date.now().toString()
      const phoneNumber = person.phone ? person.phone.replace(/[^0-9+]/g, '') : undefined
      const message = friendlyTitle
      const triggerAt = dateTime.getTime()
      const whatsappLink = phoneNumber
        ? `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hey!')}`
        : undefined

      const newReminder: Reminder = {
        id,
        text: friendlyTitle,
        date: dateTime,
        isCompleted: false,
        message,
        personName: person.name,
        phoneNumber,
        whatsappLink,
        triggerAt,
        createdAt: Date.now(),
        triggered: false,
      }

      const allReminders = loadReminders()
      const updatedReminders = [newReminder, ...allReminders]
      saveReminders(updatedReminders)

      linkReminderToPerson(person.id, id, userEmail || undefined)
      if (userEmail) syncReminderToFirestore(userEmail, newReminder)
      setReminders(prev => [newReminder, ...prev])

      if (isSignedIn()) {
        setStatus('Creating calendar event...')
        const result = await createCalendarEvent({
          title: friendlyTitle,
          date: dateTime.toISOString(),
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
      } else {
        setStatus('Saved locally')
      }

      setNewReminderText('')
      setTimeout(() => setStatus(null), 2000)
    } catch (err) {
      console.error('Error adding reminder:', err)
      setStatus('Failed to create reminder')
      setTimeout(() => setStatus(null), 2000)
    } finally {
      setAddingReminder(false)
    }
  }

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newReminderText.trim() || !person || addingReminder) return

    const parsed = parseReminder(newReminderText.trim())

    if (parsed.date) {
      await createReminderWithDate(newReminderText.trim(), parsed.date)
    } else {
      // No date found — open date picker
      setPendingProfileReminder(newReminderText.trim())
    }
  }

  const handleProfileDatePicked = (date: Date) => {
    if (pendingProfileReminder) {
      createReminderWithDate(pendingProfileReminder, date)
      setPendingProfileReminder(null)
    }
  }

  const handleDeleteProfile = () => {
    if (person) {
      deletePerson(person.id, userEmail || undefined)
      if (userEmail) deletePersonFromFirestore(userEmail, person.id)
      router.push('/')
    }
  }

  const handleDeleteReminder = async (id: string) => {
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
    if (userEmail) deleteReminderFromFirestore(userEmail, id)
  }

  const handleConfirmTemplate = async (data: {
    reminderText: string
    date: string
    time: string
    isRecurring: boolean
    recurrenceType: string | null
    recurrenceInterval: number
    addMeetLink?: boolean
  }) => {
    if (!person) return

    try {
      const dateTime = new Date(`${data.date}T${data.time}`)
      const friendlyTitle = await generateTitle(data.reminderText)

      const id = Date.now().toString()
      const phoneNumber = person.phone ? person.phone.replace(/[^0-9+]/g, '') : undefined
      const message = friendlyTitle
      const triggerAt = dateTime.getTime()
      const whatsappLink = phoneNumber
        ? `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hey!')}`
        : undefined

      const newReminder: Reminder = {
        id,
        text: friendlyTitle,
        date: dateTime,
        isCompleted: false,
        isRecurring: data.isRecurring,
        message,
        personName: person.name,
        phoneNumber,
        whatsappLink,
        triggerAt,
        createdAt: Date.now(),
        triggered: false,
      }

      const allReminders = loadReminders()
      const updatedReminders = [newReminder, ...allReminders]
      saveReminders(updatedReminders)

      linkReminderToPerson(person.id, id, userEmail || undefined)
      if (userEmail) syncReminderToFirestore(userEmail, newReminder)
      setReminders(prev => [newReminder, ...prev])

      if (isSignedIn()) {
        const recurrenceOptions: RecurrenceOptions | undefined = data.isRecurring && data.recurrenceType ? {
          type: data.recurrenceType as 'weekly' | 'monthly' | 'yearly',
          isBirthday: false,
          isAnniversary: false,
          endDate: null,
          interval: data.recurrenceInterval
        } : undefined

        setStatus('Creating calendar event...')
        const result = await createCalendarEvent({
          title: friendlyTitle,
          date: dateTime.toISOString(),
          recurrence: recurrenceOptions,
          addMeetLink: data.addMeetLink,
          attendeeEmail: data.addMeetLink ? person.email : undefined
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

        const statusMsg = data.addMeetLink
          ? 'Reminder created with Google Meet link' + (person.email ? ` (invite sent to ${person.email})` : '')
          : 'Reminder created'
        setStatus(statusMsg)
        setTimeout(() => setStatus(null), 3000)
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
        <div className="text-center p-8">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-red-500 mb-4 text-lg">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-lavender text-gray-800 rounded-2xl font-semibold hover:bg-lavender/80 transition-all"
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
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    )
  }

  const now = new Date()
  // History is purely date-based - no isCompleted check
  const upcomingReminders = reminders
    .filter(r => r.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const pastReminders = reminders
    .filter(r => r.date < now)
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  const displayedReminders = activeTab === 'upcoming' ? upcomingReminders : pastReminders

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-sand/30">
      {/* Header Section */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-12 py-6 md:py-8">
          {/* Back button */}
          <button
            onClick={() => router.push('/')}
            className="flex items-center text-gray-400 hover:text-gray-600 mb-6 md:mb-8 transition-all group"
          >
            <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium text-sm sm:text-base">Back to reminders</span>
          </button>

          {/* Profile Header */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
            <PersonAvatar name={person.name} color={person.avatarColor} size="lg" />
            <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
              <div>
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gray-800 tracking-tight">
                  {person.name}
                </h1>
                <div className="flex items-center flex-wrap gap-2 sm:gap-3 mt-2 sm:mt-3">
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-lavender/30 rounded-2xl text-sm sm:text-base font-medium">
                    <span className="text-lg sm:text-xl">{RELATIONSHIP_EMOJI[person.relationshipType]}</span>
                    <span className="text-gray-700">{RELATIONSHIP_LABELS[person.relationshipType]}</span>
                  </span>
                  {person.birthday && (
                    <span className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-peach/30 rounded-2xl text-sm sm:text-base">
                      <span>🎂</span>
                      <span className="text-gray-600">{new Date(person.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons — grid on mobile for clean layout */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
                {/* Email button */}
                {showEditEmail ? (
                  <div className="col-span-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-sky/20 rounded-2xl">
                    <input
                      type="email"
                      value={editingEmail}
                      onChange={(e) => setEditingEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="text-sm px-3 sm:px-4 py-2 border-2 border-sky/50 rounded-xl focus:border-sky focus:ring-2 focus:ring-sky/30 outline-none w-full sm:w-56"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEmail}
                        className="flex-1 sm:flex-none px-4 py-2 bg-sky text-gray-800 rounded-xl font-semibold text-sm hover:bg-sky/80 transition-all"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setShowEditEmail(false)
                          setEditingEmail(person.email || '')
                        }}
                        className="flex-1 sm:flex-none px-4 py-2 text-gray-500 hover:text-gray-700 font-medium text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowEditEmail(true)}
                    className={`inline-flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl font-medium text-xs sm:text-sm transition-all hover:scale-[1.02] ${
                      person.email
                        ? 'bg-sky/20 text-gray-700 hover:bg-sky/30'
                        : 'bg-sky/40 text-gray-800 hover:bg-sky/50 shadow-sm'
                    }`}
                  >
                    <span className="text-base sm:text-lg">📧</span>
                    <span className="truncate">{person.email || 'Add email'}</span>
                  </button>
                )}

                {/* Phone button */}
                {showEditPhone ? (
                  <div className="col-span-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-green-50 rounded-2xl">
                    <input
                      type="tel"
                      value={editingPhone}
                      onChange={(e) => setEditingPhone(e.target.value)}
                      placeholder="+1234567890"
                      className="text-sm px-3 sm:px-4 py-2 border-2 border-green-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none w-full sm:w-44"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSavePhone}
                        className="flex-1 sm:flex-none px-4 py-2 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-600 transition-all"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setShowEditPhone(false)
                          setEditingPhone(person.phone || '')
                        }}
                        className="flex-1 sm:flex-none px-4 py-2 text-gray-500 hover:text-gray-700 font-medium text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowEditPhone(true)}
                    className={`inline-flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl font-medium text-xs sm:text-sm transition-all hover:scale-[1.02] ${
                      person.phone
                        ? 'bg-green-100 text-gray-700 hover:bg-green-200'
                        : 'bg-green-200 text-gray-800 hover:bg-green-300 shadow-sm'
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    <span className="truncate">{person.phone || 'Add phone'}</span>
                  </button>
                )}

                {/* Edit relationship button */}
                <button
                  onClick={handleEditRelationship}
                  className="inline-flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-mint/30 rounded-2xl font-medium text-xs sm:text-sm text-gray-700 hover:bg-mint/50 transition-all hover:scale-[1.02]"
                >
                  <span className="text-base sm:text-lg">✏️</span>
                  <span>Edit</span>
                </button>

                {/* Delete profile button */}
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-blush/30 rounded-2xl font-medium text-xs sm:text-sm text-gray-700 hover:bg-blush/50 transition-all hover:scale-[1.02]"
                >
                  <span className="text-base sm:text-lg">🗑️</span>
                  <span>Delete</span>
                </button>
              </div>

              <p className="text-gray-500 text-sm sm:text-base">
                {upcomingReminders.length} upcoming · {pastReminders.length} past
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status message */}
      {status && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-12 pt-4 sm:pt-6">
          <div className="text-center animate-fade-in">
            <p className="text-sm text-gray-600 bg-white/80 backdrop-blur-sm inline-block px-5 py-3 rounded-2xl border border-gray-100 shadow-sm">
              {status}
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-12 py-6 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">

          {/* Care Actions Panel — shows FIRST on mobile, sidebar on desktop */}
          <div className="order-1 lg:order-2 lg:col-span-1">
            <div className="lg:sticky lg:top-6 space-y-4">
              <CareActionsPanel
                personName={person.name}
                relationshipType={person.relationshipType}
                birthday={person.birthday}
                onSelectTemplate={handleSelectTemplate}
                onEditRelationship={handleEditRelationship}
              />

              {/* Email tip */}
              {!person.email && (
                <div className="p-4 sm:p-5 bg-gradient-to-br from-sky/30 to-mint/20 rounded-2xl border border-sky/30">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    <span className="font-bold">💡 Tip:</span> Add {person.name}&apos;s email to send them
                    calendar invites with Google Meet links.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reminders List — shows SECOND on mobile */}
          <div className="order-2 lg:order-1 lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Add Reminder Input */}
            <form onSubmit={handleAddReminder} className="flex gap-2 sm:gap-3">
              <input
                type="text"
                value={newReminderText}
                onChange={(e) => setNewReminderText(e.target.value)}
                placeholder={`Add a reminder for ${person.name}...`}
                className="flex-1 min-w-0 px-4 sm:px-5 py-3 text-sm sm:text-base bg-white border-2 border-lavender/50 rounded-2xl
                           placeholder:text-gray-400 focus:border-lavender focus:ring-0 focus:outline-none
                           shadow-sm hover:shadow-md transition-shadow"
              />
              <button
                type="submit"
                disabled={!newReminderText.trim() || addingReminder}
                className="px-4 sm:px-6 py-3 bg-lavender text-gray-700 font-semibold rounded-2xl
                           hover:bg-lavender/80 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all active:scale-95 flex-shrink-0"
              >
                {addingReminder ? '...' : 'Add'}
              </button>
            </form>

            {/* Tabs */}
            <div className="flex items-center gap-1 sm:gap-2 p-1 sm:p-1.5 bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-100 w-fit">
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                  activeTab === 'upcoming'
                    ? 'bg-lavender text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                Upcoming ({upcomingReminders.length})
              </button>
              <button
                onClick={() => setActiveTab('past')}
                className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                  activeTab === 'past'
                    ? 'bg-lavender text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                History ({pastReminders.length})
              </button>
            </div>

            {displayedReminders.length === 0 ? (
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 sm:p-12 text-center border border-gray-100 animate-fade-in">
                <div className="text-5xl sm:text-6xl mb-4">{activeTab === 'upcoming' ? '✨' : '📚'}</div>
                <p className="text-gray-600 font-semibold text-base sm:text-lg">
                  {activeTab === 'upcoming' ? 'No upcoming reminders' : 'No past reminders'}
                </p>
                <p className="text-gray-400 mt-2 text-sm">
                  {activeTab === 'upcoming'
                    ? 'Use the suggested actions above to create one!'
                    : 'Past events will appear here'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {displayedReminders.map((reminder, index) => (
                  <div
                    key={reminder.id}
                    className={`${getCardColor(index)} p-4 sm:p-5 rounded-2xl animate-slide-up
                               hover:scale-[1.01] hover:shadow-md transition-all duration-200
                               ${activeTab === 'past' ? 'opacity-70' : ''}`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <p className={`text-gray-800 font-semibold text-base sm:text-lg leading-snug ${activeTab === 'past' ? 'line-through' : ''}`}>
                          {reminder.text}
                          {reminder.isRecurring && (
                            <span className="ml-2 text-sm" title="Recurring">
                              {reminder.isBirthday ? '🎂' : reminder.isAnniversary ? '💝' : '🔄'}
                            </span>
                          )}
                        </p>
                        <p className="text-sm sm:text-base text-gray-600 mt-1.5 sm:mt-2">
                          {formatDate(reminder.date)}
                          {activeTab === 'past' && <span className="ml-2 text-green-600 font-medium">✓ Done</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => {
                            const phone = (reminder.phoneNumber || person.phone || '').replace(/[^0-9]/g, '')
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
                          onClick={() => handleDeleteReminder(reminder.id)}
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
            )}
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
          personEmail={person.email}
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

      {/* Delete Confirmation Modal */}
      {/* Date Picker Modal for profile reminders */}
      {pendingProfileReminder && (
        <DatePickerModal
          text={pendingProfileReminder}
          onConfirm={handleProfileDatePicked}
          onCancel={() => setPendingProfileReminder(null)}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full mx-4 animate-fade-in">
            <div className="text-center space-y-4">
              <div className="text-5xl">🗑️</div>
              <h3 className="text-xl font-bold text-gray-800">Delete Profile?</h3>
              <p className="text-gray-500">
                Are you sure you want to delete {person.name}&apos;s profile? This action cannot be undone.
              </p>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 px-4 border-2 border-gray-200 rounded-2xl text-gray-600 hover:bg-gray-50 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProfile}
                  className="flex-1 py-3 px-4 bg-red-500 text-white rounded-2xl hover:bg-red-600 font-semibold transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
