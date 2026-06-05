'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import CareActionsPanel from '@/components/CareActionsPanel'
import StatusBanner from '@/components/StatusBanner'
import TemplateConfirmationModal from '@/components/TemplateConfirmationModal'
import RelationshipTypeModal from '@/components/RelationshipTypeModal'
import DatePickerModal from '@/components/DatePickerModal'
import { Reminder } from '@/components/ReminderList'
import { Person, CareTemplate, RelationshipType, RELATIONSHIP_LABELS, RELATIONSHIP_EMOJI } from '@/lib/types'
import { getPersonById, linkReminderToPerson, updatePerson, deletePerson } from '@/lib/people'
import { getRemindersKey, hasCalendarAccess, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, RecurrenceOptions, getStoredEmail } from '@/lib/google'
import { generateTitle } from '@/lib/ai'
import { syncReminderToFirestore, deleteReminderFromFirestore, syncPersonToFirestore, deletePersonFromFirestore, pullFromFirestore } from '@/lib/db'
import { parseReminder, RecurrenceInfo } from '@/lib/parser'
import EditReminderModal from '@/components/EditReminderModal'
import ReminderInput from '@/components/ReminderInput'
import WhatsAppButton from '@/components/WhatsAppButton'
import ThoughtfulTitle from '@/components/ThoughtfulTitle'
import { formatDate as sharedFormatDate } from '@/lib/dateFormat'

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
  const [editingProfileReminder, setEditingProfileReminder] = useState<Reminder | null>(null)

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

  const createReminderWithDate = async (text: string, dateTime: Date, recurrence?: RecurrenceInfo) => {
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
      // For birthdays/anniversaries: calendar event + display on actual date,
      // notification fires 1 day before
      const triggerAt = (recurrence?.isBirthday || recurrence?.isAnniversary)
        ? new Date(dateTime.getTime() - 24 * 60 * 60 * 1000).getTime()
        : dateTime.getTime()
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

      if (hasCalendarAccess()) {
        setStatus('Creating calendar event...')
        const result = await createCalendarEvent({
          title: friendlyTitle,
          date: dateTime.toISOString(),
        })

        if (result?.id) {
          const calFields = {
            calendarEventId: result.id,
            calendarHtmlLink: result.htmlLink || undefined,
            lastSyncedAt: Date.now(),
            originalStartTime: result.start?.dateTime || undefined,
          }
          const updated = updatedReminders.map(r =>
            r.id === id ? { ...r, ...calFields } : r
          )
          saveReminders(updated)
          setReminders(prev => prev.map(r =>
            r.id === id ? { ...r, ...calFields } : r
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

  const submitProfileReminder = async (text: string) => {
    if (!text.trim() || !person || addingReminder) return
    setNewReminderText(text)
    const parsed = parseReminder(text.trim())
    if (parsed.date) {
      await createReminderWithDate(text.trim(), parsed.date, parsed.recurrence)
    } else {
      setPendingProfileReminder(text.trim())
    }
  }

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitProfileReminder(newReminderText)
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

    if (reminder?.calendarEventId && hasCalendarAccess()) {
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

  const handleEditProfileReminder = async (id: string, text: string, date: Date) => {
    setEditingProfileReminder(null)
    const reminder = reminders.find(r => r.id === id)
    if (!reminder) return
    const updated: Reminder = { ...reminder, text, date, triggerAt: date.getTime() }
    const allReminders = loadReminders()
    const updatedAll = allReminders.map((r: Reminder) => r.id === id ? updated : r)
    saveReminders(updatedAll)
    setReminders(prev => prev.map(r => r.id === id ? updated : r))
    if (userEmail) syncReminderToFirestore(userEmail, updated)
    if (reminder.calendarEventId && hasCalendarAccess()) {
      try {
        await updateCalendarEvent(reminder.calendarEventId, { title: text, date: date.toISOString() })
        setStatus('Reminder updated')
      } catch {
        setStatus('Updated locally (calendar sync failed)')
      }
    } else {
      setStatus('Reminder updated')
    }
    setTimeout(() => setStatus(null), 2000)
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

      if (hasCalendarAccess()) {
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
          const calFields = {
            calendarEventId: result.id,
            calendarHtmlLink: result.htmlLink || undefined,
            lastSyncedAt: Date.now(),
            originalStartTime: result.start?.dateTime || undefined,
          }
          const updated = updatedReminders.map(r =>
            r.id === id ? { ...r, ...calFields } : r
          )
          saveReminders(updated)
          setReminders(prev => prev.map(r =>
            r.id === id ? { ...r, ...calFields } : r
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

  const formatDate = (date: Date) => sharedFormatDate(date, new Date())

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center p-8 animate-fade-up">
          <p className="text-ink-muted mb-6 text-base font-light">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-accent text-white rounded-card text-sm font-medium
                       hover:bg-accent-hover transition-all duration-150"
          >
            ← Go back
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || !person) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-ink-faint text-sm font-light">Loading…</div>
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
    <main className="app-canvas min-h-screen bg-page animate-page-in max-w-2xl mx-auto w-full px-4 sm:px-8 py-8">

      <button
        onClick={() => router.push('/')}
        className="flex items-center gap-1.5 text-ink-muted hover:text-accent mb-8 transition-colors group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-mobile-caption sm:text-sm font-light">Back</span>
      </button>

      <div className="flex flex-col items-start text-left mb-10">
        <h1 className="leading-none w-full">
          <ThoughtfulTitle variant="profile" className="!justify-start">
            {person.name}
          </ThoughtfulTitle>
        </h1>
        <span className="mt-5 inline-block text-mobile-secondary sm:text-sm text-ink-muted font-light tracking-wide">
          {RELATIONSHIP_LABELS[person.relationshipType]}
          {person.birthday && (
            <> · {new Date(person.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
          )}
        </span>
        <p className="mt-2 text-mobile-caption sm:text-xs text-ink-faint font-light">
          {upcomingReminders.length} upcoming · {pastReminders.length} past
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {showEditEmail ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-surface rounded-card">
            <input
              type="email"
              value={editingEmail}
              onChange={(e) => setEditingEmail(e.target.value)}
              placeholder="email@example.com"
              className="text-sm bg-transparent text-ink placeholder:text-ink-faint focus:outline-none w-44"
              autoFocus
            />
            <button onClick={handleSaveEmail} className="text-sm font-medium text-accent">Save</button>
            <button onClick={() => { setShowEditEmail(false); setEditingEmail(person.email || '') }}
              className="text-sm text-ink-faint">✕</button>
          </div>
        ) : (
          <button onClick={() => setShowEditEmail(true)}
            className="px-3 py-1.5 sm:px-4 sm:py-2 text-mobile-caption sm:text-sm font-light text-ink-muted hover:text-ink hover:bg-surface rounded-card transition-colors">
            {person.email || 'Add email'}
          </button>
        )}
        {showEditPhone ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-surface rounded-card">
            <input
              type="tel"
              value={editingPhone}
              onChange={(e) => setEditingPhone(e.target.value)}
              placeholder="Phone"
              className="text-sm bg-transparent text-ink focus:outline-none w-32"
              autoFocus
            />
            <button onClick={handleSavePhone} className="text-sm font-medium text-accent">Save</button>
            <button onClick={() => { setShowEditPhone(false); setEditingPhone(person.phone || '') }}
              className="text-sm text-ink-faint">✕</button>
          </div>
        ) : (
          <button onClick={() => setShowEditPhone(true)}
            className="px-3 py-1.5 sm:px-4 sm:py-2 text-mobile-caption sm:text-sm font-light text-ink-muted hover:text-ink hover:bg-surface rounded-card transition-colors">
            {person.phone || 'Add phone'}
          </button>
        )}
        <button onClick={handleEditRelationship}
          className="px-3 py-1.5 sm:px-4 sm:py-2 text-mobile-caption sm:text-sm font-light text-ink-muted hover:text-ink hover:bg-surface rounded-card transition-colors">
          Edit relationship
        </button>
        <button onClick={() => setShowDeleteConfirm(true)}
          className="px-3 py-1.5 sm:px-4 sm:py-2 text-mobile-caption sm:text-sm font-light text-ink-muted hover:text-red-500 hover:bg-surface rounded-card transition-colors">
          Delete profile
        </button>
      </div>

      <div className="mb-4">
        <ReminderInput
          onSubmit={submitProfileReminder}
          placeholder={`Reminder for ${person.name}…`}
          compact
        />
      </div>

      <div className="w-full flex justify-center mb-6 min-h-[2.75rem] px-1">
        <StatusBanner message={status} />
      </div>

      <div className="mb-6">
        <CareActionsPanel
          personName={person.name}
          relationshipType={person.relationshipType}
          birthday={person.birthday}
          onSelectTemplate={handleSelectTemplate}
          onEditRelationship={handleEditRelationship}
        />
      </div>

      <div className="flex gap-2 mb-6 p-1 bg-surface rounded-card w-fit">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-[10px] text-mobile-caption sm:text-sm font-medium transition-all duration-150 ${
            activeTab === 'upcoming' ? 'bg-accent text-white' : 'text-ink-muted hover:text-ink'
          }`}
        >
          Upcoming ({upcomingReminders.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-[10px] text-mobile-caption sm:text-sm font-medium transition-all duration-150 ${
            activeTab === 'past' ? 'bg-accent text-white' : 'text-ink-muted hover:text-ink'
          }`}
        >
          History ({pastReminders.length})
        </button>
      </div>

      {displayedReminders.length === 0 ? (
        <p className="text-ink-muted text-mobile-body sm:text-sm font-light py-8 text-center">
          {activeTab === 'upcoming' ? 'No upcoming reminders' : 'No past reminders yet'}
        </p>
      ) : (
        <div className="space-y-[3px]">
          {displayedReminders.map((reminder, index) => (
            <div
              key={reminder.id}
              className={`reminder-card bg-page rounded-card border-[0.5px] border-accent/20 hover:border-accent/40
                grid grid-cols-[1fr_auto] items-start gap-x-2 px-4 py-3 sm:px-4 sm:py-4 w-full min-w-0
                animate-fade-up stagger-${Math.min(index, 10)} ${
                activeTab === 'past' ? 'opacity-70' : ''
              }`}
              style={{ animationFillMode: 'both' }}
            >
              <div className="min-w-0">
                <p className={`text-mobile-title sm:text-base font-semibold text-ink leading-snug break-words ${activeTab === 'past' ? 'line-through' : ''}`}>
                  {reminder.text}
                </p>
                <p className="text-mobile-secondary sm:text-xs text-ink-muted mt-0.5 sm:mt-1 font-light">{formatDate(reminder.date)}</p>
              </div>
              <div className="flex items-center gap-0 flex-shrink-0">
                {activeTab === 'upcoming' && (
                  <button
                    onClick={() => setEditingProfileReminder(reminder)}
                    className="flex items-center justify-center min-h-[44px] min-w-[44px] p-1.5 sm:p-2 text-accent hover:text-accent-hover hover:bg-accent-soft rounded-lg transition-colors"
                    title="Edit"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                <WhatsAppButton
                  phone={(reminder.phoneNumber || person.phone || '').replace(/[^0-9]/g, '')}
                  className="flex items-center justify-center min-h-[44px] min-w-[44px] p-1.5 sm:p-2 text-accent hover:text-accent-hover hover:bg-accent-soft rounded-lg transition-colors"
                />
                <button
                  onClick={() => handleDeleteReminder(reminder.id)}
                  className="flex items-center justify-center min-h-[44px] min-w-[44px] p-1.5 sm:p-2 text-accent hover:text-red-500 hover:bg-accent-soft rounded-lg transition-colors"
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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

      {/* Date Picker for new profile reminder */}
      {pendingProfileReminder && (
        <DatePickerModal
          text={pendingProfileReminder}
          onConfirm={handleProfileDatePicked}
          onCancel={() => setPendingProfileReminder(null)}
        />
      )}

      {/* Edit Reminder Modal */}
      {editingProfileReminder && (
        <EditReminderModal
          reminder={editingProfileReminder}
          onConfirm={handleEditProfileReminder}
          onCancel={() => setEditingProfileReminder(null)}
        />
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in"
               onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-lg shadow-card-hover p-8 max-w-sm w-full mx-4 animate-fade-in">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold text-ink">Delete profile?</h3>
              <p className="text-ink-muted text-sm font-light leading-relaxed">
                This will permanently delete {person.name}&apos;s profile. This cannot be undone.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 px-4 rounded-card text-sm font-medium text-ink-muted
                             bg-surface hover:bg-ink-faint/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProfile}
                  className="flex-1 py-3 px-4 bg-accent text-white rounded-card text-sm font-medium
                             hover:bg-accent-hover transition-colors"
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
